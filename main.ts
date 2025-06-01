import { getService } from '@codingame/monaco-vscode-api'
import {
	IStorageService,
	IWorkbenchLayoutService,
	getService,
	initialize as initializeMonacoService
} from '@codingame/monaco-vscode-api'
import getQuickAccessServiceOverride from '@codingame/monaco-vscode-quickaccess-service-override'
import { BrowserStorageService } from '@codingame/monaco-vscode-storage-service-override'
import { ExtensionHostKind } from '@codingame/monaco-vscode-extensions-service-override'
import { registerExtension } from '@codingame/monaco-vscode-api/extensions'
import getViewsServiceOverride, { isEditorPartVisible, Parts, attachPart, onDidChangeSideBarPosition } from '@codingame/monaco-vscode-views-service-override'
import { openNewCodeEditor } from './demo/src/features/editor'
import { commonServices, constructOptions, envOptions, remoteAuthority, userDataProvider } from './demo/src/setup.common'

// Override services
await initializeMonacoService(
	{
		...commonServices,
		...getViewsServiceOverride(openNewCodeEditor, undefined),

		...getQuickAccessServiceOverride({
			isKeybindingConfigurationVisible: isEditorPartVisible,
			shouldUseGlobalPicker: (_editor, isStandalone) => !isStandalone && isEditorPartVisible()
		})
	},
	document.body,
	constructOptions,
	envOptions
)

for (const config of [
	{
		part: Parts.SIDEBAR_PART,
		get element() {
			return '#sidebar'
		},
		onDidElementChange: onDidChangeSideBarPosition
	},
	{ part: Parts.PANEL_PART, element: '#console' },
	{ part: Parts.EDITOR_PART, element: '#editors' },
	{ part: Parts.STATUSBAR_PART, element: '#statusbar' },
	{
		part: Parts.AUXILIARYBAR_PART,
		get element() {
			return '#auxbar'
		},
		onDidElementChange: onDidChangeSideBarPosition
	}
]) {
	attachPart(config.part, document.querySelector<HTMLDivElement>(config.element)!)
}

await getService(IWorkbenchLayoutService)

await registerExtension(
	{
		name: 'demo',
		publisher: 'codingame',
		version: '1.0.0',
		engines: {
			vscode: '*'
		}
	},
	ExtensionHostKind.LocalProcess
).setAsDefaultApi()

export { remoteAuthority }
import { ExtensionHostKind, registerExtension } from '@codingame/monaco-vscode-api/extensions'
import { useHtmlFileSystemProvider } from './demo/src/setup.common'
import '@codingame/monaco-vscode-clojure-default-extension'
import '@codingame/monaco-vscode-coffeescript-default-extension'
import '@codingame/monaco-vscode-cpp-default-extension'
import '@codingame/monaco-vscode-csharp-default-extension'
import '@codingame/monaco-vscode-css-default-extension'
import '@codingame/monaco-vscode-diff-default-extension'
import '@codingame/monaco-vscode-fsharp-default-extension'
import '@codingame/monaco-vscode-go-default-extension'
import '@codingame/monaco-vscode-groovy-default-extension'
import '@codingame/monaco-vscode-html-default-extension'
import '@codingame/monaco-vscode-java-default-extension'
import '@codingame/monaco-vscode-javascript-default-extension'
import '@codingame/monaco-vscode-json-default-extension'
import '@codingame/monaco-vscode-julia-default-extension'
import '@codingame/monaco-vscode-lua-default-extension'
import '@codingame/monaco-vscode-markdown-basics-default-extension'
import '@codingame/monaco-vscode-objective-c-default-extension'
import '@codingame/monaco-vscode-perl-default-extension'
import '@codingame/monaco-vscode-php-default-extension'
import '@codingame/monaco-vscode-powershell-default-extension'
import '@codingame/monaco-vscode-python-default-extension'
import '@codingame/monaco-vscode-r-default-extension'
import '@codingame/monaco-vscode-ruby-default-extension'
import '@codingame/monaco-vscode-rust-default-extension'
import '@codingame/monaco-vscode-scss-default-extension'
import '@codingame/monaco-vscode-shellscript-default-extension'
import '@codingame/monaco-vscode-sql-default-extension'
import '@codingame/monaco-vscode-swift-default-extension'
import '@codingame/monaco-vscode-typescript-basics-default-extension'
import '@codingame/monaco-vscode-vb-default-extension'
import '@codingame/monaco-vscode-xml-default-extension'
import '@codingame/monaco-vscode-yaml-default-extension'
import '@codingame/monaco-vscode-theme-defaults-default-extension'
import '@codingame/monaco-vscode-theme-seti-default-extension'
import '@codingame/monaco-vscode-references-view-default-extension'
import '@codingame/monaco-vscode-search-result-default-extension'
import '@codingame/monaco-vscode-configuration-editing-default-extension'
import '@codingame/monaco-vscode-markdown-math-default-extension'
import '@codingame/monaco-vscode-npm-default-extension'
import '@codingame/monaco-vscode-media-preview-default-extension'
import '@codingame/monaco-vscode-ipynb-default-extension'

const { getApi } = registerExtension(
	{
		name: 'demo-main',
		publisher: 'codingame',
		version: '1.0.0',
		engines: {
			vscode: '*'
		}
	},
	ExtensionHostKind.LocalProcess
)

/*
void getApi().then(async (vscode) => {
	if (!useHtmlFileSystemProvider) {
		const mainModelUri = vscode.Uri.file('/workspace/test.js')
		await Promise.all([
			vscode.workspace.openTextDocument(mainModelUri),
			vscode.workspace.openTextDocument(monaco.Uri.file('/workspace/test_readonly.js')) // open the file so vscode sees it's locked
		])

		const diagnostics = vscode.languages.createDiagnosticCollection('demo')
		diagnostics.set(mainModelUri, [
			{
				range: new vscode.Range(2, 9, 2, 12),
				severity: vscode.DiagnosticSeverity.Error,
				message: "This is not a real error, just a demo, don't worry",
				source: 'Demo',
				code: 42
			}
		])
	}
})
*/
