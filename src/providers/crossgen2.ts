import { debug } from "console";
import * as path from "path";
import * as vscode from 'vscode';
import * as userPrompts from '../userPrompts';
import { transformEnvBlock, getRuntimeTestArtifactsPath, DebugConfigurationBase, getCoreClrOutputRootPath } from '../helpers';

type DebugConfigurationType = 'rt-cg2corelib';

export const DEBUG_CONFIGURATION_TYPE : DebugConfigurationType = 'rt-cg2corelib';

interface Crossgen2CoreLibConfiguration extends DebugConfigurationBase
{
    type: DebugConfigurationType,
    separateConfig?: boolean
}

function isCrossgen2CoreLibConfiguration(debugConfiguration: vscode.DebugConfiguration): debugConfiguration is Crossgen2CoreLibConfiguration
{
    return debugConfiguration.type === DEBUG_CONFIGURATION_TYPE;
}

export function transformConfigForCoreLib(debugConfiguration: Crossgen2CoreLibConfiguration, crossgenBuildCoreClrBin: string, corelibBuildCoreClrBin: string, targetArch: string)
{
    return {
        name : debugConfiguration.name,
        type : 'coreclr',
        request: 'launch',
        program: path.join(crossgenBuildCoreClrBin, 'crossgen2', 'crossgen2.dll'),
        args: [
            `-o:${path.join(corelibBuildCoreClrBin, 'System.Private.CoreLib.dll')}`,
            `-r:${path.join(corelibBuildCoreClrBin, 'IL', '*.dll')}`,
            `--targetarch:${targetArch}`,
            '-O',
            `${path.join(corelibBuildCoreClrBin, 'IL', 'System.Private.CoreLib')}`
        ]
    };
}

export function provideDebugConfigurations(_folder: vscode.WorkspaceFolder | undefined, _token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]>
{
    return [
        {
            type: DEBUG_CONFIGURATION_TYPE,
            request: 'launch',
            name: 'Crossgen2 on System.Private.CoreLib',
            args: [],
            env: {},
            stopAtEntry: false
        }
    ];
}

export async function resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, _token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined>
{
    if (isCrossgen2CoreLibConfiguration(debugConfiguration)) {
        if (!folder) {
            return undefined;
        }
        let crossgen2Config: userPrompts.OutputConfiguration | undefined;
        let corelibConfig: userPrompts.OutputConfiguration | undefined;
        if (debugConfiguration.separateConfig) {
            crossgen2Config = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Crossgen2', showChecked: true, defaultConfiguration: 'Debug' });
            if (crossgen2Config)
            {
                corelibConfig = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'System.Private.CoreLib', showChecked: true, defaultConfiguration: 'Debug' });
            }
        } else {
            corelibConfig = crossgen2Config = await userPrompts.promptUserForTargetConfiguration({ promptPrefix: 'Crossgen2 & System.Private.CoreLib', showChecked: true, defaultConfiguration: 'Debug' });
        }
        if (!crossgen2Config || !corelibConfig) {
            return undefined;
        }

        return transformConfigForCoreLib(debugConfiguration, getCoreClrOutputRootPath(folder.uri, crossgen2Config), getCoreClrOutputRootPath(folder.uri, corelibConfig), corelibConfig.arch);
    }
    return debugConfiguration;
}