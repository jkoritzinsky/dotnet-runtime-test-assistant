import { debug } from 'console';
import * as path from 'path';
import * as vscode from 'vscode';
import * as userPrompts from '../userPrompts';
import { transformEnvBlock, getRuntimeTestArtifactsPath, DebugConfigurationBase } from '../helpers';

type DebugConfigurationType = 'rt-runtimetest';

export const DEBUG_CONFIGURATION_TYPE : DebugConfigurationType = 'rt-runtimetest';

interface RuntimeTestConfiguration extends DebugConfigurationBase
{
    type: DebugConfigurationType,
    dotenvPath?: string,
}

function isRuntimeTestConfiguration(debugConfiguration: vscode.DebugConfiguration): debugConfiguration is RuntimeTestConfiguration {
    return debugConfiguration.type === DEBUG_CONFIGURATION_TYPE;
}

function transformToCppvsdbgConfig(debugConfiguration: RuntimeTestConfiguration, corerun: string, runtimeTest: string): vscode.DebugConfiguration {
    let args: string[] = [];
    if (debugConfiguration.dotenvPath) {
        args.push('-e');
        args.push(debugConfiguration.dotenvPath);
    }
    args.push(runtimeTest);
    if (debugConfiguration.args) {
        args = args.concat(debugConfiguration.args);
    }
    return {
        name : debugConfiguration.name,
        type: 'cppvsdbg',
        request: debugConfiguration.request,
        program: corerun,
        args: args,
        stopAtEntry: debugConfiguration.stopAtEntry,
        cwd: debugConfiguration.cwd ?? path.dirname(runtimeTest),
        environment: transformEnvBlock(debugConfiguration.env),
        console: 'internalConsole'
    };
}

function transformToLLDBConfig(debugConfiguration: RuntimeTestConfiguration, corerun: string, runtimeTest: string): vscode.DebugConfiguration {
    let args: string[] = [];
    if (debugConfiguration.dotenvPath) {
        args.push('-e');
        args.push(debugConfiguration.dotenvPath);
    }
    args.push(runtimeTest);
    if (debugConfiguration.args) {
        args = args.concat(debugConfiguration.args);
    }
    return {
        name : debugConfiguration.name,
        type : 'lldb',
        request: debugConfiguration.request,
        program: corerun,
        args: args,
        stopOnEntry: debugConfiguration.stopAtEntry,
        cwd: debugConfiguration.cwd ?? path.dirname(runtimeTest),
        env: debugConfiguration.env,
        initCommands: [ 'command source ~/.lldbinit' ]
    };
}

export function provideDebugConfigurations(_folder: vscode.WorkspaceFolder | undefined, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
        {
            type: DEBUG_CONFIGURATION_TYPE,
            request: 'launch',
            name: 'Launch Runtime Test',
            args: [],
            env: {},
            stopAtEntry: false
        }
    ];
}

export async function resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
    if (isRuntimeTestConfiguration(debugConfiguration)) {
        if (!folder) {
            return undefined;
        }
        let configuration = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Runtime Test', showChecked: true, defaultConfiguration: 'Debug' });
        if (!configuration) {
            return undefined;
        }
        let artifactPath = getRuntimeTestArtifactsPath(folder.uri, configuration);
        let corerun = path.join(artifactPath, 'Tests', 'Core_Root', `corerun${configuration.os === 'windows' ? '.exe' : ''}`);
        let runtimeTest = await userPrompts.promptUserForRuntimeTest({ workspace: folder.uri, configuration: configuration });

        if (!runtimeTest) {
            return undefined;
        }

        runtimeTest = path.join(artifactPath, runtimeTest);

        if (configuration.os === 'windows') {
            return transformToCppvsdbgConfig(debugConfiguration, corerun, runtimeTest);
        } else {
            return transformToLLDBConfig(debugConfiguration, corerun, runtimeTest);
        }
    }
    return debugConfiguration;
}