import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import * as vscode from 'vscode';
import * as path from 'path';
import { getRuntimeWorkspaceFolderUri } from './userPrompts';
import * as os from 'os';
import log from './log';
import { RequestType, RequestType2, RequestType4 } from 'vscode-jsonrpc/node';
import { OutputConfiguration } from './outputConfiguration';
import { BuildSubset } from './helpers';

export function setServerPathFromExtensionContext(context: vscode.ExtensionContext) {
    serverPath = path.join(context.extensionUri.fsPath, 'out', 'server', 'AssistantServer.dll');
}

let serverPath: string = null!;

let currentServerConnection: rpc.MessageConnection | null = null;

let serverLog = vscode.window.createOutputChannel('dotnet-runtime-test-assistant Server');

function getDotnetScriptExtension() {
    if (os.platform() === 'cygwin' || os.platform() === 'win32') {
        return '.cmd';
    }
    return '.sh';
}

export async function getOrStartServerConnection(): Promise<rpc.MessageConnection> {
    if (currentServerConnection !== null) {
        return currentServerConnection;
    }

    log('preparing to start server');
    let runtimeWorkspaceFolder = await getRuntimeWorkspaceFolderUri();
    if (!runtimeWorkspaceFolder) {
        log('unable to start server when no dotnet/runtime workspace is open');
        throw new Error('Unable to use the assistant server when no dotnet/runtime workspace is open.');
    }
    log(`starting server process at path: '${serverPath}'`);
    let serverProc = cp.spawn(
        path.join(runtimeWorkspaceFolder.fsPath, `dotnet${getDotnetScriptExtension()}`),
        [serverPath]);
    serverProc.stderr.setEncoding('utf8');
    serverProc.stderr.on('data', data => {
        serverLog.append(data.toString());
    });
    serverProc.on('close', exitCode => {
        log(`Server exited with code '${exitCode}'`);
        currentServerConnection!.dispose();
        currentServerConnection = null;
    });

    log(`Connecting to server (pid ${serverProc.pid})`);
    let connection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(serverProc.stdout),
        new rpc.StreamMessageWriter(serverProc.stdin),
    );

    connection.listen();
    currentServerConnection = connection;
    log('Connected to server');
    return currentServerConnection;
}

export async function disconnectServer() {
    const server = currentServerConnection;
    currentServerConnection = null;
    server?.end();
    server?.dispose();
}

namespace GetProjectProperties {
    export const method = 'GetProjectProperties';

    type Response<TProperties extends string[]> = {
        [key in TProperties[number]]: string;
    };

    export function getRequestType<TProperties extends string[]>() {
        return new RequestType2<string, TProperties, Response<TProperties>, void>(method);
    }
}

export async function getProjectProperties<TProperty extends string>(projectFilePath: string, ...properties: TProperty[]) {
    log(`Getting the following properties defined in the project file at '${projectFilePath}': ${properties}`);
    const serverConnection = await getOrStartServerConnection();
    return await serverConnection.sendRequest(GetProjectProperties.getRequestType<TProperty[]>(), projectFilePath, properties);
}

export async function getNetCoreAppCurrentProperty() {
    const runtimeWorkspaceFolder = await getRuntimeWorkspaceFolderUri();
    return (await getProjectProperties(path.join(runtimeWorkspaceFolder!.fsPath, 'Build.proj'), 'NetCoreAppCurrent')).NetCoreAppCurrent;
}

namespace TryCreateVsCodeRunSettings {
    export const method = 'TryCreateVsCodeRunSettings';

    export const type = new RequestType4<string, string, string, string, boolean, void>(method);
}

export async function tryCreateVsCodeRunSettings(preTestProjectPath: string, configuration: OutputConfiguration) {
    log(`Regenerating the vscode RunSettings file for the provided configuration '${configuration.os}-${configuration.configuration}-${configuration.arch}'`);
    const serverConnection = await getOrStartServerConnection();
    return await serverConnection.sendRequest(TryCreateVsCodeRunSettings.type, preTestProjectPath, configuration.os, configuration.arch, configuration.configuration);
}

namespace GenerateIlcResponseFile {
    export const method = 'GenerateIlcResponseFile';

    export const type = new RequestType4<string, string, string, string, string, void>(method);
}

export async function generateIlcResponseFile(runtimeTestProjectPath: string, configuration: OutputConfiguration) {
    log(`Generating ILC response file for the runtime test '${runtimeTestProjectPath}' with configuration '${configuration.os}.${configuration.arch}.${configuration.configuration}'`);
    const serverConnection = await getOrStartServerConnection();
    return await serverConnection.sendRequest(GenerateIlcResponseFile.type, runtimeTestProjectPath, configuration.os, configuration.arch, configuration.configuration);
}

namespace GetBuildSubsets {
    export const method = 'GetBuildSubsets';

    export const type = new RequestType<string, BuildSubset[], void>(method);
}

export async function getBuildSubsets(rootBuildProjectPath: string) {
    log('Getting build subsets');
    const serverConnection = await getOrStartServerConnection();
    return await serverConnection.sendRequest(GetBuildSubsets.type, rootBuildProjectPath);
}
