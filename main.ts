import {
	IDialogService,
	IEditorService,
	IPreferencesService,
	StandaloneServices,
	createInstance,
	getService
} from '@codingame/monaco-vscode-api'
import * as monaco from 'monaco-editor'
import {
	defaultUserConfigurationFile,
	updateUserConfiguration
} from '@codingame/monaco-vscode-configuration-service-override'
import {
	defaultUserKeybindindsFile,
	updateUserKeybindings
} from '@codingame/monaco-vscode-keybindings-service-override'
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
import getViewsServiceOverride, {
	isEditorPartVisible,
	Parts,
	onPartVisibilityChange,
	isPartVisibile,
	attachPart,
	getSideBarPosition,
	onDidChangeSideBarPosition,
	Position
} from '@codingame/monaco-vscode-views-service-override'
import { setUnexpectedErrorHandler } from '@codingame/monaco-vscode-api/monaco'
import { openNewCodeEditor } from './demo/src/features/editor'
import './demo/src/features/customView.views'
import {
	commonServices,
	constructOptions,
	envOptions,
	remoteAuthority,
	userDataProvider
} from './demo/src/setup.common'

const container = document.createElement('div')
container.id = 'app'
container.innerHTML = `
<div id="workbench-container">
<div id="titleBar"></div>
<div id="banner"></div>
<div id="workbench-top">
  <div style="display: flex; flex: none; border: 1px solid var(--vscode-editorWidget-border)">
	<div id="activityBar"></div>
	<div id="sidebar" style="width: 400px"></div>
	<div id="auxiliaryBar-left" style="max-width: 300px"></div>
  </div>
  <div style="flex: 1; min-width: 0">
	<h1>Editor</h1>
	<div id="editors"></div>

	<button id="toggleHTMLFileSystemProvider">Toggle HTML filesystem provider</button>
	<button id="customEditorPanel">Open custom editor panel</button>
	<button id="clearStorage">Clear user data</button>
	<button id="resetLayout">Reset layout</button>
	<button id="toggleFullWorkbench">Switch to full workbench mode</button>
	<br />
	<button id="togglePanel">Toggle Panel</button>
	<button id="toggleAuxiliary">Toggle Secondary Panel</button>
  </div>
  <div style="display: flex; flex: none; border: 1px solid var(--vscode-editorWidget-border);">
	<div id="sidebar-right" style="max-width: 500px"></div>
	<div id="activityBar-right"></div>
	<div id="auxiliaryBar" style="max-width: 300px"></div>
  </div>
</div>

<div id="panel"></div>

<div id="statusBar"></div>
</div>

<h1>Settings<span id="settings-dirty">●</span></h1>
<button id="settingsui">Open settings UI</button>
<button id="resetsettings">Reset settings</button>
<div id="settings-editor" class="standalone-editor"></div>
<h1>Keybindings<span id="keybindings-dirty">●</span></h1>
<button id="keybindingsui">Open keybindings UI</button>
<button id="resetkeybindings">Reset keybindings</button>
<div id="keybindings-editor" class="standalone-editor"></div>`

document.body.append(container)

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

setUnexpectedErrorHandler((e) => {
	console.info('Unexpected error', e)
})

for (const config of [
	// { part: Parts.TITLEBAR_PART, element: '#titleBar' },
	// { part: Parts.BANNER_PART, element: '#banner' },
	{
		part: Parts.SIDEBAR_PART,
		get element() {
			return getSideBarPosition() === Position.LEFT ? '#sidebar' : '#sidebar-right'
		},
		onDidElementChange: onDidChangeSideBarPosition
	},
	//{
	// 	part: Parts.ACTIVITYBAR_PART,
	// 	get element() {
	// 		return getSideBarPosition() === Position.LEFT ? '#activityBar' : '#activityBar-right'
	// 	},
	// 	onDidElementChange: onDidChangeSideBarPosition
	//},
	{ part: Parts.PANEL_PART, element: '#panel' },
	{ part: Parts.EDITOR_PART, element: '#editors' },
	{ part: Parts.STATUSBAR_PART, element: '#statusBar' },
	{
		part: Parts.AUXILIARYBAR_PART,
		get element() {
			return getSideBarPosition() === Position.LEFT ? '#auxiliaryBar' : '#auxiliaryBar-left'
		},
		onDidElementChange: onDidChangeSideBarPosition
	}
]) {
	attachPart(config.part, document.querySelector<HTMLDivElement>(config.element)!)

	config.onDidElementChange?.(() => {
		attachPart(config.part, document.querySelector<HTMLDivElement>(config.element)!)
	})

	if (!isPartVisibile(config.part)) {
		document.querySelector<HTMLDivElement>(config.element)!.style.display = 'none'
	}

	onPartVisibilityChange(config.part, (visible) => {
		document.querySelector<HTMLDivElement>(config.element)!.style.display = visible
			? 'block'
			: 'none'
	})
}

const layoutService = await getService(IWorkbenchLayoutService)
document.querySelector('#togglePanel')!.addEventListener('click', async () => {
	layoutService.setPartHidden(layoutService.isVisible(Parts.PANEL_PART, window), Parts.PANEL_PART)
})

