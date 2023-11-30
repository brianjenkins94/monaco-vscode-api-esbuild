/* eslint-disable max-lines */

// SOURCE: https://github.com/CodinGame/monaco-vscode-api/blob/main/demo/src/setup.ts

import { IStorageService, LogLevel, getService, initialize as initializeMonacoService } from "vscode/services"
import { ExtensionHostKind, registerExtension, initialize as initializeVscodeExtensions } from "vscode/extensions"

import getModelServiceOverride from "@codingame/monaco-vscode-model-service-override";
import getNotificationServiceOverride from "@codingame/monaco-vscode-notifications-service-override";
import getDialogsServiceOverride from "@codingame/monaco-vscode-dialogs-service-override";
import getConfigurationServiceOverride, { IStoredWorkspace, initUserConfiguration } from "@codingame/monaco-vscode-configuration-service-override";
import getKeybindingsServiceOverride, { initUserKeybindings } from "@codingame/monaco-vscode-keybindings-service-override";
import getTextmateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getAudioCueServiceOverride from "@codingame/monaco-vscode-audio-cue-service-override";
import getExtensionGalleryServiceOverride from "@codingame/monaco-vscode-extension-gallery-service-override";
import getViewsServiceOverride, { IResolvedTextEditorModel, IReference, OpenEditor, isEditorPartVisible, Parts, onPartVisibilityChange, isPartVisibile as isPartVisible, attachPart } from "@codingame/monaco-vscode-views-service-override";
import getBannerServiceOverride from "@codingame/monaco-vscode-view-banner-service-override";
import getStatusBarServiceOverride from "@codingame/monaco-vscode-view-status-bar-service-override";
import getTitleBarServiceOverride from "@codingame/monaco-vscode-view-title-bar-service-override";
import getDebugServiceOverride from "@codingame/monaco-vscode-debug-service-override";
import getPreferencesServiceOverride from "@codingame/monaco-vscode-preferences-service-override";
import getSnippetServiceOverride from "@codingame/monaco-vscode-snippets-service-override";
import getQuickAccessServiceOverride from "@codingame/monaco-vscode-quickaccess-service-override";
import getOutputServiceOverride from "@codingame/monaco-vscode-output-service-override";
import getTerminalServiceOverride, { ITerminalChildProcess, SimpleTerminalBackend, SimpleTerminalProcess } from "@codingame/monaco-vscode-terminal-service-override";
import getSearchServiceOverride from "@codingame/monaco-vscode-search-service-override";
import getMarkersServiceOverride from "@codingame/monaco-vscode-markers-service-override";
import getAccessibilityServiceOverride from "@codingame/monaco-vscode-accessibility-service-override";
import getLanguageDetectionWorkerServiceOverride from "@codingame/monaco-vscode-language-detection-worker-service-override";
import getStorageServiceOverride, { BrowserStorageService } from "@codingame/monaco-vscode-storage-service-override";
import getExtensionServiceOverride from "@codingame/monaco-vscode-extensions-service-override";
import getRemoteAgentServiceOverride from "@codingame/monaco-vscode-remote-agent-service-override";
import getEnvironmentServiceOverride from "@codingame/monaco-vscode-environment-service-override";
import getLifecycleServiceOverride from "@codingame/monaco-vscode-lifecycle-service-override";
import getWorkspaceTrustOverride from "@codingame/monaco-vscode-workspace-trust-service-override";
import getLogServiceOverride from "@codingame/monaco-vscode-log-service-override";

import OutputLinkComputerWorker from "@codingame/monaco-vscode-output-service-override/worker?worker";
import TextMateWorker from "@codingame/monaco-vscode-textmate-service-override/worker?worker";

import ExtensionHostWorker from "vscode/workers/extensionHost.worker?worker";
import LanguageDetectionWorker from "@codingame/monaco-vscode-language-detection-worker-service-override/worker?worker";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";

import * as monaco from "monaco-editor";
import * as vscode from "vscode";

// monaco-vscode-api/demo/src/features/editor.ts
import { createConfiguredEditor, createModelReference } from "vscode/monaco";

let currentEditor: ({
	modelRef: IReference<IResolvedTextEditorModel>
	editor: monaco.editor.IStandaloneCodeEditor
} & monaco.IDisposable) | null = null

