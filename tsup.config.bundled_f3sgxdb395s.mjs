// tsup.config.ts
import { defineConfig } from "tsup";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";
import { copyFileSync, existsSync, promises as fs, readFileSync, writeFileSync } from "fs";
import { resolve } from "import-meta-resolve";
import * as path from "path";
import * as url from "url";
import JSON5 from "json5";
var __injected_dirname__ = "C:\\Users\\User\\Documents\\GitHub\\poc";
var __injected_import_meta_url__ = "file:///C:/Users/User/Documents/GitHub/poc/tsup.config.ts";
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
var distDirectory = path.join(__injected_dirname__, "dist", "assets");
var newUrlToDataUrlPlugin = {
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
            const filePath2 = path.join(parentDirectory, match);
            if (!existsSync(filePath2)) {
              return;
            }
            if (filePath2.endsWith(".json")) {
              writeFileSync(filePath2, JSON.stringify(JSON5.parse(readFileSync(filePath2, { "encoding": "utf8" }))));
            } else if (filePath2.endsWith(".mp3")) {
              return '"data:audio/mpeg;base64,"';
            }
            copyFileSync(filePath2, path.join(distDirectory, path.basename(filePath2)));
            return '"/dist/assets/' + path.basename(filePath2).replace(/\\/gu, "/") + '"';
          }),
          "loader": path.extname(filePath).substring(1)
        };
      }
    });
  }
};
async function findParentPackageJson(directory) {
  if (existsSync(path.join(directory, "package.json"))) {
    return path.join(directory, "package.json");
  } else {
    return findParentPackageJson(path.dirname(directory));
  }
}
var chunksDirectory = path.join(__injected_dirname__, "chunks");
await fs.rm(chunksDirectory, { "recursive": true });
await fs.mkdir(chunksDirectory, { "recursive": true });
async function manualChunks(chunkAliases) {
  return Object.fromEntries(await Promise.all(
    Object.entries(chunkAliases).map(async function([chunkAlias, modules]) {
      if (!existsSync(path.join(chunksDirectory, chunkAlias + ".ts"))) {
        const dependencies = [...new Set((await Promise.all(modules.map(async function(module) {
          let modulePath;
          try {
            modulePath = url.fileURLToPath(resolve(module, __injected_import_meta_url__));
          } catch (error) {
            modulePath = path.join(__injected_dirname__, "node_modules", module);
            if (!existsSync(modulePath)) {
              return [];
            }
          }
          const packageJsonPath = await findParentPackageJson(modulePath);
          const packageJson = await fs.readFile(packageJsonPath, { "encoding": "utf8" });
          return (await Promise.all(Object.keys(JSON.parse(packageJson).dependencies ?? {}).map(function(module2) {
            return new Promise(function(resolve2, reject) {
              resolve2(existsSync(path.join(__injected_dirname__, "node_modules", module2)) ? module2 : void 0);
            });
          }))).filter(function(element) {
            return element !== void 0;
          });
        }))).flat(Infinity))];
        await fs.writeFile(path.join(chunksDirectory, chunkAlias + ".ts"), dependencies.map(function(module) {
          return 'import "' + module + '";\n';
        }));
      }
      return ["dist/" + chunkAlias, path.join("chunks", chunkAlias + ".ts")];
    })
  ));
}
var inlineWorkerPlugin = {
  "name": "inline-worker",
  "setup": function(build) {
    async function buildWorker(workerPath) {
      await tsup({
        "config": false,
        "entry": [workerPath],
        "esbuildPlugins": [
          nodeModulesPolyfillPlugin(),
          newUrlToDataUrlPlugin
        ]
      });
      return fs.readFile(path.join(__injected_dirname__, "dist", path.basename(workerPath, path.extname(workerPath)) + ".js"), { "encoding": "utf8" });
    }
    build.onLoad({ "filter": /\.worker(?:\.jsx?|\.tsx?|\?worker)?$/u }, async function({ "path": workerPath }) {
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
    build.onResolve({ "filter": /^__inline-worker$/u }, function({ path: path2 }) {
      return {
        "path": path2,
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
var workers = {};
if (existsSync(chunksDirectory)) {
} else {
  await tsup({
    "config": false,
    "entry": ["main.ts"],
    "esbuildPlugins": [
      {
        "name": "enumerate-workers",
        "setup": function(build) {
          build.onLoad({ "filter": /\.worker(?:\.jsx?|\.tsx?|\?worker)?$/u }, async function({ "path": workerPath }) {
            workerPath = path.relative(__injected_dirname__, workerPath).split("?")[0].replace(/\\/gu, "/");
            const workerChunkPath = path.join(chunksDirectory, path.basename(workerPath, path.extname(workerPath)) + ".ts");
            workers[path.basename(workerPath, path.extname(workerPath))] = [workerChunkPath];
            await fs.writeFile(workerChunkPath, 'import "../' + workerPath + '";\n');
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
}
await fs.rm(path.join(__injected_dirname__, "dist"), { "recursive": true });
await fs.mkdir(distDirectory, { "recursive": true });
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
var tsup_config_default = defineConfig({
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
    newUrlToDataUrlPlugin,
    inlineWorkerPlugin
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
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiQzpcXFxcVXNlcnNcXFxcVXNlclxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHBvY1xcXFx0c3VwLmNvbmZpZy50c1wiO2NvbnN0IF9faW5qZWN0ZWRfZGlybmFtZV9fID0gXCJDOlxcXFxVc2Vyc1xcXFxVc2VyXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxccG9jXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Vc2VyL0RvY3VtZW50cy9HaXRIdWIvcG9jL3RzdXAuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInRzdXBcIjtcclxuaW1wb3J0IHsgbm9kZU1vZHVsZXNQb2x5ZmlsbFBsdWdpbiB9IGZyb20gXCJlc2J1aWxkLXBsdWdpbnMtbm9kZS1tb2R1bGVzLXBvbHlmaWxsXCI7XHJcbmltcG9ydCB7IGNvcHlGaWxlU3luYywgZXhpc3RzU3luYywgcHJvbWlzZXMgYXMgZnMsIHJlYWRGaWxlU3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcImltcG9ydC1tZXRhLXJlc29sdmVcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgKiBhcyB1cmwgZnJvbSBcInVybFwiO1xyXG5pbXBvcnQgSlNPTjUgZnJvbSBcImpzb241XCI7XHJcblxyXG5mdW5jdGlvbiBlc2J1aWxkT3B0aW9ucyhvcHRpb25zLCBjb250ZXh0KSB7XHJcblx0b3B0aW9ucy5hc3NldE5hbWVzID0gXCJhc3NldHMvW25hbWVdXCI7XHJcblx0b3B0aW9ucy5jaHVua05hbWVzID0gXCJhc3NldHMvW25hbWVdLVtoYXNoXVwiO1xyXG5cdG9wdGlvbnMuZW50cnlOYW1lcyA9IFwiW25hbWVdXCI7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHRzdXAob3B0aW9ucykge1xyXG5cdHJldHVybiAoYXdhaXQgaW1wb3J0KFwidHN1cFwiKSkuYnVpbGQoe1xyXG5cdFx0XCJlc2J1aWxkT3B0aW9uc1wiOiBlc2J1aWxkT3B0aW9ucyxcclxuXHRcdFwiZXNidWlsZFBsdWdpbnNcIjogW10sXHJcblx0XHRcImZvcm1hdFwiOiBcImVzbVwiLFxyXG5cdFx0XCJ0cmVlc2hha2VcIjogdHJ1ZSxcclxuXHRcdC4uLm9wdGlvbnMsXHJcblx0XHQvLyBXT1JLQVJPVU5EOiBgdHN1cGAgZ2l2ZXMgdGhlIGVudHJ5IHN0cmFpZ2h0IHRvIGBnbG9iYnlgIGFuZCBgZ2xvYmJ5YCBkb2Vzbid0IGdldCBhbG9uZyB3aXRoIFdpbmRvd3MgcGF0aHMuXHJcblx0XHRcImVudHJ5XCI6IG9wdGlvbnMuZW50cnkubWFwKGZ1bmN0aW9uKGVudHJ5KSB7XHJcblx0XHRcdHJldHVybiBlbnRyeS5yZXBsYWNlKC9cXFxcL2d1LCBcIi9cIik7XHJcblx0XHR9KVxyXG5cdH0pO1xyXG59XHJcblxyXG5jb25zdCBkaXN0RGlyZWN0b3J5ID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCJkaXN0XCIsIFwiYXNzZXRzXCIpO1xyXG5cclxuLy8gSGFuZGxlIGBuZXcgVVJMKFwiLi9wYXRoL3RvL2Fzc2V0XCIsIGltcG9ydC5tZXRhLnVybClgXHJcblxyXG5jb25zdCBuZXdVcmxUb0RhdGFVcmxQbHVnaW4gPSB7XHJcblx0XCJuYW1lXCI6IFwibmV3LXVybC10by1kYXRhLXVybFwiLFxyXG5cdFwic2V0dXBcIjogZnVuY3Rpb24oYnVpbGQpIHtcclxuXHRcdGJ1aWxkLm9uTG9hZCh7IFwiZmlsdGVyXCI6IC8uKi91IH0sIGFzeW5jIGZ1bmN0aW9uKHsgXCJwYXRoXCI6IGZpbGVQYXRoIH0pIHtcclxuXHRcdFx0aWYgKCFleGlzdHNTeW5jKGZpbGVQYXRoKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY29udGVudHMgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgeyBcImVuY29kaW5nXCI6IFwidXRmOFwiIH0pO1xyXG5cclxuXHRcdFx0Y29uc3QgbmV3VXJsUmVnRXggPSAvbmV3IFVSTFxcKCg/OlwifCcpKC4qPykoPzpcInwnKSwgaW1wb3J0XFwubWV0YVxcLnVybFxcKSg/OlxcLlxcdysoPzpcXChcXCkpPyk/L2d1O1xyXG5cclxuXHRcdFx0Y29uc3QgcGFyZW50RGlyZWN0b3J5ID0gcGF0aC5kaXJuYW1lKGZpbGVQYXRoKTtcclxuXHJcblx0XHRcdGlmIChuZXdVcmxSZWdFeC50ZXN0KGNvbnRlbnRzKSkge1xyXG5cdFx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0XHRcImNvbnRlbnRzXCI6IGNvbnRlbnRzLnJlcGxhY2UobmV3VXJsUmVnRXgsIGZ1bmN0aW9uKF8sIG1hdGNoKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHBhcmVudERpcmVjdG9yeSwgbWF0Y2gpO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCFleGlzdHNTeW5jKGZpbGVQYXRoKSkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGZpbGVQYXRoLmVuZHNXaXRoKFwiLmpzb25cIikpIHtcclxuXHRcdFx0XHRcdFx0XHR3cml0ZUZpbGVTeW5jKGZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeShKU09ONS5wYXJzZShyZWFkRmlsZVN5bmMoZmlsZVBhdGgsIHsgXCJlbmNvZGluZ1wiOiBcInV0ZjhcIiB9KSkpKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChmaWxlUGF0aC5lbmRzV2l0aChcIi5tcDNcIikpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gXCJcXFwiZGF0YTphdWRpby9tcGVnO2Jhc2U2NCxcXFwiXCI7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGNvcHlGaWxlU3luYyhmaWxlUGF0aCwgcGF0aC5qb2luKGRpc3REaXJlY3RvcnksIHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpKSk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gXCJcXFwiL2Rpc3QvYXNzZXRzL1wiICsgcGF0aC5iYXNlbmFtZShmaWxlUGF0aCkucmVwbGFjZSgvXFxcXC9ndSwgXCIvXCIpICsgXCJcXFwiXCI7XHJcblxyXG5cdFx0XHRcdFx0XHQvL3JldHVybiBcIlxcXCIuL1wiICsgcGF0aC5yZWxhdGl2ZShwYXJlbnREaXJlY3RvcnksIGZpbGVQYXRoKS5yZXBsYWNlKC9cXFxcL2d1LCBcIi9cIikgKyBcIlxcXCJcIjtcclxuXHJcblx0XHRcdFx0XHRcdC8vcmV0dXJuIGBcImRhdGE6JHttaW1lVHlwZX07Y2hhcnNldD1VVEYtODtiYXNlNjQsJHtkYXRhfVwiYDtcclxuXHRcdFx0XHRcdH0pLFxyXG5cdFx0XHRcdFx0XCJsb2FkZXJcIjogcGF0aC5leHRuYW1lKGZpbGVQYXRoKS5zdWJzdHJpbmcoMSlcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcbn07XHJcblxyXG4vLyBDaHVua3NcclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZpbmRQYXJlbnRQYWNrYWdlSnNvbihkaXJlY3RvcnkpIHtcclxuXHRpZiAoZXhpc3RzU3luYyhwYXRoLmpvaW4oZGlyZWN0b3J5LCBcInBhY2thZ2UuanNvblwiKSkpIHtcclxuXHRcdHJldHVybiBwYXRoLmpvaW4oZGlyZWN0b3J5LCBcInBhY2thZ2UuanNvblwiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZpbmRQYXJlbnRQYWNrYWdlSnNvbihwYXRoLmRpcm5hbWUoZGlyZWN0b3J5KSk7XHJcblx0fVxyXG59XHJcblxyXG5jb25zdCBjaHVua3NEaXJlY3RvcnkgPSBwYXRoLmpvaW4oX19kaXJuYW1lLCBcImNodW5rc1wiKTtcclxuXHJcbmF3YWl0IGZzLnJtKGNodW5rc0RpcmVjdG9yeSwgeyBcInJlY3Vyc2l2ZVwiOiB0cnVlIH0pO1xyXG5cclxuYXdhaXQgZnMubWtkaXIoY2h1bmtzRGlyZWN0b3J5LCB7IFwicmVjdXJzaXZlXCI6IHRydWUgfSk7XHJcblxyXG5hc3luYyBmdW5jdGlvbiBtYW51YWxDaHVua3MoY2h1bmtBbGlhc2VzOiB7IFtjaHVua0FsaWFzOiBzdHJpbmddOiBzdHJpbmdbXSB9KSB7XHJcblx0cmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhhd2FpdCBQcm9taXNlLmFsbChcclxuXHRcdE9iamVjdC5lbnRyaWVzKGNodW5rQWxpYXNlcykubWFwKGFzeW5jIGZ1bmN0aW9uKFtjaHVua0FsaWFzLCBtb2R1bGVzXSkge1xyXG5cdFx0XHRpZiAoIWV4aXN0c1N5bmMocGF0aC5qb2luKGNodW5rc0RpcmVjdG9yeSwgY2h1bmtBbGlhcyArIFwiLnRzXCIpKSkge1xyXG5cdFx0XHRcdGNvbnN0IGRlcGVuZGVuY2llcyA9IFsuLi5uZXcgU2V0KChhd2FpdCBQcm9taXNlLmFsbChtb2R1bGVzLm1hcChhc3luYyBmdW5jdGlvbihtb2R1bGUpIHtcclxuXHRcdFx0XHRcdGxldCBtb2R1bGVQYXRoO1xyXG5cclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdG1vZHVsZVBhdGggPSB1cmwuZmlsZVVSTFRvUGF0aChyZXNvbHZlKG1vZHVsZSwgaW1wb3J0Lm1ldGEudXJsKSk7XHJcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xyXG5cdFx0XHRcdFx0XHRtb2R1bGVQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCJub2RlX21vZHVsZXNcIiwgbW9kdWxlKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICghZXhpc3RzU3luYyhtb2R1bGVQYXRoKSkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBbXTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IGF3YWl0IGZpbmRQYXJlbnRQYWNrYWdlSnNvbihtb2R1bGVQYXRoKTtcclxuXHJcblx0XHRcdFx0XHRjb25zdCBwYWNrYWdlSnNvbiA9IGF3YWl0IGZzLnJlYWRGaWxlKHBhY2thZ2VKc29uUGF0aCwgeyBcImVuY29kaW5nXCI6IFwidXRmOFwiIH0pO1xyXG5cclxuXHRcdFx0XHRcdHJldHVybiAoYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmtleXMoSlNPTi5wYXJzZShwYWNrYWdlSnNvbikuZGVwZW5kZW5jaWVzID8/IHt9KS5tYXAoZnVuY3Rpb24obW9kdWxlKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKGV4aXN0c1N5bmMocGF0aC5qb2luKF9fZGlybmFtZSwgXCJub2RlX21vZHVsZXNcIiwgbW9kdWxlKSkgPyBtb2R1bGUgOiB1bmRlZmluZWQpO1xyXG5cdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdH0pKSkuZmlsdGVyKGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQgIT09IHVuZGVmaW5lZDtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pKSkuZmxhdChJbmZpbml0eSkpXTtcclxuXHJcblx0XHRcdFx0YXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihjaHVua3NEaXJlY3RvcnksIGNodW5rQWxpYXMgKyBcIi50c1wiKSwgZGVwZW5kZW5jaWVzLm1hcChmdW5jdGlvbihtb2R1bGUpIHtcclxuXHRcdFx0XHRcdHJldHVybiBcImltcG9ydCBcXFwiXCIgKyBtb2R1bGUgKyBcIlxcXCI7XFxuXCI7XHJcblx0XHRcdFx0fSkpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gW1wiZGlzdC9cIiArIGNodW5rQWxpYXMsIHBhdGguam9pbihcImNodW5rc1wiLCBjaHVua0FsaWFzICsgXCIudHNcIildO1xyXG5cdFx0fSlcclxuXHQpKTtcclxufVxyXG5cclxuLy8gV29ya2Vyc1xyXG5cclxuY29uc3QgaW5saW5lV29ya2VyUGx1Z2luID0ge1xyXG5cdFwibmFtZVwiOiBcImlubGluZS13b3JrZXJcIixcclxuXHRcInNldHVwXCI6IGZ1bmN0aW9uKGJ1aWxkKSB7XHJcblx0XHRhc3luYyBmdW5jdGlvbiBidWlsZFdvcmtlcih3b3JrZXJQYXRoKSB7XHJcblx0XHRcdGF3YWl0IHRzdXAoe1xyXG5cdFx0XHRcdFwiY29uZmlnXCI6IGZhbHNlLFxyXG5cdFx0XHRcdFwiZW50cnlcIjogW3dvcmtlclBhdGhdLFxyXG5cdFx0XHRcdFwiZXNidWlsZFBsdWdpbnNcIjogW1xyXG5cdFx0XHRcdFx0bm9kZU1vZHVsZXNQb2x5ZmlsbFBsdWdpbigpLFxyXG5cdFx0XHRcdFx0bmV3VXJsVG9EYXRhVXJsUGx1Z2luXHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybiBmcy5yZWFkRmlsZShwYXRoLmpvaW4oX19kaXJuYW1lLCBcImRpc3RcIiwgcGF0aC5iYXNlbmFtZSh3b3JrZXJQYXRoLCBwYXRoLmV4dG5hbWUod29ya2VyUGF0aCkpICsgXCIuanNcIiksIHsgXCJlbmNvZGluZ1wiOiBcInV0ZjhcIiB9KTtcclxuXHRcdH1cclxuXHJcblx0XHRidWlsZC5vbkxvYWQoeyBcImZpbHRlclwiOiAvXFwud29ya2VyKD86XFwuanN4P3xcXC50c3g/fFxcP3dvcmtlcik/JC91IH0sIGFzeW5jIGZ1bmN0aW9uKHsgXCJwYXRoXCI6IHdvcmtlclBhdGggfSkge1xyXG5cdFx0XHRjb25zdCB3b3JrZXJDb2RlID0gYXdhaXQgYnVpbGRXb3JrZXIod29ya2VyUGF0aCk7XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFwiY29udGVudHNcIjogYFxyXG5cdFx0XHRcdFx0aW1wb3J0IGlubGluZVdvcmtlciBmcm9tICdfX2lubGluZS13b3JrZXInO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBXb3JrZXIoKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiBpbmxpbmVXb3JrZXIoJHtKU09OLnN0cmluZ2lmeSh3b3JrZXJDb2RlKX0pO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdGAsXHJcblx0XHRcdFx0XCJsb2FkZXJcIjogXCJqc1wiXHJcblx0XHRcdH07XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb25zdCBpbmxpbmVXb3JrZXJGdW5jdGlvbkNvZGUgPSBgXHJcblx0XHRcdGV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGlubGluZVdvcmtlcihzY3JpcHRUZXh0KSB7XHJcblx0XHRcdFx0Y29uc3QgYmxvYiA9IG5ldyBCbG9iKFtzY3JpcHRUZXh0XSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KTtcclxuXHRcdFx0XHRjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG5cdFx0XHRcdGNvbnN0IHdvcmtlciA9IG5ldyBXb3JrZXIodXJsKTtcclxuXHRcdFx0XHRVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcblx0XHRcdFx0cmV0dXJuIHdvcmtlcjtcclxuXHRcdFx0fVxyXG5cdFx0YDtcclxuXHJcblx0XHRidWlsZC5vblJlc29sdmUoeyBcImZpbHRlclwiOiAvXl9faW5saW5lLXdvcmtlciQvdSB9LCBmdW5jdGlvbih7IHBhdGggfSkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFwicGF0aFwiOiBwYXRoLFxyXG5cdFx0XHRcdFwibmFtZXNwYWNlXCI6IFwiaW5saW5lLXdvcmtlclwiXHJcblx0XHRcdH07XHJcblx0XHR9KTtcclxuXHJcblx0XHRidWlsZC5vbkxvYWQoeyBcImZpbHRlclwiOiAvLiovdSwgXCJuYW1lc3BhY2VcIjogXCJpbmxpbmUtd29ya2VyXCIgfSwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0XCJjb250ZW50c1wiOiBpbmxpbmVXb3JrZXJGdW5jdGlvbkNvZGUsXHJcblx0XHRcdFx0XCJsb2FkZXJcIjogXCJqc1wiXHJcblx0XHRcdH07XHJcblx0XHR9KTtcclxuXHR9XHJcbn07XHJcblxyXG5jb25zdCB3b3JrZXJzID0ge307XHJcblxyXG5pZiAoZXhpc3RzU3luYyhjaHVua3NEaXJlY3RvcnkpKSB7XHJcblx0XHJcbn0gZWxzZSB7XHJcblx0YXdhaXQgdHN1cCh7XHJcblx0XHRcImNvbmZpZ1wiOiBmYWxzZSxcclxuXHRcdFwiZW50cnlcIjogW1wibWFpbi50c1wiXSxcclxuXHRcdFwiZXNidWlsZFBsdWdpbnNcIjogW1xyXG5cdFx0XHR7XHJcblx0XHRcdFx0XCJuYW1lXCI6IFwiZW51bWVyYXRlLXdvcmtlcnNcIixcclxuXHRcdFx0XHRcInNldHVwXCI6IGZ1bmN0aW9uKGJ1aWxkKSB7XHJcblx0XHRcdFx0XHRidWlsZC5vbkxvYWQoeyBcImZpbHRlclwiOiAvXFwud29ya2VyKD86XFwuanN4P3xcXC50c3g/fFxcP3dvcmtlcik/JC91IH0sIGFzeW5jIGZ1bmN0aW9uKHsgXCJwYXRoXCI6IHdvcmtlclBhdGggfSkge1xyXG5cdFx0XHRcdFx0XHR3b3JrZXJQYXRoID0gcGF0aC5yZWxhdGl2ZShfX2Rpcm5hbWUsIHdvcmtlclBhdGgpLnNwbGl0KFwiP1wiKVswXS5yZXBsYWNlKC9cXFxcL2d1LCBcIi9cIik7XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCB3b3JrZXJDaHVua1BhdGggPSBwYXRoLmpvaW4oY2h1bmtzRGlyZWN0b3J5LCBwYXRoLmJhc2VuYW1lKHdvcmtlclBhdGgsIHBhdGguZXh0bmFtZSh3b3JrZXJQYXRoKSkgKyBcIi50c1wiKTtcclxuXHJcblx0XHRcdFx0XHRcdHdvcmtlcnNbcGF0aC5iYXNlbmFtZSh3b3JrZXJQYXRoLCBwYXRoLmV4dG5hbWUod29ya2VyUGF0aCkpXSA9IFt3b3JrZXJDaHVua1BhdGhdO1xyXG5cclxuXHRcdFx0XHRcdFx0YXdhaXQgZnMud3JpdGVGaWxlKHdvcmtlckNodW5rUGF0aCwgXCJpbXBvcnQgXFxcIi4uL1wiICsgd29ya2VyUGF0aCArIFwiXFxcIjtcXG5cIik7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFx0XHRcdFwiY29udGVudHNcIjogYFxyXG5cdFx0XHRcdFx0XHRcdFx0ZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbm9vcCgpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdGAsXHJcblx0XHRcdFx0XHRcdFx0XCJsb2FkZXJcIjogXCJqc1wiXHJcblx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdF1cclxuXHR9KTtcclxufVxyXG5cclxuYXdhaXQgZnMucm0ocGF0aC5qb2luKF9fZGlybmFtZSwgXCJkaXN0XCIpLCB7IFwicmVjdXJzaXZlXCI6IHRydWUgfSk7XHJcblxyXG5hd2FpdCBmcy5ta2RpcihkaXN0RGlyZWN0b3J5LCB7IFwicmVjdXJzaXZlXCI6IHRydWUgfSk7XHJcblxyXG4vLyBNYWluIENvbmZpZ1xyXG5cclxuY29uc29sZS5sb2coe1xyXG5cdFwiZGlzdC9tYWluXCI6IFwibWFpbi50c1wiLFxyXG5cdC4uLmF3YWl0IG1hbnVhbENodW5rcyh7XHJcblx0XHRcIm1vbmFjb1wiOiBbXHJcblx0XHRcdFwibW9uYWNvLWVkaXRvci9lc20vdnMvZWRpdG9yL2VkaXRvci5hcGkuanNcIixcclxuXHRcdFx0XCIuL21vbmFjby9kZW1vL3NyYy9zZXR1cC50c1wiLFxyXG5cdFx0XHRcInZzY29kZS9kaXN0L2V4dGVuc2lvbnMuanNcIixcclxuXHRcdFx0XCJ2c2NvZGUvZGlzdC9kZWZhdWx0LWV4dGVuc2lvbnNcIlxyXG5cdFx0XSxcclxuXHRcdC4uLndvcmtlcnNcclxuXHR9KVxyXG59KTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcblx0XCJlbnRyeVwiOiB7XHJcblx0XHRcImRpc3QvbWFpblwiOiBcIm1haW4udHNcIixcclxuXHRcdC4uLmF3YWl0IG1hbnVhbENodW5rcyh7XHJcblx0XHRcdFwibW9uYWNvXCI6IFtcclxuXHRcdFx0XHRcIm1vbmFjby1lZGl0b3IvZXNtL3ZzL2VkaXRvci9lZGl0b3IuYXBpLmpzXCIsXHJcblx0XHRcdFx0XCIuL21vbmFjby9kZW1vL3NyYy9zZXR1cC50c1wiLFxyXG5cdFx0XHRcdFwidnNjb2RlL2Rpc3QvZXh0ZW5zaW9ucy5qc1wiLFxyXG5cdFx0XHRcdFwidnNjb2RlL2Rpc3QvZGVmYXVsdC1leHRlbnNpb25zXCJcclxuXHRcdFx0XSxcclxuXHRcdFx0Li4ud29ya2Vyc1xyXG5cdFx0fSlcclxuXHR9LFxyXG5cdFwiZXNidWlsZE9wdGlvbnNcIjogZXNidWlsZE9wdGlvbnMsXHJcblx0XCJlc2J1aWxkUGx1Z2luc1wiOiBbXHJcblx0XHQvLyBUaGlzIGNhbiBiZSByZW1vdmVkIGFmdGVyIHdlIGZpZ3VyZSBvdXQgaWYgd2UgbmVlZCBgdG9Dcm9zc09yaWdpbldvcmtlcmAgb3IgYHRvV29ya2VyQ29uZmlnYC5cclxuXHRcdHtcclxuXHRcdFx0XCJuYW1lXCI6IFwicmVzb2x2ZS13b3JrZXJcIixcclxuXHRcdFx0XCJzZXR1cFwiOiBmdW5jdGlvbihidWlsZCkge1xyXG5cdFx0XHRcdC8vYnVpbGQub25SZXNvbHZlKHsgXCJmaWx0ZXJcIjogL1xcP3dvcmtlciQvdSB9LCBmdW5jdGlvbih7IFwicGF0aFwiOiBmaWxlUGF0aCB9KSB7XHJcblx0XHRcdFx0Ly9cdHJldHVybiB7XHJcblx0XHRcdFx0Ly9cdFx0XCJwYXRoXCI6IHVybC5maWxlVVJMVG9QYXRoKHJlc29sdmUoZmlsZVBhdGgucmVwbGFjZSgvXFw/d29ya2VyJC91LCBcIlwiKSwgaW1wb3J0Lm1ldGEudXJsKSlcclxuXHRcdFx0XHQvL1x0fTtcclxuXHRcdFx0XHQvL30pO1xyXG5cclxuXHRcdFx0XHRidWlsZC5vbkxvYWQoeyBcImZpbHRlclwiOiAvdG9vbHMoPzpcXC98XFxcXCl3b3JrZXJzXFwudHMkL3UgfSwgZnVuY3Rpb24oYXJncykge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRcdFx0XCJjb250ZW50c1wiOiBgXHJcblx0XHRcdFx0XHRcdFx0ZXhwb3J0IGZ1bmN0aW9uIHRvQ3Jvc3NPcmlnaW5Xb3JrZXIod29ya2VyKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd29ya2VyO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdFx0ZXhwb3J0IGZ1bmN0aW9uIHRvV29ya2VyQ29uZmlnKHdvcmtlcikge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdvcmtlcjtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGAsXHJcblx0XHRcdFx0XHRcdFwibG9hZGVyXCI6IFwidHNcIlxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHRcdG5ld1VybFRvRGF0YVVybFBsdWdpbixcclxuXHRcdGlubGluZVdvcmtlclBsdWdpblxyXG5cdF0sXHJcblx0XCJsb2FkZXJcIjoge1xyXG5cdFx0XCIuY29kZS1zbmlwcGV0c1wiOiBcImpzb25cIixcclxuXHRcdC8vXCIuaHRtbFwiOiBcImNvcHlcIixcclxuXHRcdFwiLmQudHNcIjogXCJjb3B5XCIsXHJcblx0XHRcIi5tYXBcIjogXCJlbXB0eVwiLFxyXG5cdFx0XCIuc3ZnXCI6IFwiZGF0YXVybFwiLFxyXG5cdFx0XCIudG1MYW5ndWFnZVwiOiBcImRhdGF1cmxcIlxyXG5cdH0sXHJcblx0XCJleHRlcm5hbFwiOiBbXHJcblx0XHRcImZvbnRzXCJcclxuXHRdLFxyXG5cdFwidHJlZXNoYWtlXCI6IHRydWVcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1EsU0FBUyxvQkFBb0I7QUFDN1IsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxjQUFjLFlBQVksWUFBWSxJQUFJLGNBQWMscUJBQXFCO0FBQ3RGLFNBQVMsZUFBZTtBQUN4QixZQUFZLFVBQVU7QUFDdEIsWUFBWSxTQUFTO0FBQ3JCLE9BQU8s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QUFDO0FBQUEsRUFDRjtBQUFBLEVBQ0Esa0JBQWtCO0FBQUEsRUFDbEIsa0JBQWtCO0FBQUE7QUFBQSxJQUVqQjtBQUFBLE1BQ0MsUUFBUTtBQUFBLE1BQ1IsU0FBUyxTQUFTLE9BQU87QUFPeEIsY0FBTSxPQUFPLEVBQUUsVUFBVSw4QkFBOEIsR0FBRyxTQUFTLE1BQU07QUFDeEUsaUJBQU87QUFBQSxZQUNOLFlBQVk7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFTWixVQUFVO0FBQUEsVUFDWDtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNEO0FBQUEsRUFDQSxVQUFVO0FBQUEsSUFDVCxrQkFBa0I7QUFBQTtBQUFBLElBRWxCLFNBQVM7QUFBQSxJQUNULFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxFQUNoQjtBQUFBLEVBQ0EsWUFBWTtBQUFBLElBQ1g7QUFBQSxFQUNEO0FBQUEsRUFDQSxhQUFhO0FBQ2QsQ0FBQzsiLAogICJuYW1lcyI6IFsiZmlsZVBhdGgiLCAibW9kdWxlIiwgInJlc29sdmUiLCAicGF0aCJdCn0K
