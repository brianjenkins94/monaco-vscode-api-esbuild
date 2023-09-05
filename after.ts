import { anotherFakeOutputChannel } from "./monaco/demo/src/features/output";
import { createConfiguredEditor, createModelReference } from "vscode/monaco";
import { HTMLFileSystemProvider, registerFileSystemOverlay } from "vscode/service-override/files";
import { IDialogService, ILogService, StandaloneServices, getService } from "vscode/services";
import * as monaco from "monaco-editor";
import * as vscode from "vscode";

const modelRef = await createModelReference(monaco.Uri.file("/tmp/test.js"), `// import anotherfile
let variable = 1
function inc () {
  variable++
}

while (variable < 5000) {
  inc()
  console.log('Hello world', variable);
}`);

const [mainDocument] = await Promise.all([
	vscode.workspace.openTextDocument(modelRef.object.textEditorModel.uri),
	vscode.workspace.openTextDocument(monaco.Uri.file("/tmp/test_readonly.js")) // open the file so vscode sees it's locked
]);
await vscode.window.showTextDocument(mainDocument, {
	"preview": false
});

anotherFakeOutputChannel.replace(mainDocument.getText());
vscode.workspace.onDidChangeTextDocument((e) => {
	if (e.document === mainDocument && e.contentChanges.length > 0) {
		anotherFakeOutputChannel.replace(e.document.getText());
	}
});

const diagnostics = vscode.languages.createDiagnosticCollection("demo");
diagnostics.set(modelRef.object.textEditorModel.uri, [{
	"range": new vscode.Range(2, 9, 2, 12),
	"severity": vscode.DiagnosticSeverity.Error,
	"message": "This is not a real error, just a demo, don't worry",
	"source": "Demo",
	"code": 42
}]);

const settingsModelReference = await createModelReference(monaco.Uri.from({ "scheme": "user", "path": "/settings.json" }), `{
  "workbench.colorTheme": "Default Dark+",
  "workbench.iconTheme": "vs-seti",
  "editor.autoClosingBrackets": "languageDefined",
  "editor.autoClosingQuotes": "languageDefined",
  "editor.scrollBeyondLastLine": true,
  "editor.mouseWheelZoom": true,
  "editor.wordBasedSuggestions": false,
  "editor.acceptSuggestionOnEnter": "on",
  "editor.foldingHighlight": false,
  "editor.semanticHighlighting.enabled": true,
  "editor.bracketPairColorization.enabled": false,
  "editor.fontSize": 12,
  "audioCues.lineHasError": "on",
  "audioCues.onDebugBreak": "on",
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "debug.toolBarLocation": "docked",
  "editor.experimental.asyncTokenization": true,
  "terminal.integrated.tabs.title": "\${sequence}",
  "typescript.tsserver.log": "normal"
}`);
const settingEditor = createConfiguredEditor(document.getElementById("settings-editor")!, {
	"model": settingsModelReference.object.textEditorModel,
	"automaticLayout": true
});

settingEditor.addAction({
	"id": "custom-action",
	"run": async function() {
		void (await getService(IDialogService)).info("Custom action executed!");
	},
	"label": "Custom action visible in the command palette",
	"keybindings": [
		monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK
	],
	"contextMenuGroupId": "custom"
});

const keybindingsModelReference = await createModelReference(monaco.Uri.from({ "scheme": "user", "path": "/keybindings.json" }), `[
  {
    "key": "ctrl+d",
    "command": "editor.action.deleteLines",
    "when": "editorTextFocus"
  }
]`);
createConfiguredEditor(document.getElementById("keybindings-editor")!, {
	"model": keybindingsModelReference.object.textEditorModel,
	"automaticLayout": true
});

document.querySelector("#filesystem")!.addEventListener("click", async () => {
	const dirHandle = await window.showDirectoryPicker();

	const htmlFileSystemProvider = new HTMLFileSystemProvider(undefined, "unused", StandaloneServices.get(ILogService));
	await htmlFileSystemProvider.registerDirectoryHandle(dirHandle);
	registerFileSystemOverlay(1, htmlFileSystemProvider);

	vscode.workspace.updateWorkspaceFolders(0, 0, {
		"uri": vscode.Uri.file(dirHandle.name)
	});
});

document.querySelector("#run")!.addEventListener("click", () => {
	vscode.debug.startDebugging(undefined, {
		"name": "Test",
		"request": "attach",
		"type": "javascript"
	});
});