const openNewCodeEditor: OpenEditor = async (modelRef) => {
	if (currentEditor != null) {
		currentEditor.dispose()
		currentEditor = null
	}
	const container = document.createElement("div")
	container.style.position = "fixed"
	container.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
	container.style.top = container.style.bottom = container.style.left = container.style.right = "0"
	container.style.cursor = "pointer"

	const editorElem = document.createElement("div")
	editorElem.style.position = "absolute"
	editorElem.style.top = editorElem.style.bottom = editorElem.style.left = editorElem.style.right = "0"
	editorElem.style.margin = "auto"
	editorElem.style.width = "80%"
	editorElem.style.height = "80%"

	container.appendChild(editorElem)

	document.body.appendChild(container)
	try {
		const editor = createConfiguredEditor(
			editorElem,
			{
				model: modelRef.object.textEditorModel,
				readOnly: true,
				automaticLayout: true
			}
		)

		currentEditor = {
			dispose: () => {
				editor.dispose()
				modelRef.dispose()
				document.body.removeChild(container)
				currentEditor = null
			},
			modelRef,
			editor
		}

		editor.onDidBlurEditorWidget(() => {
			currentEditor?.dispose()
		})
		container.addEventListener("mousedown", (event) => {
			if (event.target !== container) {
				return
			}

			currentEditor?.dispose()
		})

		return editor
	} catch (error) {
		document.body.removeChild(container)
		currentEditor = null
		throw error
	}
}

// monaco-vscode-api/demo/src/features/terminal.ts
class TerminalBackend extends SimpleTerminalBackend {
	override getDefaultSystemShell = async (): Promise<string> => "fake"
	override createProcess = async (): Promise<ITerminalChildProcess> => {
		const dataEmitter = new vscode.EventEmitter<string>()
		const propertyEmitter = new vscode.EventEmitter<{
			type: string
			value: string
		}>()
		class FakeTerminalProcess extends SimpleTerminalProcess {
			private column = 0
			async start(): Promise<undefined> {
				//ansiColors.enabled = true
				//dataEmitter.fire(`This is a fake terminal\r\n${ansiColors.green("$")} `)
				setTimeout(() => {
					dataEmitter.fire("\u001B]0;Fake terminal title\u0007")
				}, 0)
				this.column = 2

				return undefined
			}

			override onDidChangeProperty = propertyEmitter.event

			override shutdown(immediate: boolean): void {
				console.log("shutdown", immediate)
			}

			override input(data: string): void {
				for (const c of data) {
					if (c.charCodeAt(0) === 13) {
						//dataEmitter.fire(`\r\n${ansiColors.green("$")} `)
						this.column = 2
					} else if (c.charCodeAt(0) === 127) {
						if (this.column > 2) {
							dataEmitter.fire("\b \b")
							this.column--
						}
					} else {
						dataEmitter.fire(c)
						this.column++
					}
				}
			}

			resize(cols: number, rows: number): void {
				console.log("resize", cols, rows)
			}

			override clearBuffer(): void | Promise<void> {
			}
		}
		return new FakeTerminalProcess(1, 1, "/tmp", dataEmitter.event)
	}
}

// Workers

const workerLoaders = {
	"editorWorkerService": () => new EditorWorker(),
	"textMateWorker": () => new TextMateWorker(),
	"outputLinkComputer": () => new OutputLinkComputerWorker(),
	"languageDetectionWorkerService": () => new LanguageDetectionWorker()
};

window.MonacoEnvironment = {
	"getWorker": function(moduleId, label) {
		const workerFactory = workerLoaders[label];

		if (workerFactory !== undefined) {
			return workerFactory();
		}

		throw new Error(`Unimplemented worker ${label} (${moduleId})`);
	}
};

// Override services
const remotePath = null;
const remoteAuthority = null;
const connectionToken = undefined;

/*
const userFileSystemProvider = new RegisteredFileSystemProvider(false);

registerCustomProvider("user-store", userFileSystemProvider);

userFileSystemProvider.registerFile(new RegisteredMemoryFile(monaco.Uri.from({ "scheme": "user-store", "path": "/User/settings.json" }), JSON.stringify({
	"workbench.colorTheme": "Default Light+"
}, undefined, "\t")));
*/

