import { chromium } from "playwright-chromium";
import { existsSync, promises as fs } from "fs";
import * as path from "path";
import type { Browser, BrowserContext, Page } from "playwright-chromium";

import { __root } from "../config";

let browser: Browser;

let context: BrowserContext;

async function writeFileIfChanged(filePath, data) {
	if (filePath === undefined || data === undefined) {
		return;
	}

	if (!existsSync(path.dirname(filePath))) {
		await fs.mkdir(path.dirname(filePath), { "recursive": true });
	}

	if (!existsSync(filePath)) {
		console.log("Saving " + filePath);

		return fs.writeFile(filePath, data);
	}

	if (!(data instanceof Buffer)) {
		data = Buffer.from(data, "utf8");
	}

	if (!data.equals(await fs.readFile(filePath))) {
		console.log("Saving " + filePath);

		fs.writeFile(filePath, data);
	}
}

function download({ onIntercept, distDirectory }: { onIntercept: (filePath, data) => [string, Buffer | string]; distDirectory }) {
	return async function(response) {
		const { hostname, pathname } = new URL(response.url());

		let baseName = path.basename(pathname);
		baseName ||= "index";

		if (baseName === path.basename(baseName, path.extname(baseName)) && response.headers()["Content-Type".toLowerCase()]?.includes("text/html")) {
			baseName += ".html";
		}

		const filePath = path.join(distDirectory, baseName);

		try {
			const data = await response.text();

			writeFileIfChanged(...onIntercept(filePath, data));
		} catch (error) {
			// FIXME: Shouldn't use errors for flow control.
			if (!/response.text is not a function|is unavailable|no resource with given identifier/ui.test(error.message)) {
				throw error;
			}

			try {
				if (/\.(html|js)$/ui.test(pathname)) {
					const data = await (await fetch(response.url())).text();

					writeFileIfChanged(...onIntercept(filePath, data));
				} else {
					const data = await (await fetch(response.url())).arrayBuffer();

					writeFileIfChanged(...onIntercept(filePath, new Uint8Array(data)));
				}
			} catch (error) {
				if (!/did not match/ui.test(error.message)) {
					console.error("Really failed to get " + response.url());
				} else {
					throw error;
				}
			}
		}
	};
}

export async function intercept(url, { precondition = undefined, postcondition = undefined, onIntercept, distDirectory }) {
	function noop() {
		return Promise.resolve();
	}

	precondition ??= noop;
	onIntercept ??= noop;

	browser ??= await chromium.launch({
		"args": [
			"--disable-web-security"
		],
		"devtools": true,
		"headless": false
	});

	context ??= await browser.newContext();

	const fallbackDomain = path.basename(new URL(".", url).pathname);

	const serviceWorkerListener = download({
		"onIntercept": onIntercept,
		"distDirectory": distDirectory
	});

	context.on("serviceworker", serviceWorkerListener);

	const page: Page = await context.newPage();

	page.on("response", download({
		"onIntercept": onIntercept,
		"distDirectory": distDirectory
	}));

	await page.goto(url);

	await precondition(page);

	if (postcondition !== undefined && !(await postcondition(distDirectory))) {
		throw new Error("Post condition not met for `" + url + "`!");
	}

	await page.close();

	context.removeListener("serviceworker", serviceWorkerListener);

	return function destroy() {
		return [
			context.close(),
			browser.close()
		].reduce(function(previous, next) {
			// @ts-expect-error
			return previous.then(next);
		}, Promise.resolve());
	};
}
