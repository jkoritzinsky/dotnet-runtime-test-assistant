using System.Runtime.CompilerServices;
using Microsoft.Extensions.Logging;

namespace AssistantServer;

internal static partial class Log
{
    [LoggerMessage(
        EventId = 0,
        Level = LogLevel.Information,
        Message = "Server starting up (pid {pid})"
    )]
    public static partial void Startup(this ILogger logger, int pid);

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Getting target frameworks from project file: {projectFile}"
    )]
    public static partial void GetProjectTargetFrameworks(this ILogger logger, string projectFile);

    [LoggerMessage(
        EventId = 2,
        Level = LogLevel.Information,
        Message = "Getting properties '{properties}' from project file '{projectFile}'."
    )]
    public static partial void GetProjectProperties(this ILogger logger, string projectFile, string[] properties);

    [LoggerMessage(
        EventId = 3,
        Level = LogLevel.Information,
        Message = "MSBuild: {message}"
    )]
    public static partial void LogMSBuildOutput(this ILogger logger, string message);

    [LoggerMessage(
        EventId = 4,
        Level = LogLevel.Information,
        Message = "Creating MSBuild binary log at '{path}' for the current request {requestType}"
    )]
    public static partial void BinlogPathForRequest(this ILogger logger, string path, string requestType);

    [LoggerMessage(
        EventId = 5,
        Level = LogLevel.Information,
        Message = "Getting build subset items from project file '{projectFile}'."
    )]
    public static partial void GetBuildSubsets(this ILogger logger, string projectFile);
}