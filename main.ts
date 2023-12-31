import { ExtensionHostKind, createModelReference, monaco, registerExtension, vscode } from "./monaco";

const extensionManifest = new URL("./extensions/hello-world/package.json", import.meta.url).toString();

const { registerFileUrl } = registerExtension(await (await fetch(extensionManifest)).json(), ExtensionHostKind.LocalProcess);

registerFileUrl("/package.json", extensionManifest);
registerFileUrl("/extension.js", new URL("./extensions/hello-world/extension.ts", import.meta.url).toString());
registerFileUrl("/server.js", new URL("./extensions/hello-world/server.ts", import.meta.url).toString());

const modelReference = await createModelReference(monaco.Uri.file("/tmp/test.js"), `// import anotherfile
let variable = 1
function inc () {
	variable++
}

while (variable < 5000) {
	inc()
	console.log('Hello world', variable);
}`);

const mainDocument = await vscode.workspace.openTextDocument(modelReference.object.textEditorModel.uri);

await vscode.window.showTextDocument(mainDocument, {
	"preview": false
});

globalThis.monaco = monaco;
globalThis.vscode = vscode;

setTimeout(function() {
	console.info("`monaco` and `vscode` have been made available as a browser globals.");
}, 1000);
