import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { getRuntimeWorkspaceFolder } from '../userPrompts';
import { TextDecoder } from 'util';

interface BuildTaskDefinition extends vscode.TaskDefinition {
    type: 'runtime-build',
    configuration?: 'Debug' | 'Checked' | 'Release',
    runtimeConfiguration?: 'Debug' | 'Checked' | 'Release',
    librariesConfiguration?: 'Debug' | 'Release',
    arch?: string,
    runtimeFlavor?: 'CoreCLR' | 'Mono',
    subsets?: string,
    args?: string[],
}

function isBuildTaskDefinition(def: vscode.TaskDefinition): def is BuildTaskDefinition {
    return def.type === 'runtime-build';
}

const decoder = new TextDecoder();

export async function provideTasks(token: vscode.CancellationToken): Promise<vscode.Task[] | undefined> {
    let folder = await getRuntimeWorkspaceFolder();
    if (!folder) {
        return undefined;
    }
    const presetTasks = await Promise.all([
        new vscode.Task(
            {
                type: 'runtime-build',
                configuration: 'Debug',
            },
            folder,
            'Build Debug, prompt for subsets',
            'DN/RT-Test',
            undefined,
            '$mscompile'),
        new vscode.Task(
            {
                type: 'runtime-build',
                runtimeConfiguration: 'Debug',
                librariesConfiguration: 'Release',
                subsets: 'clr+libs'
            },
            folder,
            'Build CoreCLR Debug, Libraries Release',
            'DN/RT-Test',
            undefined,
            '$mscompile'),
        new vscode.Task(
            {
                type: 'runtime-build',
                runtimeConfiguration: 'Release',
                librariesConfiguration: 'Debug',
                subsets: 'clr+libs'
            },
            folder,
            'Build CoreCLR Release, Libraries Debug',
            'DN/RT-Test',
            undefined,
            '$mscompile'),
    ].map(task => resolveTask(task, token)));

    // We have too many task options to show them all in the quick pick menu, so we just show common ones
    // and whichever ones the user has already configured in their tasks.json file.
    const userDefinedTaskDefinitions = jsonc.parse(decoder.decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, '.vscode', 'runtime-tasks.json'))));
    const userDefinedTasks = await Promise.all((userDefinedTaskDefinitions.tasks as any[])
        .map((task: any) =>
            new vscode.Task(
                task,
                folder!,
                task.label,
                'DN/RT-Test',
                undefined,
                '$mscompile'
            ))
        .map(task => resolveTask(task, token)));

    return presetTasks.concat(userDefinedTasks);
}

export async function resolveTask(task: vscode.Task, _token: vscode.CancellationToken): Promise<vscode.Task> {
    if (isBuildTaskDefinition(task.definition)) {
        if (task.definition.subsets === undefined) {
            task.definition.subsets = '${command:dotnet-runtime-test-assistant.getSubsetsToBuild}';
        }

        let buildScript = path.join((<vscode.WorkspaceFolder>task.scope).uri.fsPath, 'build');

        if (os.platform() !== 'win32') {
            buildScript += '.sh';
        }

        const additionalArgs = task.definition.args?.join(' ') ?? '';
        const generateArg = (name: string, value: string | undefined) => value ? `-${name} ${value}` : '';
        const execution = new vscode.ShellExecution(`${buildScript} ${task.definition.subsets} ${generateArg('c', task.definition.configuration)} ${generateArg('rc', task.definition.runtimeConfiguration)} ${generateArg('lc', task.definition.librariesConfiguration)} ${generateArg('a', task.definition.arch)}  ${generateArg('rf', task.definition.runtimeFlavor)} ${additionalArgs}`);
        task = new vscode.Task(
            task.definition,
            task.scope!,
            task.name,
            task.source,
            execution,
            task.problemMatchers);
    }

    return task;
}