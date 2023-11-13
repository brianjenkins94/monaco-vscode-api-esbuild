import { existsSync, promises as fs } from "fs";
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
		"entry": Array.isArray(options.entry) ? options.entry.map(function(entry) {
			return entry.replace(/\\/gu, "/");
		}) : Object.fromEntries(Object.entries(options.entry).map(function([key, value]) {
			return [key, value.replace(/\\/gu, "/")];
		}))
	});
}

const distDirectory = path.join(__dirname, "dist");
const assetsDirectory = path.join(distDirectory, "assets");

// Handle `new URL("./path/to/asset", import.meta.url)`

const importMetaUrlPlugin = {
	"name": "import-meta-url",
	"setup": function(build) {
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

		build.onLoad({ "filter": /.*/u }, async function({ "path": importer }) {
			let contents = await fs.readFile(importer, { "encoding": "utf8" });

			const newUrlRegEx = /new URL\((?:"|')(.*?)(?:"|'), import\.meta\.url\)(?:\.\w+(?:\(\))?)?/gu;

			if (newUrlRegEx.test(contents)) {
				// TODO: This whole function could use a review.
				contents = await replaceAsync(newUrlRegEx, contents, async function([_, match]) {
					let filePath = path.join(path.dirname(importer), match);
					let baseName = path.basename(filePath);

					if (filePath.endsWith(".ts")) {
						const file = await fs.readFile(filePath);

						const hash = createHash("sha256").update(file).digest("hex").substring(0, 6);

						const extension = path.extname(baseName);
						baseName = path.basename(baseName, extension);

						baseName = baseName + "-" + hash;

						await tsup({
							"config": false, // Is this needed?
							"entry": {
								[baseName]: filePath
							},
							"external": ["vscode"],
							"format": "cjs",
							"outDir": assetsDirectory,
							"outExtension": function({ format }) {
								return {
									"js": ".js"
								};
							}
						});

						baseName += ".js";

						if (importer.endsWith("main.ts")) {
							return "\"./assets/" + baseName + "\"";
						}

						return "\"./" + baseName + "\"";
					}

					// TODO: Improve
					if (!existsSync(filePath)) {
						const fallbackPaths = [
							path.join(__dirname, "monaco-vscode-api", "demo", "node_modules", match),
							path.join(__dirname, "monaco-vscode-api", "demo", "node_modules", "vscode", match)
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

					baseName = baseName + "-" + hash + extension;

					// Copy it to the assets directory
					await fs.copyFile(filePath, path.join(assetsDirectory, baseName));

					if (importer.endsWith("main.ts")) {
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
				build.onLoad({ "filter": /worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, async function({ "path": workerPath }) {
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
	],
	"write": false
});

if (existsSync(distDirectory)) {
	await fs.rm(distDirectory, { "recursive": true });
}

await fs.mkdir(assetsDirectory, { "recursive": true });

// Main Config

const entry = {
	"main": "main.ts",
	...await manualChunks({
		"monaco": ["./monaco-vscode-api/demo/"],
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
				build.onResolve({ "filter": /worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, function({ "path": filePath, importer }) {
					if (filePath.startsWith(".")) {
						return;
					}

					const baseName = path.basename(filePath.replace(/worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u, "worker"));

					return {
						"path": path.join(__dirname, "chunks", baseName + ".ts")
					};
				});

				build.onLoad({ "filter": /worker(?:\.jsx?|\.tsx?)?(?:\?worker)?$/u }, function({ "path": workerPath }) {
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
