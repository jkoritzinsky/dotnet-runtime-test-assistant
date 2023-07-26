
import * as glob from 'glob';
import * as path from 'path';
import { promisify } from 'util';
import { existsSync } from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { BuildSubset, getRuntimeTestArtifactsPath } from './helpers';
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
		let userInputTarget = await promptQuickPick(['windows', 'linux', 'osx', 'freebsd', 'sunos'], { title: `${options.promptPrefix} OS`, default: getDefaultOSOption() });
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
			targetOS = 'linux';
			break;
		case 'darwin':
			// TODO: Prompt for mobile platforms (how to run tests on mobile platforms from vscode?)
			targetOS = 'osx';
			break;
		case 'freebsd':
			targetOS = 'freebsd';
			break;
		case 'sunos':
			targetOS = 'sunos';
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
		return workspaceFolders[0];
	}

	let options = workspaceFolders.map(folder => {
		return { label: folder.name, detail: folder.uri.toString(), folderObject: folder };
	});

	let result = await vscode.window.showQuickPick(options, { title: 'Select dotnet/runtime workspace...' });
	return result?.folderObject;
}

export async function getRuntimeWorkspaceFolderUri() {
	return (await getRuntimeWorkspaceFolder())?.uri;
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
	return await showQuickPick(createQuickPickItems(librariesTestProjects, project => {
		return {
			label: project.projectName,
			description: `(${project.tfm})`,
			originalData: project
		};
	}), { title: 'Select a libaries test assembly to run.', matchOnDescription: true, selectData: item => item.originalData });
}

async function getAllRuntimeTestProjects(workspaceFolder: vscode.Uri) {
	const testPathRoot = path.join(workspaceFolder.fsPath, 'src', 'tests');
	return await promisify(glob)('**/*.*proj', { cwd: testPathRoot });
}

export async function promptUserForRuntimeTestProject(options: { workspace: vscode.Uri }) {
	return await promptQuickPick(await getAllRuntimeTestProjects(options.workspace), { title: 'Select a runtime test project' });
}

export async function promptUserForBuildSubsets(allSubsets: BuildSubset[]): Promise<BuildSubset[] | undefined> {
	const defaultItem: BuildSubset = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Name: 'Default subsets',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Description: 'The default subsets for the target platform. Cannot be combined with other subsets',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		OnDemand: false
	};
	let result = await showMultiQuickPick(createQuickPickItems([...allSubsets, defaultItem], subset => {
		return {
			label: subset.Name,
			description: subset.OnDemand ? '(on demand)' : undefined,
			detail: subset.Description,
			subset: subset
		};
	}, defaultItem), { title: 'Select build subsets:', selectData: item => item.subset });

	if (!result) {
		return undefined;
	}

	if (result.indexOf(defaultItem) !== -1) {
		if (result.length !== 1) {
			vscode.window.showErrorMessage('The default subsets option cannot be combined with other options');
			return undefined;
		}
		return [];
	}
	return result;
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
			quickPick.picked = true;
			defaultQuickPick = quickPick;
		}
		return quickPick;
	});

	return defaultQuickPick === undefined ? quickPickItems : [defaultQuickPick, ...quickPickItems.filter(item => item !== defaultQuickPick)];
}

async function showQuickPick<TQuickPickItem extends vscode.QuickPickItem, TResult>(values: TQuickPickItem[], options: vscode.QuickPickOptions & { selectData: (item: TQuickPickItem) => TResult }) {
	const result = await vscode.window.showQuickPick(values, options);
	if (result === undefined) {
		return undefined;
	}
	return options.selectData(result);
}

async function showMultiQuickPick<TQuickPickItem extends vscode.QuickPickItem, TResult>(values: TQuickPickItem[], options: vscode.QuickPickOptions & { selectData: (item: TQuickPickItem) => TResult }) {
	const result = await vscode.window.showQuickPick(values, { ...options, canPickMany: true });
	if (result === undefined) {
		return undefined;
	}
	return result.map(options.selectData);
}

export function promptQuickPick(values: string[], options: vscode.QuickPickOptions & { default?: string }) {
	return showQuickPick(createQuickPickItems(values, value => {
		return { label: value };
	}, options.default), { ...options, selectData: item => item.label });
}
