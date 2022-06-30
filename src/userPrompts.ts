
import * as glob from "glob";
import * as path from "path";
import {promisify} from "util";
import { existsSync } from 'fs';
import * as os from "os";
import * as vscode from 'vscode';

type OutputConfiguration = { os: string, arch:string, configuration: string };

export async function promptUserForTargetConfiguration(options: { promptPrefix: string, showChecked: boolean, defaultConfiguration: string }): Promise<OutputConfiguration | undefined> {
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
			let userInputTarget = await vscode.window.showInputBox({ title: `${options.promptPrefix} OS` });
			if (!userInputTarget) {
				return undefined;
			}
			targetOS = userInputTarget;
			break;
	}

	let targetArch = await promptQuickPick([ "x86", "x64", "arm", "arm64", "s390x" ], { title: `${options.promptPrefix} Architecture`, default: os.arch() });

	if (!targetArch) {
		return undefined;
	}

	const configurations = options.showChecked ? ["Debug", "Checked", "Release"] : ["Debug", "Release"];

	if (!configurations.includes(options.defaultConfiguration)) {
		options.defaultConfiguration = "Debug";
	}

	let targetConfig = await promptQuickPick(configurations, { title: `${options.promptPrefix} Configuration`, default: options.defaultConfiguration });

	if (!targetConfig) {
		return undefined;
	}

	return {
		os: targetOS,
		arch: targetArch,
		configuration: targetConfig
	};
}

export async function getRuntimeWorkspaceFolder() {
	let workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		await vscode.window.showErrorMessage("A workspace must be opened in a clone of the dotnet/runtime repository (or a fork) to use the dotnet-runtime-test-assistant extension.");
		return undefined;
	}
	if (workspaceFolders.length === 1) {
		return workspaceFolders[0].uri;
	}

	let options = workspaceFolders.map(folder => { return { label: folder.name, detail: folder.uri.toString() }; });

	let result = await vscode.window.showQuickPick(options, { title: "Select dotnet/runtime workspace..." });
	return result === undefined ? undefined : vscode.Uri.parse(result.detail);
}

async function getAllBuiltRuntimeTests(workspaceFolder: vscode.Uri, configuration: OutputConfiguration) {
	const testPathRoot = `${workspaceFolder.fsPath}${path.sep}artifacts${path.sep}tests${path.sep}coreclr${path.sep}${configuration.os}.${configuration.arch}.${configuration.configuration}`;
	const extension = configuration.os === "windows" ? ".cmd" : ".sh";
	let builtTestsWithScripts = await promisify(glob)(`**/*${extension}`, { cwd: testPathRoot });
	return builtTestsWithScripts.map(scriptPath => {
		let parsed = path.parse(scriptPath);
		parsed.base = ""; // Reset the base so we recalculate based on the modified extension.
		parsed.ext = ".dll";
		return path.format(parsed);
	}).filter(testEntryPoint => existsSync(`${testPathRoot}${path.sep}${testEntryPoint}`));
}

export async function promptUserForRuntimeTest(options: { workspace: vscode.Uri, configuration : OutputConfiguration }) {
    return await promptQuickPick(await getAllBuiltRuntimeTests(options.workspace, options.configuration), { title: "Select a runtime test to run." });
}

async function promptQuickPick(values: string[], options: vscode.QuickPickOptions & { default? : string }) {
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
