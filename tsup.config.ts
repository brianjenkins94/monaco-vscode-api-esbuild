import { defineConfig } from "tsup";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { copyFileSync, existsSync, promises as fs, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "import-meta-resolve";
import * as path from "path";
import * as url from "url";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";
import JSON5 from "json5";

function esbuildOptions(options, context) {
	options.assetNames = "assets/[name]";
	options.chunkNames = "assets/[name]-[hash]";
	options.entryNames = "[name]";
}

// Handle `new URL("./path/to/asset", import.meta.url)`

const newUrlToDataUrlPlugin = {
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

						if (filePath.endsWith(".html")) {
							const outputDirectory = path.join(__dirname, "dist", "assets");

							mkdirSync(outputDirectory, { "recursive": true });

							copyFileSync(filePath, path.join(outputDirectory, path.basename(filePath)));

							return "\"/dist/assets/" + path.basename(filePath) + "\"";
						} else if (filePath.endsWith(".json")) {
							writeFileSync(filePath, JSON.stringify(JSON5.parse(readFileSync(filePath, { "encoding": "utf8" }))));
						} else if (filePath.endsWith(".mp3")) {
							return "\"data:audio/mpeg;base64,\"";
						}

						return "import(\"./" + path.relative(__dirname, filePath).replace(/\\/gu, "/") + "\")";

						//return `"data:${mimeType};charset=UTF-8;base64,${data}"`;
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

async function manualChunks(chunkAliases: { [chunkAlias: string]: string[] }) {
	return Promise.all(
		Object.entries(chunkAliases).map(async function([chunkAlias, modules]) {
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

			await fs.writeFile(path.join(__dirname, "chunks", chunkAlias + ".ts"), dependencies.map(function(module) {
				return `import "${module}";\n`;
			}));

			return path.join("chunks", chunkAlias + ".ts");
		})
	);
}

// Main Config

export default defineConfig({
	"entry": [
		"main.ts",
		...await manualChunks({
			"monaco": [
				"monaco-editor/esm/vs/editor/editor.api.js",
				"./monaco/demo/src/setup.ts",
				"vscode/dist/extensions.js",
				"vscode/dist/default-extensions"
			]
		})
	],
	"esbuildOptions": esbuildOptions,
	"esbuildPlugins": [
		{
			"name": "resolve-worker",
			"setup": function(build) {
				build.onResolve({ "filter": /\?worker$/u }, function({ "path": filePath }) {
					return {
						"path": url.fileURLToPath(resolve(filePath.replace(/\?worker$/u, ""), import.meta.url))
					};
				});

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
		newUrlToDataUrlPlugin,
		inlineWorkerPlugin({
			"plugins": [
				nodeModulesPolyfillPlugin(),
				newUrlToDataUrlPlugin
			],
			"minify": false
		})
	],
	"loader": {
		".code-snippets": "json",
		//".html": "copy",
		".d.ts": "copy",
		".map": "empty",
		".svg": "dataurl",
		".tmLanguage": "dataurl"
	},
	"external": ["fonts"],
	"treeshake": true
});
