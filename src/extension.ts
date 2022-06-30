// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as configurationProvider from './debugConfigurationProvider';
import * as userPrompts from './userPrompts';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand("dotnet-runtime-test-assistant.selectRuntimeTestPath", async () => {
		let workspaceFolder = await userPrompts.getRuntimeWorkspaceFolder();
		if (workspaceFolder === undefined) {
			return;
		}
		
		let config = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: "Test", showChecked: true, defaultConfiguration: "Debug" });
		if (config === undefined) {
			return;
		}
		let selectedTest = await userPrompts.promptUserForRuntimeTest({workspace: workspaceFolder, configuration: config});
		vscode.window.showInformationMessage(`Selected test '${selectedTest}' on config '${config.os}.${config.arch}.${config.configuration}'`);
	}));

	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('rt-runtimetest', configurationProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('rt-runtimetest', configurationProvider));
}

// this method is called when your extension is deactivated
export function deactivate() {}
