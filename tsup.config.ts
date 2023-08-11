import { defineConfig } from "tsup";
import { resolve } from "import-meta-resolve";
import * as url from "url";
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

function esbuildOptions(options, context) {
	//options.jsxImportSource = "preact";
}

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
				build.onResolve({ "filter": /\?worker$/u }, function(args) {
					return {
						"path": url.fileURLToPath(resolve(args.path.replace(/\?worker$/u, ""), import.meta.url))
					};
				});
			}
		},
		inlineWorkerPlugin({
			"plugins": [
				nodeModulesPolyfillPlugin()
			]
		})
	],
	"treeshake": true
});
