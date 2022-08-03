import * as vscode from 'vscode';
import * as runtimeTestProvider from './providers/runtimetest';
import * as crossgen2CoreLibTestProvider from './providers/crossgen2-corelib';
import * as crossgen2TestProvider from './providers/crossgen2';
import * as libsNativeTestProvider from './providers/libs-native';
import { setServerPathFromExtensionContext, getOrStartServerConnection } from './server';
import { importSettingsFromDevContainer } from './commands';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.startServerIfNotStarted', getOrStartServerConnection));
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.importSettingsFromDevContainer', importSettingsFromDevContainer));

	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(runtimeTestProvider.DEBUG_CONFIGURATION_TYPE, runtimeTestProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(runtimeTestProvider.DEBUG_CONFIGURATION_TYPE, runtimeTestProvider));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(crossgen2CoreLibTestProvider.DEBUG_CONFIGURATION_TYPE, crossgen2CoreLibTestProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(crossgen2CoreLibTestProvider.DEBUG_CONFIGURATION_TYPE, crossgen2CoreLibTestProvider));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(crossgen2TestProvider.DEBUG_CONFIGURATION_TYPE, crossgen2TestProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(crossgen2TestProvider.DEBUG_CONFIGURATION_TYPE, crossgen2TestProvider));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(libsNativeTestProvider.DEBUG_CONFIGURATION_TYPE, libsNativeTestProvider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(libsNativeTestProvider.DEBUG_CONFIGURATION_TYPE, libsNativeTestProvider));

	setServerPathFromExtensionContext(context);
}

// this method is called when your extension is deactivated
export function deactivate() { }
