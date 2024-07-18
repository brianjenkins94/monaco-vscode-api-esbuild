import { IStorageService, IWorkbenchLayoutService, getService, initialize as initializeMonacoService } from "vscode/services";
import getQuickAccessServiceOverride from "@codingame/monaco-vscode-quickaccess-service-override";
import { BrowserStorageService } from "@codingame/monaco-vscode-storage-service-override";
import { ExtensionHostKind } from "@codingame/monaco-vscode-extensions-service-override";
import { registerExtension } from "vscode/extensions";
import getViewsServiceOverride, {
	Parts,
	attachPart,
	isEditorPartVisible,
	isPartVisibile,
	onPartVisibilityChange
} from "@codingame/monaco-vscode-views-service-override";
import { openNewCodeEditor } from "./demo/src/features/editor";
import "./demo/src/features/customView.views";
import { commonServices, constructOptions, envOptions, remoteAuthority, userDataProvider } from "./demo/src/setup.common";

// Override services
await initializeMonacoService({
	...commonServices,
	...getViewsServiceOverride(openNewCodeEditor, undefined),

	...getQuickAccessServiceOverride({
		"isKeybindingConfigurationVisible": isEditorPartVisible,
		"shouldUseGlobalPicker": (_editor, isStandalone) => !isStandalone && isEditorPartVisible()
	})
}, document.body, constructOptions, envOptions);

for (const config of [
  //{ part: Parts.TITLEBAR_PART, element: '#titleBar' },
  //{ part: Parts.BANNER_PART, element: '#banner' },
	{ "part": Parts.SIDEBAR_PART, "element": "#sidebar" },
  //{ part: Parts.ACTIVITYBAR_PART, get element () { return getSideBarPosition() === Position.LEFT ? '#activityBar' : '#activityBar-right' }, onDidElementChange: onDidChangeSideBarPosition },
	{ "part": Parts.PANEL_PART, "element": "#console" },
	{ "part": Parts.EDITOR_PART, "element": "#editors" },
	{ "part": Parts.STATUSBAR_PART, "element": "#statusbar" },
	{ "part": Parts.AUXILIARYBAR_PART, "element": "#auxbar" }
]) {
	attachPart(config.part, document.querySelector<HTMLDivElement>(config.element)!);

	config.onDidElementChange?.(() => {
		attachPart(config.part, document.querySelector<HTMLDivElement>(config.element)!);
	});

	if (!isPartVisibile(config.part)) {
		document.querySelector<HTMLDivElement>(config.element)!.style.display = "none";
	}

	onPartVisibilityChange(config.part, (visible) => {
		document.querySelector<HTMLDivElement>(config.element)!.style.display = visible ? "block" : "none";
	});
}

export async function clearStorage(): Promise<void> {
	await userDataProvider.reset();
	await (await getService(IStorageService) as BrowserStorageService).clear();
}

await registerExtension({
	"name": "demo",
	"publisher": "codingame",
	"version": "1.0.0",
	"engines": {
		"vscode": "*"
	}
}, ExtensionHostKind.LocalProcess).setAsDefaultApi();

export {
	remoteAuthority
};
