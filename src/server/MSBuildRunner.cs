using Microsoft.Build.Construction;
using Microsoft.Build.Evaluation;
using Microsoft.Build.Locator;
using Microsoft.Extensions.Logging;
using StreamJsonRpc;

namespace AssistantServer;

internal sealed partial class MSBuildRunner
{
    [LoggerMessage(
        EventId = 0,
        Level = LogLevel.Trace,
        Message = "Getting target frameworks from project file: {projectFile}"
    )]
    private static partial void LogGetProjectTargetFrameworks(ILogger logger, string projectFile);

    private readonly ILogger logger;

    public MSBuildRunner(ILogger logger)
    {
        this.logger = logger;
    }

    static MSBuildRunner()
    {
        MSBuildLocator.RegisterInstance(MSBuildLocator.QueryVisualStudioInstances(new VisualStudioInstanceQueryOptions { DiscoveryTypes = DiscoveryType.DotNetSdk }).First());
    }

    public string GetProjectTargetFrameworks(string projectPath)
    {
        LogGetProjectTargetFrameworks(logger, projectPath);
        var project = new Project(ProjectRootElement.Open(projectPath));
        var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
        return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks : project.GetPropertyValue("TargetFramework");
    }
}
