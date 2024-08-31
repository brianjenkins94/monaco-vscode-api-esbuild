import { createHash } from "crypto";
import { defineConfig } from "tsup";
import { existsSync, promises as fs } from "fs";
import { resolve } from "import-meta-resolve";
import * as path from "path";
import * as url from "url";
import JSON5 from "json5";
import polyfillNode from "node-stdlib-browser/helpers/esbuild/plugin"; // NOT "esbuild-plugins-node-modules-polyfill" OR "esbuild-plugin-polyfill-node"
import stdLibBrowser from "node-stdlib-browser";

import { esbuildOptions, tsup } from "./util/esbuild";

const cacheDirectory = path.join(__dirname, ".cache");
const distDirectory = path.join(__dirname, "docs");
const assetsDirectory = path.join(distDirectory, "assets");

// Handle `new URL("./path/to/asset", import.meta.url)`

async function replaceAsync(regex, input, callback = async (execResults: RegExpExecArray) => Promise.resolve(execResults[1])) {
	regex = new RegExp(regex.source, [...new Set([...regex.flags, "d"])].join(""));

	const output = [];

	let index = input.length;
	let result;

	for (let origin = 0; result = regex.exec(input); origin = index) {
		index = result.indices[1][1] + 1;

		output.push(input.substring(origin, result.indices[1][0] - 1), await callback(result));
	}

	output.push(input.substring(index));

	return output.join("");
}

const importMetaUrlPlugin = {
	"name": "import-meta-url",
	"setup": function(build) {
		build.onLoad({ "filter": /.*/u }, async function({ "path": importer }) {
			const contents = await fs.readFile(importer, { "encoding": "utf8" });

			const workerRegEx = /worker(?:\.jsx?|\.tsx?)?(?:\?worker)?/u;

			if (workerRegEx.test(contents)) {
				console.log(importer);
			}
		});

		build.onLoad({ "filter": /.*/u }, async function({ "path": importer }) {
			let contents = await fs.readFile(importer, { "encoding": "utf8" });

			const newUrlRegEx = /new URL\((?:"|')(.*?)(?:"|'), \w+(?:\.\w+)*\)(?:\.\w+(?:\(\))?)?/gu;

			if (newUrlRegEx.test(contents)) {
				// TODO: This whole function could use a review.
				contents = await replaceAsync(newUrlRegEx, contents, async function([_, match]) {
					let filePath = path.join(path.dirname(importer), match);
					let baseName = path.basename(filePath);

					if (filePath.endsWith(".ts")) {
						console.log(importer);

						await Promise.all((await fs.readdir(cacheDirectory)).map(function(path) {
							return new Promise<void>(async function(resolve, reject) {
								await fs.rm(path, { "recursive": true, "force": true });

								resolve();
							});
						}));

						await tsup({
							"config": false,
							"entry": [filePath],
							"inject": [
								url.fileURLToPath(import.meta.resolve("node-stdlib-browser/helpers/esbuild/shim"))
							],
							"define": {
								"Buffer": "Buffer"
							},
							"esbuildPlugins": [
								// These plugins don't appear to be order-sensitive.
								polyfillNode(Object.fromEntries(["buffer", "crypto", "events", "os", "net", "path", "process", "stream", "util"].map(function(libName) {
									return [libName, stdLibBrowser[libName]];
								}))),
								importMetaUrlPlugin
							],
							"external": ["vscode"], //[/^vscode.*/u],
							"format": "cjs",
							"outDir": cacheDirectory,
							"platform": "browser"
						});

						const extension = path.extname(baseName);
						baseName = path.basename(baseName, extension);

						filePath = path.join(cacheDirectory, baseName + ".cjs");
						baseName += ".js";
					}

					// TODO: Improve
					if (!existsSync(filePath)) {
						const fallbackPaths = [
							path.join(__dirname, "demo", "node_modules", match),
							path.join(__dirname, "demo", "node_modules", match + ".js"),
							path.join(__dirname, "demo", "node_modules", "vscode", match)
						];

						for (const fallbackPath of fallbackPaths) {
							if (existsSync(fallbackPath)) {
								filePath = fallbackPath;
								baseName = path.basename(filePath);

								break;
							}
						}
					}

					switch (true) {
						case filePath.endsWith(".code-snippets"):
							baseName += ".json";
							break;
						case filePath.endsWith(".json"):
							await fs.writeFile(filePath, JSON.stringify(JSON5.parse(await fs.readFile(filePath, { "encoding": "utf8" }) || "{}"), undefined, "\t") + "\n");
							break;
						case filePath.endsWith(".mp3"):
							return "\"data:audio/mpeg;base64,\"";
						case filePath.endsWith(".html"):
						case filePath.endsWith(".tmLanguage"):
						case filePath.endsWith(".woff"):
							await fs.copyFile(filePath, path.join(assetsDirectory, baseName));

							return "\"./" + baseName + "\"";
						default:
					}

					// Caching opportunity here:
					const file = await fs.readFile(filePath);

					const hash = createHash("sha256").update(file).digest("hex").substring(0, 6);

					const extension = path.extname(baseName);
					baseName = path.basename(baseName, extension);

					if (baseName !== "extensionHost.worker") {
						baseName = baseName + "-" + hash + extension;

						// Copy it to the assets directory
						await fs.copyFile(filePath, path.join(assetsDirectory, baseName));
					}

					if (importer.endsWith(".ts")) {
						return "\"./assets/" + baseName + "\"";
					}

					// So that we can refer to it by its unique name.
					return "\"./" + baseName + "\"";
				});

				return {
					"contents": contents,
					"loader": path.extname(importer).substring(1)
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
	await fs.rm(chunksDirectory, { "recursive": true, "force": true });
}

await fs.mkdir(chunksDirectory, { "recursive": true });

async function manualChunks(chunkAliases: Record<string, string[]>) {
	return Object.fromEntries(await Promise.all(Object.entries(chunkAliases).map(async function([chunkAlias, modules]) {
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
	})));
}

await Promise.all([assetsDirectory, cacheDirectory].map(function(directory) {
	return new Promise<void>(async function(resolve, reject) {
		if (existsSync(directory)) {
			await fs.rm(directory, { "recursive": true, "force": true });
		}

		resolve();
	});
}));

await Promise.all([assetsDirectory, cacheDirectory].map(function(directory) {
	return new Promise<void>(async function(resolve, reject) {
		await fs.mkdir(directory, { "recursive": true });

		resolve();
	});
}));

// Main Config

const entry = {
	"main": "main.ts",
	...await manualChunks({
		"monaco": ["./demo/src/main.ts"]
	}),
	//"extensionHost.worker": "./demo/node_modules/vscode/vscode/src/vs/workbench/api/worker/extensionHostWorker.js"
};

console.log(entry);

export default defineConfig({
	"entry": entry,
	"esbuildOptions": esbuildOptions({
		"nodePaths": ["./demo/node_modules/"]
	}),
	"esbuildPlugins": [
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
