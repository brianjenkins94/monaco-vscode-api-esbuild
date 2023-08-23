import { defineConfig } from "tsup";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { copyFileSync, existsSync, promises as fs, readFileSync, writeFileSync } from "fs";
import { resolve } from "import-meta-resolve";
import * as path from "path";
import * as url from "url";
import JSON5 from "json5";

function esbuildOptions(options, context) {
	options.assetNames = "assets/[name]";
	options.chunkNames = "assets/[name]-[hash]";
	options.entryNames = "[name]";
}

async function tsup(options) {
	return (await import("tsup")).build({
		"esbuildOptions": esbuildOptions,
		"esbuildPlugins": [],
		"format": "esm",
		"treeshake": true,
		...options,
		// WORKAROUND: `tsup` gives the entry straight to `globby` and `globby` doesn't get along with Windows paths.
		"entry": options.entry.map(function(entry) {
			return entry.replace(/\\/gu, "/");
		})
	});
}

const distDirectory = path.join(__dirname, "dist", "assets");

// Handle `new URL("./path/to/asset", import.meta.url)`

const importMetaUrlPlugin = {
	"name": "new-url-to-data-url",
	"setup": function(build) {
		build.onLoad({ "filter": /.*/u }, async function({ "path": filePath }) {
			if (!existsSync(filePath)) {
				return;
			}

			const contents = await fs.readFile(filePath, { "encoding": "utf8" });

			const newUrlRegEx = /new URL\((?:"|')(.*?)(?:"|'), import\.meta\.url\)(?:\.\w+(?:\(\))?)?/gu;

			const parentDirectory = path.dirname(filePath);

			if (newUrlRegEx.test(contents)) {
				return {
					"contents": contents.replace(newUrlRegEx, function(_, match) {
						const filePath = path.join(parentDirectory, match);

						if (!existsSync(filePath)) {
							return;
						}

						if (filePath.endsWith(".json")) {
							writeFileSync(filePath, JSON.stringify(JSON5.parse(readFileSync(filePath, { "encoding": "utf8" }))));
						} else if (filePath.endsWith(".mp3")) {
							return "\"data:audio/mpeg;base64,\"";
						}

						copyFileSync(filePath, path.join(distDirectory, path.basename(filePath)));

						return "\"/dist/assets/" + path.basename(filePath).replace(/\\/gu, "/") + "\"";
					}),
					"loader": path.extname(filePath).substring(1)
				};
			}
		});
	}
};

// Chunks

async function findParentPackageJson(directory) {
	if (existsSync(path.join(directory, "package.json"))) {
		return path.join(directory, "package.json");
	} else {
		return findParentPackageJson(path.dirname(directory));
	}
}

const chunksDirectory = path.join(__dirname, "chunks");

await fs.rm(chunksDirectory, { "recursive": true });

await fs.mkdir(chunksDirectory, { "recursive": true });

async function manualChunks(chunkAliases: { [chunkAlias: string]: string[] }) {
	return Object.fromEntries(await Promise.all(
		Object.entries(chunkAliases).map(async function([chunkAlias, modules]) {
			if (!existsSync(path.join(chunksDirectory, chunkAlias + ".ts"))) {
				const dependencies = [...new Set((await Promise.all(modules.map(async function(module) {
					let modulePath;

					try {
						modulePath = url.fileURLToPath(resolve(module, import.meta.url));
					} catch (error) {
						modulePath = path.join(__dirname, "node_modules", module);

						if (!existsSync(modulePath)) {
							return [];
						}
					}

					const packageJsonPath = await findParentPackageJson(modulePath);

					const packageJson = await fs.readFile(packageJsonPath, { "encoding": "utf8" });

					return (await Promise.all(Object.keys(JSON.parse(packageJson).dependencies ?? {}).map(function(module) {
						return new Promise(function(resolve, reject) {
							resolve(existsSync(path.join(__dirname, "node_modules", module)) ? module : undefined);
						});
					}))).filter(function(element) {
						return element !== undefined;
					});
				}))).flat(Infinity))];

				await fs.writeFile(path.join(chunksDirectory, chunkAlias + ".ts"), dependencies.map(function(module) {
					return "import \"" + module + "\";\n";
				}));
			}

			return ["dist/" + chunkAlias, path.join("chunks", chunkAlias + ".ts")];
		})
	));
}

// Workers

const workerPlugin = {
	"name": "inline-worker",
	"setup": function(build) {
		async function buildWorker(workerPath) {
			await tsup({
				"config": false,
				"entry": [workerPath],
				"esbuildPlugins": [
					nodeModulesPolyfillPlugin(),
					importMetaUrlPlugin
				]
			});

			return fs.readFile(path.join(__dirname, "dist", path.basename(workerPath, path.extname(workerPath)) + ".js"), { "encoding": "utf8" });
		}

		build.onLoad({ "filter": /\.worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, async function({ "path": workerPath }) {
			const workerCode = await buildWorker(workerPath);

			return {
				"contents": `
					import inlineWorker from '__inline-worker';
					
					export default function Worker() {
						return inlineWorker(${JSON.stringify(workerCode)});
					}
				`,
				"loader": "js"
			};
		});

		const inlineWorkerFunctionCode = `
			export default function inlineWorker(scriptText) {
				const blob = new Blob([scriptText], { type: 'text/javascript' });
				const url = URL.createObjectURL(blob);
				const worker = new Worker(url);
				URL.revokeObjectURL(url);
				return worker;
			}
		`;

		build.onResolve({ "filter": /^__inline-worker$/u }, function({ path }) {
			return {
				"path": path,
				"namespace": "inline-worker"
			};
		});

		build.onLoad({ "filter": /.*/u, "namespace": "inline-worker" }, function() {
			return {
				"contents": inlineWorkerFunctionCode,
				"loader": "js"
			};
		});
	}
};

const workers = {};

await tsup({
	"config": false,
	"entry": ["main.ts"],
	"esbuildPlugins": [
		{
			"name": "enumerate-workers",
			"setup": function(build) {
				build.onLoad({ "filter": /\.worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, async function({ "path": workerPath }) {
					workerPath = path.relative(__dirname, workerPath).split("?")[0].replace(/\\/gu, "/");

					const workerChunkPath = path.join(chunksDirectory, path.basename(workerPath, path.extname(workerPath)));

					workers[path.basename(workerChunkPath)] = [workerChunkPath + ".js"];

					await fs.writeFile(workerChunkPath + ".ts", "import \"../" + workerPath + "\";\n");

					return {
						"contents": `
							export default function noop() {
								return;
							}
						`,
						"loader": "js"
					};
				});
			}
		}
	]
});

await fs.rm(path.join(__dirname, "dist"), { "recursive": true });

await fs.mkdir(distDirectory, { "recursive": true });

// Main Config

console.log({
	"dist/main": "main.ts",
	...await manualChunks({
		"monaco": [
			"monaco-editor/esm/vs/editor/editor.api.js",
			"./monaco/demo/src/setup.ts",
			"vscode/dist/extensions.js",
			"vscode/dist/default-extensions"
		],
		...workers
	})
});

export default defineConfig({
	"entry": {
		"dist/main": "main.ts",
		...await manualChunks({
			"monaco": [
				"monaco-editor/esm/vs/editor/editor.api.js",
				"./monaco/demo/src/setup.ts",
				"vscode/dist/extensions.js",
				"vscode/dist/default-extensions"
			],
			...workers
		})
	},
	"esbuildOptions": esbuildOptions,
	"esbuildPlugins": [
		// This can be removed after we figure out if we need `toCrossOriginWorker` or `toWorkerConfig`.
		{
			"name": "resolve-worker",
			"setup": function(build) {
				build.onLoad({ "filter": /tools(?:\/|\\)workers\.ts$/u }, function(args) {
					return {
						"contents": `
							export function toCrossOriginWorker(worker) {
								return worker;
							}

							export function toWorkerConfig(worker) {
								return worker;
							}
						`,
						"loader": "ts"
					};
				});
			}
		},
		importMetaUrlPlugin,
		workerPlugin
	],
	"loader": {
		".code-snippets": "json",
		//".html": "copy",
		".d.ts": "copy",
		".map": "empty",
		".svg": "dataurl",
		".tmLanguage": "dataurl"
	},
	"external": [
		"fonts"
	],
	"treeshake": true
});
