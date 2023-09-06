import { createModelReference, monaco, vscode } from "./monaco";

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
	//vscode.workspace.openTextDocument(monaco.Uri.file("/tmp/test_readonly.js")) // open the file so vscode sees it's locked
]);
await vscode.window.showTextDocument(mainDocument, {
	"preview": false
});

const diagnostics = vscode.languages.createDiagnosticCollection("demo");
diagnostics.set(modelRef.object.textEditorModel.uri, [{
	"range": new vscode.Range(2, 9, 2, 12),
	"severity": vscode.DiagnosticSeverity.Error,
	"message": "This is not a real error, just a demo, don't worry",
	"source": "Demo",
	"code": 42
}]);

await createModelReference(monaco.Uri.from({ "scheme": "user", "path": "/settings.json" }), JSON.stringify({
	"workbench.colorTheme": "Default Light+",
	"editor.fontSize": 14
}, undefined, "\t"));
