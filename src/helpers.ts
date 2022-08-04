
import * as path from 'path';
import { DebugConfiguration, Uri } from 'vscode';
import { OutputConfiguration } from './outputConfiguration';

export function transformEnvBlock(env: { [key: string]: string }): { key: string, value: string }[] {
    let result = [];

    for (const key in env) {
        if (Object.prototype.hasOwnProperty.call(env, key)) {
            result.push({ key: key, value: env[key] });
        }
    }

    return result;
}

export function getRuntimeTestArtifactsPath(workspaceRoot: Uri, configuration: OutputConfiguration) {
    return path.join(workspaceRoot.fsPath, 'artifacts', 'tests', 'coreclr', `${configuration.os}.${configuration.arch}.${configuration.configuration}`);
}

export function getArtifactsBinPath(workspaceRoot: Uri) {
    return path.join(workspaceRoot.fsPath, 'artifacts', 'bin');
}

export function getCoreClrOutputRootPath(workspaceRoot: Uri, configuration: OutputConfiguration) {
    return path.join(workspaceRoot.fsPath, 'artifacts', 'bin', 'coreclr', `${configuration.os}.${configuration.arch}.${configuration.configuration}`);
}

export function getLibrariesTestHostPath(workspaceRoot: Uri, configuration: OutputConfiguration, tfm: string) {
    return path.join(workspaceRoot.fsPath, 'artifacts', 'bin', 'testhost', `${tfm}-${configuration.os}-${configuration.configuration}-${configuration.arch}`);
}

export interface DebugConfigurationBase extends DebugConfiguration {
    env: { [key: string]: string; },
    cwd: string,
    args?: string[],
    request: 'launch',
    stopAtEntry: boolean
}
