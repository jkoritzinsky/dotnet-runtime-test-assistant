import * as path from "path";
import * as vscode from 'vscode';
import * as userPrompts from '../userPrompts';
import { DebugConfigurationBase, transformEnvBlock, getLibrariesTestHostPath, getArtifactsBinPath } from '../helpers';
import { getNetCoreAppCurrentProperty, getProjectProperties } from "../server";

type DebugConfigurationType = 'rt-libsnative';

export const DEBUG_CONFIGURATION_TYPE : DebugConfigurationType = 'rt-libsnative';

interface RuntimeTestConfiguration extends DebugConfigurationBase
{
    type: DebugConfigurationType;
    outerloop?: boolean;
}

function isLibsNativeTestConfiguration(debugConfiguration: vscode.DebugConfiguration): debugConfiguration is RuntimeTestConfiguration {
    return debugConfiguration.type === DEBUG_CONFIGURATION_TYPE;
}

function transformToCppvsdbgConfig(debugConfiguration: RuntimeTestConfiguration, dotnet: string, cwd: string, args: string[]): vscode.DebugConfiguration {
    if (debugConfiguration.args) {
        args = args.concat(debugConfiguration.args);
    }
    return {
        name : debugConfiguration.name,
        type: 'cppvsdbg',
        request: debugConfiguration.request,
        program: dotnet,
        args: args,
        stopAtEntry: debugConfiguration.stopAtEntry,
        cwd: debugConfiguration.cwd ?? cwd,
        environment: transformEnvBlock(debugConfiguration.env),
        console: 'internalConsole'
    };
}

function transformToLLDBConfig(debugConfiguration: RuntimeTestConfiguration, dotnet: string, cwd: string, args: string[]): vscode.DebugConfiguration {
    if (debugConfiguration.args) {
        args = args.concat(debugConfiguration.args);
    }
    return {
        name : debugConfiguration.name,
        type : 'lldb',
        request: debugConfiguration.request,
        program: dotnet,
        args: args,
        stopOnEntry: debugConfiguration.stopAtEntry,
        cwd: debugConfiguration.cwd ?? cwd,
        env: debugConfiguration.env,
        initCommands: [ 'command source ~/.lldbinit' ]
    };
}

export function provideDebugConfigurations(_folder: vscode.WorkspaceFolder | undefined, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
        {
            type: DEBUG_CONFIGURATION_TYPE,
            request: 'launch',
            name: 'Launch Libraries Test',
            args: [],
            env: {},
            stopAtEntry: false
        }
    ];
}

export async function resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
    if (isLibsNativeTestConfiguration(debugConfiguration)) {
        if (!folder) {
            return undefined;
        }
        let configuration = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Libraries Test Host', showChecked: false, defaultConfiguration: 'Debug' });
        if (!configuration) {
            return undefined;
        }
        let netCoreAppCurrentTfm = await getNetCoreAppCurrentProperty();
        let testHostPath = getLibrariesTestHostPath(folder.uri, configuration, netCoreAppCurrentTfm);
        let dotnet = path.join(testHostPath, `dotnet${configuration.os === 'windows' ? '.exe' : ''}`);
        let librariesTest = await userPrompts.promptUserForLibrariesTest({ workspace: folder.uri, configuration: configuration });

        if (!librariesTest) {
            return undefined;
        }

        let librariesTestDir = path.join(getArtifactsBinPath(folder.uri), librariesTest.projectName, configuration.configuration, librariesTest.tfm);

        let projectProperties = await getProjectProperties(librariesTest.projectPath, 'GenerateDependencyFile');

        let args  = ['exec'];
        args.push('--runtimeconfig');
        args.push(`${librariesTest.projectName}.runtimeconfig.json`);
        if (projectProperties.GenerateDependencyFile === 'true') {
            args.push('--depsfile');
            args.push(`${librariesTest.projectName}.deps.json`);
        }
        args.push('xunit.console.dll', `${librariesTest.projectName}.dll`, '-xml', 'testResults.xml', '-nologo');
        if (!debugConfiguration.outerloop) {
            args.push('-notrait', 'category=Outerloop');
        }
        args.push('-notrait', 'category=failing');

        if (configuration.os === 'windows') {
            return transformToCppvsdbgConfig(debugConfiguration, dotnet, librariesTestDir, args);
        } else {
            return transformToLLDBConfig(debugConfiguration, dotnet, librariesTestDir, args);
        }
    }
    return debugConfiguration;
}