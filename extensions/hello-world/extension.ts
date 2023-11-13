import * as vscode from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/browser";

function createWorkerLanguageClient(context: vscode.ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a worker. The worker main file implements the language server.
	const serverMain = new URL("./server.ts", import.meta.url).toString(); //vscode.Uri.joinPath(context.extensionUri, 'server.js');
	const worker = new Worker(serverMain.toString());

	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('lsp-web-extension-sample', 'LSP Web Extension Sample', clientOptions, worker);
}

export function activate(context: vscode.ExtensionContext) {
	const documentSelector = [{ language: 'plaintext' }];

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		synchronize: {},
		initializationOptions: {}
	};

	const client = createWorkerLanguageClient(context, clientOptions);

	const disposable = client.start();
	context.subscriptions.push(disposable);

	client.onReady().then(() => {
		console.log('lsp-web-extension-sample server is ready');
	});
}

export function deactivate() { }
