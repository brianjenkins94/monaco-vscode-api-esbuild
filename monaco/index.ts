/// <reference path="../monaco-vscode-api/vscode.proposed.fileSearchProvider.d.ts" />
/// <reference path="../monaco-vscode-api/vscode.proposed.textSearchProvider.d.ts" />

// SOURCE: https://github.com/CodinGame/monaco-vscode-api/blob/main/demo/src/setup.ts

import { ExtensionHostKind, initialize as initializeVscodeExtensions, registerExtension } from "vscode/extensions";
import { ILogService, LogLevel, StandaloneServices, initialize as initializeMonacoService } from "vscode/services";

import { RegisteredFileSystemProvider, registerFileSystemOverlay } from "vscode/service-override/files";
import getAccessibilityServiceOverride from "vscode/service-override/accessibility";
import getAudioCueServiceOverride from "vscode/service-override/audioCue";
import getConfigurationServiceOverride from "vscode/service-override/configuration";
import getDebugServiceOverride from "vscode/service-override/debug";
import getDialogsServiceOverride from "vscode/service-override/dialogs";
import getExtensionServiceOverride from "vscode/service-override/extensions";
import getKeybindingsServiceOverride from "vscode/service-override/keybindings";
import getLanguageDetectionWorkerServiceOverride from "vscode/service-override/languageDetectionWorker";
import getLanguagesServiceOverride from "vscode/service-override/languages";
import getMarkersServiceOverride from "vscode/service-override/markers";
import getModelServiceOverride from "vscode/service-override/model";
import getNotificationServiceOverride from "vscode/service-override/notifications";
import getOutputServiceOverride from "vscode/service-override/output";
import getPreferencesServiceOverride from "vscode/service-override/preferences";
import getQuickAccessServiceOverride from "vscode/service-override/quickaccess";
import getSearchServiceOverride from "vscode/service-override/search";
import getSnippetServiceOverride from "vscode/service-override/snippets";
import getStorageServiceOverride from "vscode/service-override/storage";
import getTerminalServiceOverride, { SimpleTerminalBackend, SimpleTerminalProcess } from "vscode/service-override/terminal";
import getTextmateServiceOverride from "vscode/service-override/textmate";
import getThemeServiceOverride from "vscode/service-override/theme";
import type { IReference, IResolvedTextEditorModel, OpenEditor } from "vscode/service-override/views";
import getViewsServiceOverride, { Parts, attachPart, isEditorPartVisible, isPartVisibile as isPartVisible, onPartVisibilityChange } from "vscode/service-override/views";

import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import ExtensionHostWorker from "vscode/workers/extensionHost.worker?worker";
import LanguageDetectionWorker from "vscode/workers/languageDetection.worker?worker";
import OutputLinkComputerWorker from "vscode/workers/outputLinkComputer.worker?worker";
import TextMateWorker from "vscode/workers/textMate.worker?worker";

import * as monaco from "monaco-editor";
import * as vscode from "vscode";

// monaco-vscode-api/demo/src/features/editor.ts
import { createConfiguredEditor, createModelReference } from "vscode/monaco";

let currentEditor: (monaco.IDisposable & {
	modelRef: IReference<IResolvedTextEditorModel>;
	editor: monaco.editor.IStandaloneCodeEditor;
}) | null = null;
const openNewCodeEditor: OpenEditor = async (modelRef) => {
	if (currentEditor != null) {
		currentEditor.dispose();
		currentEditor = null;
	}
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
	container.style.top = container.style.bottom = container.style.left = container.style.right = "0";
	container.style.cursor = "pointer";

	const editorElem = document.createElement("div");
	editorElem.style.position = "absolute";
	editorElem.style.top = editorElem.style.bottom = editorElem.style.left = editorElem.style.right = "0";
	editorElem.style.margin = "auto";
	editorElem.style.width = "80%";
	editorElem.style.height = "80%";

	container.appendChild(editorElem);

	document.body.appendChild(container);
	try {
		const editor = createConfiguredEditor(
			editorElem,
			{
				"model": modelRef.object.textEditorModel,
				"readOnly": true,
				"automaticLayout": true
			}
		);

		currentEditor = {
			"dispose": () => {
				editor.dispose();
				modelRef.dispose();
				document.body.removeChild(container);
				currentEditor = null;
			},
			"modelRef": modelRef,
			"editor": editor
		};

		editor.onDidBlurEditorWidget(() => {
			currentEditor?.dispose();
		});
		container.addEventListener("mousedown", (event) => {
			if (event.target !== container) {
				return;
			}

			currentEditor?.dispose();
		});

		return editor;
	} catch (error) {
		document.body.removeChild(container);
		currentEditor = null;
		throw error;
	}
};

