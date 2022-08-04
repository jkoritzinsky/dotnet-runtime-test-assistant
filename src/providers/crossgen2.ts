import * as path from 'path';
import * as vscode from 'vscode';
import * as userPrompts from '../userPrompts';
import { DebugConfigurationBase, getCoreClrOutputRootPath, getRuntimeTestArtifactsPath } from '../helpers';
import { copyFile, writeFile, mkdir } from 'fs/promises';
import { promisify } from 'util';
import { glob } from 'glob';
import { existsSync } from 'fs';
import { OutputConfiguration } from '../outputConfiguration';

type DebugConfigurationType = 'rt-cg2rt';

export const DEBUG_CONFIGURATION_TYPE: DebugConfigurationType = 'rt-cg2rt';

interface Crossgen2Configuration extends DebugConfigurationBase {
    type: DebugConfigurationType;
    separateConfig?: boolean;
    composite?: boolean;
    selectReferencedAssembly?: boolean;
}

function isCrossgen2Configuration(debugConfiguration: vscode.DebugConfiguration): debugConfiguration is Crossgen2Configuration {
    return debugConfiguration.type === DEBUG_CONFIGURATION_TYPE;
}

async function moveCopyAssembliesToILSubdirectory(runtimeTest: string) {
    let directory = path.dirname(runtimeTest);
    let files = await promisify(glob)(path.join(directory, '*.dll'));
    await Promise.all(files.map(file => copyFile(file, path.join(directory, 'IL-CG2', path.basename(file)))));
}

async function writeResponseFile(responseFilePath: string, coreRoot: string, targetArch: string, inputFolder: string, runtimeTest: string, composite: boolean) {
    let rsp = '';
    if (composite) {
        rsp += `${path.join(inputFolder, '*.dll')}\n`;
        rsp += `-o:${path.join(path.dirname(runtimeTest), 'composite-r2r.dll')}\n`;
    } else {
        rsp += `${path.join(inputFolder, path.basename(runtimeTest))}\n`;
        rsp += `-o:${runtimeTest}\n`;
    }
    rsp += `-r:${coreRoot}/System.*.dll\n`;
    rsp += `-r:${coreRoot}/Microsoft.*.dll\n`;
    rsp += `-r:${coreRoot}/mscorlib.dll\n`;
    rsp += '--verify-type-and-field-layout\n';
    rsp += '--method-layout:random\n';
    rsp += `--targetarch:${targetArch}\n`;
    rsp += '-O\n';
    if (composite) {
        rsp += '-composite\n';
    }
    await writeFile(responseFilePath, rsp);
}

export function transformConfig(debugConfiguration: Crossgen2Configuration, crossgenBuildCoreClrBin: string, responseFilePath: string, ...extraArgs: string[]) {
    return {
        name: debugConfiguration.name,
        type: 'coreclr',
        request: 'launch',
        program: path.join(crossgenBuildCoreClrBin, 'crossgen2', 'crossgen2.dll'),
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
    if (isCrossgen2Configuration(debugConfiguration)) {
        if (!folder) {
            return undefined;
        }
        let crossgen2Config: OutputConfiguration | undefined;
        let testConfig: OutputConfiguration | undefined;
        if (debugConfiguration.separateConfig) {
            crossgen2Config = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Crossgen2', showChecked: true, defaultConfiguration: 'Debug' });
            if (crossgen2Config) {
                testConfig = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Runtime Test', showChecked: true, defaultConfiguration: 'Debug', showAllOSChoices: true });
            }
        } else {
            testConfig = crossgen2Config = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Crossgen2 & Runtime Test', showChecked: true, defaultConfiguration: 'Debug' });
        }
        if (!crossgen2Config || !testConfig) {
            return undefined;
        }

        let artifactPath = getRuntimeTestArtifactsPath(folder.uri, testConfig);
        let runtimeTest = await userPrompts.promptUserForRuntimeTest({ workspace: folder.uri, configuration: testConfig });

        if (!runtimeTest) {
            return undefined;
        }

        runtimeTest = path.join(artifactPath, runtimeTest);
        let runtimeTestDir = path.dirname(runtimeTest);

        if (debugConfiguration.selectReferencedAssembly) {
            // If the user wants to run crossgen2 on an assembly that is referenced by this runtime test, ask them to select which assembly to use.
            let otherAssemblies = (await promisify(glob)(path.join(runtimeTestDir, '*.dll'))).map(assembly => path.basename(assembly)).filter(assembly => assembly !== 'composite-r2r.dll');
            if (otherAssemblies.length !== 0) {
                let selectedAssembly = await userPrompts.promptQuickPick(otherAssemblies, { title: 'Assembly to crossgen', default: path.basename(runtimeTest) });
                if (!selectedAssembly) {
                    return undefined;
                }
                runtimeTest = path.join(runtimeTestDir, selectedAssembly);
            }
        }

        let ilAssemblyDirectory = path.join(runtimeTestDir, 'IL-CG2');
        let rspFile = `${runtimeTest}.rsp`;

        if (debugConfiguration.composite) {
            rspFile = path.join(ilAssemblyDirectory, 'composite-r2r.dll.rsp');
        }

        if (!existsSync(ilAssemblyDirectory)) {
            await mkdir(ilAssemblyDirectory);
            await moveCopyAssembliesToILSubdirectory(runtimeTest);
        }

        writeResponseFile(rspFile, path.join(artifactPath, 'Tests', 'Core_Root'), testConfig.arch, ilAssemblyDirectory, runtimeTest, debugConfiguration.composite || false);

        let extraArgs: string[] = [];
        if (!debugConfiguration.composite) {
            extraArgs.concat(`-r:${ilAssemblyDirectory}/*.dll`);
        }

        return transformConfig(debugConfiguration, getCoreClrOutputRootPath(folder.uri, crossgen2Config), rspFile, ...extraArgs, ...(debugConfiguration.args || []));
    }
    return debugConfiguration;
}