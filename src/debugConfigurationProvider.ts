import { debug } from "console";
import * as path from "path";
import * as vscode from 'vscode';
import * as userPrompts from './userPrompts';

interface DebugConfigurationBase extends vscode.DebugConfiguration
{
    env: { [key: string]: string; },
    cwd: string,
    args?: string[],
    request: 'launch',
    stopAtEntry: boolean
}

interface RuntimeTestConfiguration extends DebugConfigurationBase
{
    type: "rt-runtimetest",
    dotenvPath?: string,
}

function isRuntimeTestConfiguration(debugConfiguration: vscode.DebugConfiguration): debugConfiguration is RuntimeTestConfiguration
{
    return debugConfiguration.type === "rt-runtimetest";
}

function transformEnvBlock(env: { [key: string]: string }): { key: string, value: string }[]
{
    let result = [];

    for (const key in env) {
        if (Object.prototype.hasOwnProperty.call(env, key)) {
            result.push({ key: key, value: env[key] });
        }
    }

    return result;
}

function transformToCppvsdbgConfig(debugConfiguration: RuntimeTestConfiguration, corerun: string, runtimeTest: string): vscode.DebugConfiguration
{
    let args: string[] = [];
    if (debugConfiguration.dotenvPath) {
        args.push('-e');
        args.push(debugConfiguration.dotenvPath);
    }
    args.push(runtimeTest);
    if (debugConfiguration.args) {
        args.concat(debugConfiguration.args);
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

function transformToLLDBConfig(debugConfiguration: RuntimeTestConfiguration, corerun: string, runtimeTest: string): vscode.DebugConfiguration
{
    let args: string[] = [];
    if (debugConfiguration.dotenvPath) {
        args.push('-e');
        args.push(debugConfiguration.dotenvPath);
    }
    args.push(runtimeTest);
    if (debugConfiguration.args) {
        args.concat(debugConfiguration.args);
    }
    return {
        name : debugConfiguration.name,
        type : 'lldb',
        request: debugConfiguration.request,
        program: corerun,
        args: args,
        stopAtEntry: debugConfiguration.stopAtEntry,
        cwd: debugConfiguration.cwd ?? path.dirname(runtimeTest),
        env: debugConfiguration.env,
        initCommands: [ 'command source ~/.lldbinit' ]
    };
}

export function provideDebugConfigurations(_folder: vscode.WorkspaceFolder | undefined, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]>
{
    return [
        {
            type: 'rt-runtimetest',
            request: 'launch',
            name: 'Launch Runtime Test',
            args: [],
            env: {},
            stopAtEntry: false
        }
    ];
}

export async function resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined>
{
    if (isRuntimeTestConfiguration(debugConfiguration)) {
        if (!folder) {
            return undefined;
        }
        let configuration = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Runtime Test', showChecked: true, defaultConfiguration: 'Debug' });
        if (!configuration) {
            return undefined;
        }
        let artifactPath = folder.uri.fsPath + `${path.sep}artifacts${path.sep}tests${path.sep}coreclr${path.sep}${configuration.os}.${configuration.arch}.${configuration.configuration}${path.sep}`;
        let corerun = artifactPath + `Tests${path.sep}Core_Root${path.sep}corerun${configuration.os === 'windows' ? '.exe' : ''}`;
        let runtimeTest = artifactPath + await userPrompts.promptUserForRuntimeTest({ workspace: folder.uri, configuration: configuration });

        if (!runtimeTest) {
            return undefined;
        }

        if (configuration.os === 'windows') {
            return transformToCppvsdbgConfig(debugConfiguration, corerun, runtimeTest);
        } else {
            return transformToLLDBConfig(debugConfiguration, corerun, runtimeTest);
        }
    }
    return debugConfiguration;
}