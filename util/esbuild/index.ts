// @ts-expect-error
import type { BuildOptions, Format, Options } from "tsup";

export function esbuildOptions(overrides: BuildOptions = {}) {
	overrides["assetNames"] ??= "assets/[name]";
	overrides["chunkNames"] ??= "assets/[name]-[hash]";
	overrides["entryNames"] ??= "[dir]/[name]";

	return function(options: BuildOptions, context: { "format": Format }) {
		for (const [key, value] of Object.entries(overrides)) {
			options[key] = value;
		}
	};
}

export async function tsup(options: Options) {
	return (await import("tsup")).build({
		"esbuildOptions": esbuildOptions(options.esbuildOptions as BuildOptions),
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
