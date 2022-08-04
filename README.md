# dotnet-runtime-test-assistant

The dotnet-runtime-test-assistant supports common workflows of developers in the dotnet/runtime GitHub repository.

## Features

This extension provides the following debugging configuration templates:

- rt-runtimetest: Launch a "runtime test" (a test under the src/tests path) with corerun.
- rt-cg2corelib: Launch crossgen2 to run across System.Private.CoreLib and debug with a managed debugger.
- rt-cg2rt: Launch crossgen2 to run across a runtime test assembly and debug with a managed debugger.
- rt-libsnative: Launch a libraries test assembly and debug with a native debugger.

This extension provides the following commands:

- DN/RT-Test: Import settings from .devcontainer file
    - Copy known-good settings from the devcontainer file to the local settings.json file for non-devcontainer usages.
- DN/RT-Test: Configure the .runsettings file for running tests in VSCode
    - Configure the .runsettings file created for VSCode users (pointed to by settings in the devcontainer files) for a particular configuration for running tests with the VSCode test explorer and CodeLens integration.

## Requirements

This extension requires the C# extension, the C++ extension, and the CodeLLDB extension.

## Extension Settings

## Known Issues

None at the moment.
## Release Notes

### 1.0.0

Initial release of dotnet-runtime-test-assistant