document.querySelector('#toggleAuxiliary')!.addEventListener('click', async () => {
	layoutService.setPartHidden(
		layoutService.isVisible(Parts.AUXILIARYBAR_PART, window),
		Parts.AUXILIARYBAR_PART
	)
})

export async function clearStorage(): Promise<void> {
	await userDataProvider.reset()
	await ((await getService(IStorageService)) as BrowserStorageService).clear()
}

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
//import { CustomEditorInput } from './customView.views'
import defaultConfiguration from './demo/src/user/configuration.json'
import defaultKeybindings from './demo/src/user/keybindings.json'
import './demo/src/style.css'
import * as monaco from 'monaco-editor'
import { ExtensionHostKind, registerExtension } from '@codingame/monaco-vscode-api/extensions'
import { useHtmlFileSystemProvider } from './demo/src/setup.common'
//import './demo/src/features/output'
//import './demo/src/features/debugger'
//import './demo/src/features/search'
//import './demo/src/features/intellisense'
//import './demo/src/features/notifications'
//import './demo/src/features/terminal'
//import './demo/src/features/scm'
//import './demo/src/features/testing'
//import './demo/src/features/ai'
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

	document.querySelector('#toggleFullWorkbench')!.addEventListener('click', async () => {
		const url = new URL(window.location.href)
		if (url.searchParams.get('mode') === 'full-workbench') {
			url.searchParams.delete('mode')
		} else {
			url.searchParams.set('mode', 'full-workbench')
		}
		window.location.href = url.toString()
	})

	document.querySelector('#resetLayout')!.addEventListener('click', async () => {
		const url = new URL(window.location.href)
		url.searchParams.set('resetLayout', 'true')
		window.location.href = url.toString()
	})

	document.querySelector('#toggleHTMLFileSystemProvider')!.addEventListener('click', async () => {
		const url = new URL(window.location.href)
		if (url.searchParams.has('htmlFileSystemProvider')) {
			url.searchParams.delete('htmlFileSystemProvider')
		} else {
			url.searchParams.set('htmlFileSystemProvider', 'true')
		}
		window.location.href = url.toString()
	})
})

document.querySelector('#customEditorPanel')!.addEventListener('click', async () => {
	const input = await createInstance(CustomEditorInput, undefined)
	let toggle = false
	const interval = window.setInterval(() => {
		const title = toggle ? 'Awesome editor pane' : 'Incredible editor pane'
		input.setTitle(title)
		input.setName(title)
		input.setDescription(title)
		toggle = !toggle
	}, 1000)
	input.onWillDispose(() => {
		window.clearInterval(interval)
	})

	await StandaloneServices.get(IEditorService).openEditor(input, {
		pinned: true
	})
})

document.querySelector('#clearStorage')!.addEventListener('click', async () => {
	await clearStorage()
})

const settingsEditorEl = document.getElementById('settings-editor')!
const settingsModelReference = await monaco.editor.createModelReference(
	defaultUserConfigurationFile
)
function updateSettingsDirty() {
	document.getElementById('settings-dirty')!.style.display = settingsModelReference.object.isDirty()
		? 'inline'
		: 'none'
}
updateSettingsDirty()
settingsModelReference.object.onDidChangeDirty(updateSettingsDirty)
const settingEditor = monaco.editor.create(settingsEditorEl, {
	model: settingsModelReference.object.textEditorModel,
	automaticLayout: true
})

settingEditor.addAction({
	id: 'custom-action',
	async run() {
		void (await getService(IDialogService)).info('Custom action executed!')
	},
	label: 'Custom action visible in the command palette',
	keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
	contextMenuGroupId: 'custom'
})

const keybindingsEditorEl = document.getElementById('keybindings-editor')!
const keybindingsModelReference = await monaco.editor.createModelReference(
	defaultUserKeybindindsFile
)
function updateKeydinbingsDirty() {
	document.getElementById('keybindings-dirty')!.style.display =
		keybindingsModelReference.object.isDirty() ? 'inline' : 'none'
}
updateKeydinbingsDirty()
keybindingsModelReference.object.onDidChangeDirty(updateKeydinbingsDirty)

monaco.editor.create(keybindingsEditorEl, {
	model: keybindingsModelReference.object.textEditorModel,
	automaticLayout: true
})

document.querySelector('#settingsui')?.addEventListener('click', async () => {
	await StandaloneServices.get(IPreferencesService).openUserSettings()
	window.scrollTo({ top: 0, behavior: 'smooth' })
})

document.querySelector('#resetsettings')?.addEventListener('click', async () => {
	await updateUserConfiguration(defaultConfiguration)
})

document.querySelector('#resetkeybindings')?.addEventListener('click', async () => {
	await updateUserKeybindings(defaultKeybindings)
})

document.querySelector('#keybindingsui')?.addEventListener('click', async () => {
	await StandaloneServices.get(IPreferencesService).openGlobalKeybindingSettings(false)
	window.scrollTo({ top: 0, behavior: 'smooth' })
})
