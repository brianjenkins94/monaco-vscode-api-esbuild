import { copyFileSync, existsSync, promises as fs, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { defineConfig } from "tsup";
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

const distDirectory = path.join(__dirname, "dist");
const assetsDirectory = path.join(distDirectory, "assets");

// Handle `new URL("./path/to/asset", import.meta.url)`

const importMetaUrlPlugin = {
	"name": "import-meta-url",
	"setup": function(build) {
		build.onLoad({ "filter": /.*/u }, async function({ "path": filePath }) {
			let contents = await fs.readFile(filePath, { "encoding": "utf8" });

			const newUrlRegEx = /new URL\((?:"|')(.*?)(?:"|'), import\.meta\.url\)(?:\.\w+(?:\(\))?)?/gu;

			const parentDirectory = path.dirname(filePath);

			if (newUrlRegEx.test(contents)) {
				contents = contents.replace(newUrlRegEx, function(_, match) {
					let filePath = path.join(parentDirectory, match);
					let baseName = path.basename(filePath);

					if (filePath.includes("(JavaScript).tmLanguage")) {
						console.log();
					}

					if (!existsSync(filePath)) {
						const fallbackPath = path.join(__dirname, "monaco", "demo", "node_modules", match);

						if (existsSync(fallbackPath)) {
							filePath = fallbackPath;
							baseName = path.basename(filePath);
							match = "./assets/" + baseName;

							copyFileSync(filePath, path.join(assetsDirectory, baseName));
						} else {
							return;
						}
					}

					if (filePath.endsWith(".code-snippets")) {
						baseName += ".json";
					} else if (filePath.endsWith(".html") || filePath.endsWith(".tmLanguage")) {
						copyFileSync(filePath, path.join(assetsDirectory, baseName));

						return "\"./assets/" + baseName.replace(/\\/gu, "/") + "\"";
					} else if (filePath.endsWith(".js")) {
						return "\"" + match + "\"";
					} else if (filePath.endsWith(".json")) {
						writeFileSync(filePath, JSON.stringify(JSON5.parse(readFileSync(filePath, { "encoding": "utf8" }))));
					} else if (filePath.endsWith(".mp3")) {
						return "\"data:audio/mpeg;base64,\"";
					}

					try {
						// Caching opportunity here:
						const file = readFileSync(filePath);

						// If it's JSON-like
						JSON.parse(file.toString("utf8"));

						const hash = createHash("sha256").update(file).digest("hex").substring(0, 6);

						const extension = path.extname(baseName);
						baseName = path.basename(baseName, extension);

						baseName = baseName + "-" + hash + extension;

						// Copy it to the assets directory
						copyFileSync(filePath, path.join(assetsDirectory, baseName));

						// So that we can refer to it by its unique name.
						return "\"./assets/" + baseName.replace(/\\/gu, "/") + "\"";
					} catch (error) {
						// Otherwise, leave it unchanged.
						return "\"" + match + "\"";
					}
				});

				return {
					"contents": contents,
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

if (existsSync(chunksDirectory)) {
	await fs.rm(chunksDirectory, { "recursive": true });
}

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
							resolve(path.join(path.dirname(packageJsonPath), "node_modules", module));
						});
					}))).filter(function(element) {
						return existsSync(element);
					});
				}))).flat(Infinity))];

				await fs.writeFile(path.join(chunksDirectory, chunkAlias + ".ts"), dependencies.map(function(module) {
					return "import \"../" + path.relative(__dirname, module).replace(/\\/gu, "/") + "\";\n";
				}));
			}

			return [chunkAlias, path.join("chunks", chunkAlias + ".ts")];
		})
	));
}

// Workers

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

					//entry[path.basename(workerChunkPath)] = workerPath; //[workerChunkPath + ".js"];

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

if (existsSync(distDirectory)) {
	await fs.rm(distDirectory, { "recursive": true });
}

await fs.mkdir(assetsDirectory, { "recursive": true });

// Main Config

const entry = {
	"main": "main.ts",
	...await manualChunks({
		"monaco": [
			"monaco-editor/esm/vs/editor/editor.api.js",
			"./monaco/demo/src/setup.ts",
			"vscode/dist/extensions.js",
			"vscode/dist/default-extensions"
		],
		...workers
	})
};

console.log(entry);

export default defineConfig({
	"entry": entry,
	"esbuildOptions": esbuildOptions,
	"esbuildPlugins": [
		{
			"name": "resolve-worker",
			"setup": function(build) {
				// This can be removed after we figure out if we need `toCrossOriginWorker` or `toWorkerConfig`.
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

				build.onResolve({ "filter": /\.worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, function({ "path": filePath, importer }) {
					if (filePath.startsWith(".")) {
						return;
					}

					const baseName = path.basename(filePath.replace(/\.worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u, ".worker"));
					//filePath = importer.endsWith("setup.ts") ? "./" + baseName + ".js" : path.join(__dirname, "monaco", "demo", "node_modules", filePath);

					return {
						"path": path.join(__dirname, "chunks", baseName + ".ts")
						//"external": importer.endsWith("setup.ts")
					};
				});

				build.onLoad({ "filter": /\.worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, function({ "path": workerPath }) {
					return {
						"contents": `
							export default function() {
								return new Worker("./${path.basename(workerPath, path.extname(workerPath)) + ".js"}", { "type": "module" });
							}
						`,
						"loader": "js"
					};
				});
			}
		},
		importMetaUrlPlugin
	],
	"external": [
		"fonts"
	],
	"loader": {
		".bin": "copy",
		".map": "empty",
		".svg": "dataurl",
		".tmLanguage": "dataurl",
		".wasm": "copy"
	},
	"treeshake": true
});
