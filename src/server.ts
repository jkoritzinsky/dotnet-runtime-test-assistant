import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import * as vscode from 'vscode';
import * as path from 'path';
import { getRuntimeWorkspaceFolder } from './userPrompts';
import log from './log';

export function setServerPathFromExtensionContext(context: vscode.ExtensionContext)
{
    serverPath = path.join(context.extensionUri.fsPath, "out", "server", "AssistantServer.dll");
}

let serverPath: string = null!;

let currentServerConnection: rpc.MessageConnection | null = null;

export async function getOrStartServerConnection(): Promise<rpc.MessageConnection | null>
{
    if (currentServerConnection !== null) {
        return currentServerConnection;
    }

    log('preparing to start server');
    let runtimeWorkspaceFolder = await getRuntimeWorkspaceFolder();
    if (!runtimeWorkspaceFolder) {
        log('unable to start server when no dotnet/runtime workspace is open');
        return null;
    }
    log(`starting server process at path: '${serverPath}'`);
    let serverProc = cp.spawn(serverPath);

    // TODO: Output logging from server's stderr to our logging mechanism in vscode.

    log(`connecting to server (pid ${serverProc.pid})`);
    let connection = rpc.createMessageConnection(
        new rpc.StreamMessageReader(serverProc.stdout),
        new rpc.StreamMessageWriter(serverProc.stdin),
    );

    connection.listen();
    currentServerConnection = connection;
    log('connected to server');
    return currentServerConnection;
}