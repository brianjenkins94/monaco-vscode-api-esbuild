import { defineConfig } from "tsup";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { existsSync, promises as fs, readFileSync, writeFileSync } from "fs";
import { resolve } from "import-meta-resolve";
import * as path from "path";
import * as url from "url";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";
import JSON5 from "json5";

function esbuildOptions(options, context) {
	options.assetNames = "[dir]/[name]";
	options.chunkNames = "[dir]/[name]-[hash]";
	options.entryNames = "[dir]/[name]";
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

						if (filePath.endsWith(".json")) {
							writeFileSync(filePath, JSON.stringify(JSON5.parse(readFileSync(filePath, { "encoding": "utf8" }))));
						} else if (filePath.endsWith(".mp3")) {
							return "\"data:audio/mpeg;base64,\"";
						}

						return "import(\"" + filePath + "\")";

						//return `"data:${mimeType};charset=UTF-8;base64,${data}"`;
					}),
					"loader": path.extname(filePath).substring(1)
				};
			}
		});
	}
};

export default defineConfig({
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