// monaco-vscode-api/demo/src/features/terminal.ts
class TerminalBackend extends SimpleTerminalBackend {
	public override getDefaultSystemShell = async (): Promise<string> => "fake";
	public override createProcess = async (): Promise<ITerminalChildProcess> => {
		const dataEmitter = new vscode.EventEmitter<string>();
		const propertyEmitter = new vscode.EventEmitter<{
			type: string;
			value: string;
		}>();
		class FakeTerminalProcess extends SimpleTerminalProcess {
			private column = 0;
			public async start(): Promise<undefined> {
				//ansiColors.enabled = true;
				//dataEmitter.fire(`This is a fake terminal\r\n${ansiColors.green("$")} `);
				setTimeout(() => {
					dataEmitter.fire("\u001B]0;Fake terminal title\u0007");
				}, 0);
				this.column = 2;

				return undefined;
			}

			public override onDidChangeProperty = propertyEmitter.event;

			public override shutdown(immediate: boolean): void {
				console.log("shutdown", immediate);
			}

			public override input(data: string): void {
				for (const c of data) {
					if (c.charCodeAt(0) === 13) {
						dataEmitter.fire(`\r\n${ansiColors.green("$")} `);
						this.column = 2;
					} else if (c.charCodeAt(0) === 127) {
						if (this.column > 2) {
							dataEmitter.fire("\b \b");
							this.column--;
						}
					} else {
						dataEmitter.fire(c);
						this.column++;
					}
				}
			}

			public resize(cols: number, rows: number): void {
				console.log("resize", cols, rows);
			}

			public override clearBuffer(): Promise<void> | void {
			}
		}
		return new FakeTerminalProcess(1, 1, "/tmp", dataEmitter.event);
	};
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

await initializeMonacoService({
	...getExtensionServiceOverride(ExtensionHostWorker),
	...getModelServiceOverride(),
	...getNotificationServiceOverride(),
	...getDialogsServiceOverride(),
	...getConfigurationServiceOverride(monaco.Uri.file("/tmp")),
	...getKeybindingsServiceOverride(),
	...getTextmateServiceOverride(),
	...getThemeServiceOverride(),
	...getLanguagesServiceOverride(),
	...getAudioCueServiceOverride(),
	...getDebugServiceOverride(),
	...getPreferencesServiceOverride(),
	...getViewsServiceOverride(openNewCodeEditor),
	...getSnippetServiceOverride(),
	...getQuickAccessServiceOverride({
		"isKeybindingConfigurationVisible": isEditorPartVisible,
		"shouldUseGlobalPicker": isEditorPartVisible
	}),
	...getOutputServiceOverride(),
	...getTerminalServiceOverride(new TerminalBackend()),
	...getSearchServiceOverride(),
	...getMarkersServiceOverride(),
	...getAccessibilityServiceOverride(),
	...getLanguageDetectionWorkerServiceOverride(),
	...getStorageServiceOverride()
});

StandaloneServices.get(ILogService).setLevel(LogLevel.Off);

await initializeVscodeExtensions();

for (const { part, element } of [
	{ "part": Parts.SIDEBAR_PART, "element": "#sidebar" },
	{ "part": Parts.ACTIVITYBAR_PART, "element": "#activityBar" },
	{ "part": Parts.PANEL_PART, "element": "#panel" },
	{ "part": Parts.EDITOR_PART, "element": "#editors" },
	{ "part": Parts.STATUSBAR_PART, "element": "#statusBar" }
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

//import "vscode/default-extensions/clojure";
//import "vscode/default-extensions/coffeescript";
//import "vscode/default-extensions/cpp";
//import "vscode/default-extensions/csharp";
import "vscode/default-extensions/css";
import "vscode/default-extensions/diff";
//import "vscode/default-extensions/fsharp";
//import "vscode/default-extensions/go";
//import "vscode/default-extensions/groovy";
import "vscode/default-extensions/html";
//import "vscode/default-extensions/java";
import "vscode/default-extensions/javascript";
import "vscode/default-extensions/json";
//import "vscode/default-extensions/julia";
//import "vscode/default-extensions/lua";
import "vscode/default-extensions/markdown-basics";
//import "vscode/default-extensions/objective-c";
//import "vscode/default-extensions/perl";
//import "vscode/default-extensions/php";
//import "vscode/default-extensions/powershell";
//import "vscode/default-extensions/python";
//import "vscode/default-extensions/r";
//import "vscode/default-extensions/ruby";
//import "vscode/default-extensions/rust";
import "vscode/default-extensions/scss";
import "vscode/default-extensions/shellscript";
//import "vscode/default-extensions/sql";
//import "vscode/default-extensions/swift";
import "vscode/default-extensions/typescript-basics";
//import "vscode/default-extensions/vb";
import "vscode/default-extensions/xml";
import "vscode/default-extensions/yaml";

import "vscode/default-extensions/theme-defaults";
import "vscode/default-extensions/theme-seti";
import "vscode/default-extensions/references-view";
import "vscode/default-extensions/search-result";
import "vscode/default-extensions/configuration-editing";
//import "vscode/default-extensions/markdown-math";
import "vscode/default-extensions/npm";
//import "vscode/default-extensions/media-preview";

// monaco-vscode-api/demo/src/features/search.ts
const { getApi } = registerExtension({
	"name": "searchProvider",
	"publisher": "codingame",
	"version": "1.0.0",
	"engines": {
		"vscode": "*"
	},
	"enabledApiProposals": ["fileSearchProvider", "textSearchProvider"]
}, ExtensionHostKind.LocalProcess);

const api = await getApi();

api.workspace.registerFileSearchProvider("file", {
	"provideFileSearchResults": function() {
		return monaco.editor.getModels().map((model) => model.uri).filter((uri) => uri.scheme === "file");
	}
});

api.workspace.registerTextSearchProvider("file", {
	"provideTextSearchResults": function(query, _, progress) {
		for (const model of monaco.editor.getModels()) {
			const matches = model.findMatches(query.pattern, false, query.isRegExp ?? false, query.isCaseSensitive ?? false, query.isWordMatch ?? false ? " " : null, true);
			if (matches.length > 0) {
				const ranges = matches.map((match) => new api.Range(match.range.startLineNumber, match.range.startColumn, match.range.endLineNumber, match.range.endColumn));
				progress.report({
					"uri": model.uri,
					"ranges": ranges,
					"preview": {
						"text": model.getValue(),
						"matches": ranges
					}
				});
			}
		}
		return {};
	}
});

// monaco-vscode-api/demo/src/features/filesystem";
const fileSystemProvider = new RegisteredFileSystemProvider(false);

registerFileSystemOverlay(1, fileSystemProvider);

export { createModelReference, monaco, vscode };
