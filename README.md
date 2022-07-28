# dotnet-runtime-test-assistant

The dotnet-runtime-test-assistant supports common workflows of developers in the dotnet/runtime GitHub repository.

## Features

This extension provides the following debugging configuration templates:

- rt-runtimetest: Launch a "runtime test" (a test under the src/tests path) with corerun.
- rt-cg2corelib: Launch crossgen2 to run across System.Private.CoreLib and debug with a managed debugger.

## Requirements

This extension requires the C# extension on all platforms, the C++ extension on Windows, and the CodeLLDB extension on non-Windows.

## Extension Settings

## Known Issues

None at the moment.
## Release Notes

### 1.0.0

Initial release of dotnet-runtime-test-assistant