import * as vscode from 'vscode';
import * as runtimeTestProvider from './providers/runtimetest';
import * as crossgen2CoreLibTestProvider from './providers/crossgen2-corelib';
import * as crossgen2TestProvider from './providers/crossgen2';
import * as ilcTestProvider from './providers/ilc';
import * as libsNativeTestProvider from './providers/libs-native';
import * as buildTaskProvider from './providers/build';
import { setServerPathFromExtensionContext, getOrStartServerConnection, disconnectServer } from './server';
import { configureRunSettingsFileForTestRun, getSubsetsToBuild, importSettingsFromDevContainer } from './commands';

type CustomDebugConfigurationProvider = vscode.DebugConfigurationProvider & {
	DEBUG_CONFIGURATION_TYPE: string;
};

type Disposable = { dispose: () => {} };

class CompositeDisposable {
	private disposables: Disposable[];

	constructor() {
		this.disposables = new Array<Disposable>();
	}

	public push(disposable: Disposable) {
		this.disposables.push(disposable);
	}

	public dispose() {
		this.disposables.forEach(disposable => disposable.dispose());
	}
}

function registerDebugConfigurationProvider(provider: CustomDebugConfigurationProvider) {
	const disposables = new CompositeDisposable();
	disposables.push(vscode.debug.registerDebugConfigurationProvider(provider.DEBUG_CONFIGURATION_TYPE, provider, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
	disposables.push(vscode.debug.registerDebugConfigurationProvider(provider.DEBUG_CONFIGURATION_TYPE, provider));
	return disposables;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.startServerIfNotStarted', getOrStartServerConnection));
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.shutdownServer', disconnectServer));
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.importSettingsFromDevContainer', importSettingsFromDevContainer));
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.configureRunSettingsFileForTestRun', configureRunSettingsFileForTestRun));
	context.subscriptions.push(vscode.commands.registerCommand('dotnet-runtime-test-assistant.getSubsetsToBuild', getSubsetsToBuild));

	context.subscriptions.push(registerDebugConfigurationProvider(runtimeTestProvider));
	context.subscriptions.push(registerDebugConfigurationProvider(crossgen2CoreLibTestProvider));
	context.subscriptions.push(registerDebugConfigurationProvider(crossgen2TestProvider));
	context.subscriptions.push(registerDebugConfigurationProvider(ilcTestProvider));
	context.subscriptions.push(registerDebugConfigurationProvider(libsNativeTestProvider));

	context.subscriptions.push(vscode.tasks.registerTaskProvider('runtime-build', buildTaskProvider));
	context.subscriptions.push({ dispose: disconnectServer });

	setServerPathFromExtensionContext(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
	disconnectServer();
}
