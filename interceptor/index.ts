import { existsSync, promises as fs } from "fs";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { __root } from "../config";
import { intercept } from "./interceptor";

let destroy;

for (const signal of ["SIGINT", "SIGUSR1", "SIGUSR2"]) {
	process.on(signal, function() {
		destroy?.();
	});
}

destroy = await intercept("http://localhost:4173/", {
	"onIntercept": function(filePath, data) {
		return [filePath, data];
	},
	"postcondition": function() {
		return new Promise(function() {});
	},
	"distDirectory": path.join(__dirname, "interceptor", "dist")
});

console.log("\n---\n");

destroy();
