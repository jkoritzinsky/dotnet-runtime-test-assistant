// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as os from "os";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand("dotnet-runtime-test-assistant.selectRuntimeTestPath", async () => {
		let config = await promptUserForTargetConfiguration({ showChecked: true, defaultConfiguration: "Debug" });
		if (config === undefined) {
			return;
		}
		let selectedTest = await vscode.window.showQuickPick(["test1", "test2"]);
		vscode.window.showInformationMessage(`Selected test '${selectedTest}' on config '${config.os}.${config.arch}.${config.configuration}'`);
	}));
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function promptUserForTargetConfiguration(options: { showChecked: boolean, defaultConfiguration: string }) {
	let targetOS : string;
	switch (os.platform()) {
		case "cygwin":
		case "win32":
			targetOS = "windows";
			break;
		case "linux":
			targetOS = "Linux";
			break;
		case "darwin":
			// TODO: Prompt for mobile platforms (how to run tests on mobile platforms from vscode?)
			targetOS = "OSX";
			break;
		case "freebsd":
			targetOS = "FreeBSD";
			break;
		case "sunos":
			targetOS = "SunOS";
			break;
		default:
			let userInputTarget = await vscode.window.showInputBox({ title: "Target OS" });
			if (!userInputTarget) {
				return undefined;
			}
			targetOS = userInputTarget;
			break;
	}

	let targetArch = promptQuickPick([ "x86", "x64", "arm", "arm64", "s390x" ], { title: "Target Architecture", default: os.arch() });

	if (!targetArch) {
		return undefined;
	}

	const configurations = options.showChecked ? ["Debug", "Checked", "Release"] : ["Debug", "Release"];

	if (!configurations.includes(options.defaultConfiguration)) {
		options.defaultConfiguration = "Debug";
	}

	let targetConfig = promptQuickPick(configurations, { title: "Target Configuration", default: options.defaultConfiguration });

	if (!targetConfig) {
		return undefined;
	}

	return {
		os: targetOS,
		arch: targetArch,
		configuration: targetConfig
	};
}

async function promptQuickPick(values: string[], options: vscode.QuickPickOptions & { default : string | undefined }) {
	let items : vscode.QuickPickItem[] = [];

	values.forEach(value => {
		if (value === options.default) {
			items = [ { label: value, description: "(default)" }, ...items ];
		} else {
			items.push({ label: value });
		}
	});

	let result = await vscode.window.showQuickPick(items, options);
	return result?.label;
}
