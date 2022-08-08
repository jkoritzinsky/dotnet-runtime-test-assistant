
import * as glob from 'glob';
import * as path from 'path';
import { promisify } from 'util';
import { existsSync } from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { getRuntimeTestArtifactsPath } from './helpers';
import { readdir } from 'fs/promises';
import { OutputConfiguration } from './outputConfiguration';

function getDefaultOSOption() {
	switch (os.platform()) {
		case 'cygwin':
		case 'win32':
			return 'windows';
		case 'linux':
			return 'Linux';
		case 'darwin':
			return 'OSX';
		case 'freebsd':
			return 'FreeBSD';
		case 'sunos':
			return 'SunOS';
		default:
			return undefined;
	}
}

export async function promptUserForTargetConfiguration(options: { promptPrefix: string, showChecked: boolean, defaultConfiguration: string, showAllOSChoices?: boolean }): Promise<OutputConfiguration | undefined> {
	let targetOS: string;
	if (options.showAllOSChoices) {
		let userInputTarget = await promptQuickPick(['windows', 'Linux', 'OSX', 'FreeBSD', 'SunOS'], { title: `${options.promptPrefix} OS`, default: getDefaultOSOption() });
		if (!userInputTarget) {
			return undefined;
		}
		targetOS = userInputTarget;
	}
	switch (os.platform()) {
		case 'cygwin':
		case 'win32':
			targetOS = 'windows';
			break;
		case 'linux':
			targetOS = 'Linux';
			break;
		case 'darwin':
			// TODO: Prompt for mobile platforms (how to run tests on mobile platforms from vscode?)
			targetOS = 'OSX';
			break;
		case 'freebsd':
			targetOS = 'FreeBSD';
			break;
		case 'sunos':
			targetOS = 'SunOS';
			break;
		default:
			let userInputTarget = await vscode.window.showInputBox({ title: `${options.promptPrefix} OS`, placeHolder: getDefaultOSOption() });
			if (!userInputTarget) {
				return undefined;
			}
			targetOS = userInputTarget;
			break;
	}

	let targetArch = await promptQuickPick(['x86', 'x64', 'arm', 'arm64', 's390x'], { title: `${options.promptPrefix} Architecture`, default: os.arch() });

	if (!targetArch) {
		return undefined;
	}

	const configurations = options.showChecked ? ['Debug', 'Checked', 'Release'] : ['Debug', 'Release'];

	if (!configurations.includes(options.defaultConfiguration)) {
		options.defaultConfiguration = 'Debug';
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
		await vscode.window.showErrorMessage('A workspace must be opened in a clone of the dotnet/runtime repository (or a fork) to use the dotnet-runtime-test-assistant extension.');
		return undefined;
	}
	if (workspaceFolders.length === 1) {
		return workspaceFolders[0].uri;
	}

	let options = workspaceFolders.map(folder => {
		return { label: folder.name, detail: folder.uri.toString() };
	});

	let result = await vscode.window.showQuickPick(options, { title: 'Select dotnet/runtime workspace...' });
	return result === undefined ? undefined : vscode.Uri.parse(result.detail);
}

async function getAllBuiltRuntimeTests(workspaceFolder: vscode.Uri, configuration: OutputConfiguration) {
	const testPathRoot = getRuntimeTestArtifactsPath(workspaceFolder, configuration);
	const extension = configuration.os === 'windows' ? '.cmd' : '.sh';
	let builtTestsWithScripts = await promisify(glob)(`**/*${extension}`, { cwd: testPathRoot });
	return builtTestsWithScripts.map(scriptPath => {
		let parsed = path.parse(scriptPath);
		parsed.base = ''; // Reset the base so we recalculate based on the modified extension.
		parsed.ext = '.dll';
		return path.format(parsed);
	}).filter(testEntryPoint => existsSync(`${testPathRoot}${path.sep}${testEntryPoint}`));
}

export async function promptUserForRuntimeTest(options: { workspace: vscode.Uri, configuration: OutputConfiguration }) {
	return await promptQuickPick(await getAllBuiltRuntimeTests(options.workspace, options.configuration), { title: 'Select a runtime test to run.' });
}

interface LibrariesTestInfo {
	projectName: string;
	tfm: string;
	projectPath: string;
}

async function getAllBuiltLibrariesTests(workspaceFolder: vscode.Uri, configuration: OutputConfiguration): Promise<LibrariesTestInfo[]> {
	const artifactsBin = path.join(workspaceFolder.fsPath, 'artifacts', 'bin');
	let librariesTestProjects = await promisify(glob)(path.join(`${workspaceFolder.fsPath}`, 'src', 'libraries', '*', 'tests', '**/*.Tests.csproj'));
	let bulitLibrariesTests: LibrariesTestInfo[] = [];
	for (const librariesTestProject of librariesTestProjects) {
		let projectName = path.basename(librariesTestProject, '.csproj');
		let projectBin = path.join(artifactsBin, projectName, configuration.configuration);
		if (existsSync(projectBin)) {
			let builtTfms = await readdir(projectBin);
			bulitLibrariesTests = bulitLibrariesTests.concat(builtTfms.map(tfm => {
				return {
					projectName,
					tfm,
					projectPath: librariesTestProject
				};
			}));
		}
	}
	return bulitLibrariesTests;
}

export async function promptUserForLibrariesTest(options: { workspace: vscode.Uri, configuration: OutputConfiguration }) {
	const librariesTestProjects = await getAllBuiltLibrariesTests(options.workspace, options.configuration);
	let result = await vscode.window.showQuickPick(createQuickPickItems(librariesTestProjects, project => {
		return {
			label: project.projectName,
			description: `(${project.tfm})`,
			originalData: project
		};
	}), { title: 'Select a libaries test assembly to run.', matchOnDescription: true });

	if (result === undefined) {
		return result;
	}

	return result.originalData;
}

async function getAllRuntimeTestProjects(workspaceFolder: vscode.Uri) {
	const testPathRoot = path.join(workspaceFolder.fsPath, 'src', 'tests');
	return await promisify(glob)('**/*.*proj', { cwd: testPathRoot });
}

export async function promptUserForRuntimeTestProject(options: { workspace: vscode.Uri }) {
	return await promptQuickPick(await getAllRuntimeTestProjects(options.workspace), { title: 'Select a runtime test project' });
}

function createQuickPickItems<T, TAdditionalProperties>(values: T[], factory: (value: T) => vscode.QuickPickItem & TAdditionalProperties, defaultValue?: T) {
	let defaultQuickPick: vscode.QuickPickItem | undefined = undefined;
	let quickPickItems = values.map(item => {
		let quickPick = factory(item);
		if (defaultValue === item) {
			if (quickPick.description) {
				quickPick.description += ' (default)';
			} else {
				quickPick.description = '(default)';
			}
			defaultQuickPick = quickPick;
		}
		return quickPick;
	});

	return defaultQuickPick === undefined ? quickPickItems : [defaultQuickPick, ...quickPickItems.filter(item => item !== defaultQuickPick)];
}

export async function promptQuickPick(values: string[], options: vscode.QuickPickOptions & { default?: string }) {
	let result = await vscode.window.showQuickPick(createQuickPickItems(values, value => {
		return { label: value };
	}, options.default), options);
	return result?.label;
}
