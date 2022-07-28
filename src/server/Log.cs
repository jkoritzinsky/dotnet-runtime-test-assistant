using Microsoft.Extensions.Logging;

namespace AssistantServer;

internal partial class Log
{
    [LoggerMessage(
        EventId = 0,
        Level = LogLevel.Information,
        Message = "Server starting up (pid {pid})"
    )]
    public static partial void Startup(ILogger logger, int pid);

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Getting target frameworks from project file: {projectFile}"
    )]
    public static partial void GetProjectTargetFrameworks(ILogger logger, string projectFile);
}