await initializeMonacoService({
	...getLogServiceOverride(),
	...getExtensionServiceOverride(ExtensionHostWorker),
	...getExtensionGalleryServiceOverride({ webOnly: false }),
	...getModelServiceOverride(),
	...getNotificationServiceOverride(),
	...getDialogsServiceOverride(),
	...getConfigurationServiceOverride(),
	...getKeybindingsServiceOverride(),
	...getTextmateServiceOverride(),
	...getThemeServiceOverride(),
	...getLanguagesServiceOverride(),
	...getAudioCueServiceOverride(),
	...getDebugServiceOverride(),
	...getPreferencesServiceOverride(),
	...getViewsServiceOverride(openNewCodeEditor, undefined, state => ({
		...state,
		editor: {
			...state.editor,
			restoreEditors: true
		}
	})),
	...getBannerServiceOverride(),
	...getStatusBarServiceOverride(),
	...getTitleBarServiceOverride(),
	...getSnippetServiceOverride(),
	...getQuickAccessServiceOverride({
		isKeybindingConfigurationVisible: isEditorPartVisible,
		shouldUseGlobalPicker: (_editor, isStandalone) => !isStandalone && isEditorPartVisible()
	}),
	...getOutputServiceOverride(),
	...getTerminalServiceOverride(new TerminalBackend()),
	...getSearchServiceOverride(),
	...getMarkersServiceOverride(),
	...getAccessibilityServiceOverride(),
	...getLanguageDetectionWorkerServiceOverride(),
	...getStorageServiceOverride(),
	...getRemoteAgentServiceOverride(connectionToken),
	...getLifecycleServiceOverride(),
	...getEnvironmentServiceOverride(),
	...getWorkspaceTrustOverride(),
	...getWorkingCopyServiceOverride()
}, document.body, {
	remoteAuthority,
	enableWorkspaceTrust: true,
	workspaceProvider: {
		trusted: true,
		async open() {
			return false
		},
		workspace: remotePath == null
			? {
				workspaceUri: workspaceFile
			}
			: {
				folderUri: monaco.Uri.from({ scheme: "vscode-remote", path: remotePath, authority: remoteAuthority })
			}
	},
	developmentOptions: {
		logLevel: LogLevel.Info // Default value
	},
	defaultLayout: {
		editors: [{
			uri: monaco.Uri.file("/tmp/test.js"),
			viewColumn: 1
		}, {
			uri: monaco.Uri.file("/tmp/test.css"),
			viewColumn: 2
		}],
		layout: {
			editors: {
				orientation: 0,
				groups: [{ size: 1 }, { size: 1 }]
			}
		}
	},
	productConfiguration: {
		extensionsGallery: {
			serviceUrl: "https://open-vsx.org/vscode/gallery",
			itemUrl: "https://open-vsx.org/vscode/item",
			resourceUrlTemplate: "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
			controlUrl: "",
			nlsBaseUrl: "",
			publisherUrl: ""
		}
	}
});

await initializeVscodeExtensions();

for (const { part, element } of [
	//{ "part": Parts.TITLEBAR_PART, "element": "#titleBar" },
	//{ "part": Parts.BANNER_PART, "element": "#banner" },
	{ "part": Parts.SIDEBAR_PART, "element": "#sidebar" },
	//{ "part": Parts.ACTIVITYBAR_PART, "element": "#activityBar" },
	{ "part": Parts.PANEL_PART, "element": "#console" },
	{ "part": Parts.EDITOR_PART, "element": "#editors" },
	{ "part": Parts.STATUSBAR_PART, "element": "#statusBar" },
	{ "part": Parts.AUXILIARYBAR_PART, "element": "#auxbar" }
]) {
	const el = document.querySelector<HTMLDivElement>(element)!;

	attachPart(part, el);

	if (!isPartVisible(part)) {
		el.style.display = "none";
	}

	onPartVisibilityChange(part, (visible) => {
		el.style.display = visible ? "block" : "none";
	});
}

// SOURCE: https://github.com/CodinGame/monaco-vscode-api/blob/main/demo/src/main.ts

