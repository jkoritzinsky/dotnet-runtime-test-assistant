import * as path from 'path';
import * as vscode from 'vscode';
import * as userPrompts from '../userPrompts';
import { DebugConfigurationBase, getCoreClrOutputRootPath, getRuntimeTestArtifactsPath } from '../helpers';
import { copyFile, writeFile, mkdir } from 'fs/promises';
import { OutputConfiguration } from '../outputConfiguration';
import { generateIlcResponseFile } from '../server';

type DebugConfigurationType = 'rt-ilc';

export const DEBUG_CONFIGURATION_TYPE: DebugConfigurationType = 'rt-ilc';

interface IlcConfiguration extends DebugConfigurationBase {
    type: DebugConfigurationType;
}

function isIlcConfiguration(debugConfiguration: vscode.DebugConfiguration): debugConfiguration is IlcConfiguration {
    return debugConfiguration.type === DEBUG_CONFIGURATION_TYPE;
}

export function transformConfig(debugConfiguration: IlcConfiguration, ilcBuildCoreClrBin: string, responseFilePath: string, ...extraArgs: string[]) {
    return {
        name: debugConfiguration.name,
        type: 'coreclr',
        request: 'launch',
        program: path.join(ilcBuildCoreClrBin, 'ilc', 'ilc.dll'),
        args: [
            `@${responseFilePath}`,
            ...extraArgs
        ]
    };
}

export function provideDebugConfigurations(_folder: vscode.WorkspaceFolder | undefined, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
        {
            type: DEBUG_CONFIGURATION_TYPE,
            request: 'launch',
            name: 'Crossgen2 on Runtime Test',
            args: [],
            env: {},
            stopAtEntry: false
        }
    ];
}

export async function resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
    if (isIlcConfiguration(debugConfiguration)) {
        if (!folder) {
            return undefined;
        }
        let runtimeTest = await userPrompts.promptUserForRuntimeTestProject({ workspace: folder.uri });

        if (!runtimeTest) {
            return undefined;
        }

        let testConfig = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Runtime Test', showChecked: true, defaultConfiguration: 'Debug' });

        if (!testConfig) {
            return undefined;
        }

        const rspFile = await generateIlcResponseFile(path.join(folder.uri.fsPath, 'src', 'tests', runtimeTest), testConfig);

        return transformConfig(debugConfiguration, getCoreClrOutputRootPath(folder.uri, testConfig), rspFile, ...(debugConfiguration.args || []));
    }
    return debugConfiguration;
}