import path = require('path');
import * as vscode from 'vscode';
import { parse } from 'jsonc-parser';
import { getRuntimeWorkspaceFolder } from './userPrompts';
import { readFile } from 'fs/promises';

// Import settings from the devcontainer configuration file into the local .vscode/settings.json file
// if the setting is not already specified.
export async function importSettingsFromDevContainer() {
    const workspace = await getRuntimeWorkspaceFolder();
    if (!workspace) {
        return;
    }
    const devContainerConfig = parse(await readFile(path.join(workspace.fsPath, '.devcontainer', 'devcontainer.json'), 'utf-8'));
    const devContainerSettings = devContainerConfig.settings;
    const configuration = vscode.workspace.getConfiguration();
    for (const setting in devContainerSettings) {
        if (Object.prototype.hasOwnProperty.call(devContainerSettings, setting)) {
            let value = devContainerSettings[setting];
            if (typeof value === 'string') {
                value = value.replace('${containerWorkspaceFolder}', '${workspaceFolder}');
            }
            let configurationResult = configuration.inspect<any>(setting);
            if (!configurationResult || (!configurationResult.workspaceValue && !configurationResult.workspaceFolderValue)) {
                await configuration.update(setting, value);
            }
        }
    }
}