import { createModelReference, monaco, vscode } from "./monaco";

//registerExtension(new URL("./extensions/hello-world/manifest.json", import.meta.url), async () => fileContent)

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

await createModelReference(monaco.Uri.from({ "scheme": "user", "path": "/settings.json" }), JSON.stringify({
	"workbench.colorTheme": "Default Light+"
}, undefined, "\t"));