import "@codingame/monaco-vscode-clojure-default-extension";
import "@codingame/monaco-vscode-coffeescript-default-extension";
import "@codingame/monaco-vscode-cpp-default-extension";
import "@codingame/monaco-vscode-csharp-default-extension";
import "@codingame/monaco-vscode-css-default-extension";
import "@codingame/monaco-vscode-diff-default-extension";
import "@codingame/monaco-vscode-fsharp-default-extension";
import "@codingame/monaco-vscode-go-default-extension";
import "@codingame/monaco-vscode-groovy-default-extension";
import "@codingame/monaco-vscode-html-default-extension";
import "@codingame/monaco-vscode-java-default-extension";
import "@codingame/monaco-vscode-javascript-default-extension";
import "@codingame/monaco-vscode-json-default-extension";
import "@codingame/monaco-vscode-julia-default-extension";
import "@codingame/monaco-vscode-lua-default-extension";
import "@codingame/monaco-vscode-markdown-basics-default-extension";
import "@codingame/monaco-vscode-objective-c-default-extension";
import "@codingame/monaco-vscode-perl-default-extension";
import "@codingame/monaco-vscode-php-default-extension";
import "@codingame/monaco-vscode-powershell-default-extension";
import "@codingame/monaco-vscode-python-default-extension";
import "@codingame/monaco-vscode-r-default-extension";
import "@codingame/monaco-vscode-ruby-default-extension";
import "@codingame/monaco-vscode-rust-default-extension";
import "@codingame/monaco-vscode-scss-default-extension";
import "@codingame/monaco-vscode-shellscript-default-extension";
import "@codingame/monaco-vscode-sql-default-extension";
import "@codingame/monaco-vscode-swift-default-extension";
import "@codingame/monaco-vscode-typescript-basics-default-extension";
import "@codingame/monaco-vscode-vb-default-extension";
import "@codingame/monaco-vscode-xml-default-extension";
import "@codingame/monaco-vscode-yaml-default-extension";

import "@codingame/monaco-vscode-theme-defaults-default-extension";
import "@codingame/monaco-vscode-theme-seti-default-extension";
import "@codingame/monaco-vscode-references-view-default-extension";
import "@codingame/monaco-vscode-search-result-default-extension";
import "@codingame/monaco-vscode-configuration-editing-default-extension";
import "@codingame/monaco-vscode-markdown-math-default-extension";
import "@codingame/monaco-vscode-npm-default-extension";
import "@codingame/monaco-vscode-media-preview-default-extension";

// monaco-vscode-api/demo/src/features/search.ts
const { registerFileUrl, getApi } = registerExtension({
	name: "searchProvider",
	publisher: "codingame",
	version: "1.0.0",
	engines: {
		vscode: "*"
	},
	enabledApiProposals: ["fileSearchProvider", "textSearchProvider"]
}, ExtensionHostKind.LocalProcess)

const api = await getApi()

api.workspace.registerFileSearchProvider("file", {
	async provideFileSearchResults() {
		return monaco.editor.getModels().map(model => model.uri).filter(uri => uri.scheme === "file")
	}
})
api.workspace.registerTextSearchProvider("file", {
	async provideTextSearchResults(query, _, progress) {
		for (const model of monaco.editor.getModels()) {
			const matches = model.findMatches(query.pattern, false, query.isRegExp ?? false, query.isCaseSensitive ?? false, query.isWordMatch ?? false ? " " : null, true)
			if (matches.length > 0) {
				const ranges = matches.map(match => new api.Range(match.range.startLineNumber, match.range.startColumn, match.range.endLineNumber, match.range.endColumn))
				progress.report({
					uri: model.uri,
					ranges,
					preview: {
						text: model.getValue(),
						matches: ranges
					}
				})
			}
		}
		return {}
	}
})

// monaco-vscode-api/demo/src/features/filesystem";
import { RegisteredFileSystemProvider, registerFileSystemOverlay } from "@codingame/monaco-vscode-files-service-override";

const fileSystemProvider = new RegisteredFileSystemProvider(false)

registerFileSystemOverlay(1, fileSystemProvider)

export {
	createModelReference,
	ExtensionHostKind,
	monaco,
	registerExtension,
	registerFileUrl,
	vscode
};
