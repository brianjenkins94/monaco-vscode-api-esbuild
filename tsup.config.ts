import { defineConfig } from "tsup";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { existsSync, promises as fs, readFileSync } from "fs";
import { resolve } from "import-meta-resolve";
import * as path from "path";
import * as url from "url";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";
import mime from "mime/lite.js";

function esbuildOptions(options, context) {
	//options.jsxImportSource = "preact";
}

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

						let data = "";

						if (existsSync(filePath)) {
							data = readFileSync(filePath, { "encoding": "base64" });
						}

						const mimeType = mime.getType(path.extname(filePath));

						return `"data:${mimeType};charset=UTF-8;base64,${data}"`;
					}),
					"loader": path.extname(filePath).substring(1)
				};
			}
		});
	}
};

export default defineConfig({
	"entry": {
		"monaco": "monaco/src/main.ts",
		"setup": "monaco/src/setup.ts"
	},
	"esbuildOptions": esbuildOptions,
	"esbuildPlugins": [
		{
			"name": "resolve-worker",
			"setup": function(build) {
				build.onResolve({ "filter": /\?worker$/u }, function({ path }) {
					return {
						"path": url.fileURLToPath(resolve(path.replace(/\?worker$/u, ""), import.meta.url))
					};
				});

				build.onLoad({ "filter": /tools\/workers\.ts$/u }, function(args) {
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
	"treeshake": true
});
