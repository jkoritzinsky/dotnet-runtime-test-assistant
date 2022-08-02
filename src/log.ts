import { window } from "vscode";

let outputChannel = window.createOutputChannel("dotnet-runtime-test-assistant");

export default function log(log: string) {
    outputChannel.appendLine(log);
}