import { defineConfig } from "tsup";

function esbuildOptions(options, context) {
	//options.jsxImportSource = "preact";
}

export default defineConfig({
	"esbuildOptions": esbuildOptions,
	"esbuildPlugins": [
		{
			"name": "precompile",
			"setup": function(build) {
				build.onLoad({ "filter": /\.json$/u }, function(args) {
					console.log(args);
				});
			}
		}
	],
	"treeshake": true
});
