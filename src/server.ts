import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import * as vscode from 'vscode';
import * as path from 'path';
import { getRuntimeWorkspaceFolder } from './userPrompts';
import * as os from 'os';
import log from './log';
import { RequestType2, RequestType4 } from 'vscode-jsonrpc/node';
import { OutputConfiguration } from './outputConfiguration';

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
    let runtimeWorkspaceFolder = await getRuntimeWorkspaceFolder();
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
    const runtimeWorkspaceFolder = await getRuntimeWorkspaceFolder();
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
