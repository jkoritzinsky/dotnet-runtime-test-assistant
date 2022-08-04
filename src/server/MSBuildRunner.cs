using Microsoft.Build.Evaluation;
using Microsoft.Build.Execution;
using Microsoft.Build.Locator;
using Microsoft.Build.Logging;
using Microsoft.Extensions.Logging;
using MSBuildLoggerVerbosity = Microsoft.Build.Framework.LoggerVerbosity;

namespace AssistantServer;

internal sealed partial class MSBuildRunner
{
    private readonly ProjectCollection projectCollection;
    private readonly BuildManager buildManager;
    private readonly ILogger logger;

    public MSBuildRunner(ILogger logger)
    {
        this.logger = logger;
        projectCollection = new ProjectCollection();
        // Forward the MSBuild logging through our logging mechanism
        projectCollection.RegisterLogger(new ConsoleLogger(MSBuildLoggerVerbosity.Normal, line => logger.LogMSBuildOutput(line), _ => { }, () => { }));
        buildManager = new BuildManager("AssistantServer");
        buildManager.BeginBuild(new BuildParameters(projectCollection));
    }

    public string[] GetProjectTargetFrameworks(string projectPath)
    {
        logger.GetProjectTargetFrameworks(projectPath);
        var project = projectCollection.LoadProject(projectPath);
        var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
        return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks.Split(';') : new string[] { project.GetPropertyValue("TargetFramework") };
    }

    public Dictionary<string, string> GetProjectProperties(string projectPath, string[] properties)
    {
        logger.GetProjectProperties(projectPath, properties);
        var project = projectCollection.LoadProject(projectPath);
        Dictionary<string, string> results = new();
        foreach (var property in properties)
        {
            results[property] = project.GetPropertyValue(property);
        }
        return results;
    }

    public bool TryCreateVsCodeRunSettings(string preTestProject, string operatingSystem, string architecture, string configuration)
    {
        var projectInstance = buildManager.GetProjectInstanceForBuild(
            projectCollection.LoadProject(preTestProject, new Dictionary<string, string>
            {
                { "TargetOS", operatingSystem },
                { "TargetArchitecture", architecture },
                { "Configuration", configuration },
                { "CreateVsCodeRunSettingsFile", "true" }
            },
            projectCollection.DefaultToolsVersion));
        var submission = buildManager.BuildRequest(new BuildRequestData(projectInstance, new[] { "GenerateRunSettingsFile" }));

        return submission.OverallResult == BuildResultCode.Success;
    }
}
