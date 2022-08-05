using Microsoft.Build.Evaluation;
using Microsoft.Build.Execution;
using Microsoft.Build.Locator;
using Microsoft.Build.Logging;
using Microsoft.Extensions.Logging;
using MSBuildLoggerVerbosity = Microsoft.Build.Framework.LoggerVerbosity;

namespace AssistantServer;

internal sealed partial class MSBuildRunner : IDisposable
{
    private readonly ProjectCollection projectCollection;
    private readonly BuildManager buildManager;
    private readonly ILogger logger;
    private event Action OnDispose;

    public MSBuildRunner(ILogger logger)
    {
        this.logger = logger;
        projectCollection = new ProjectCollection();
        // Forward the MSBuild logging through our logging mechanism
        projectCollection.RegisterLogger(
            new ConsoleLogger(
                MSBuildLoggerVerbosity.Normal,
                line =>
                    logger.LogMSBuildOutput(line),
                    _ => { },
                    () => { }));
        var binlogPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Temp", "dnrt-assistant", $"{Environment.ProcessId}.binlog");
        BinaryLogger binaryLog = new() { Parameters = binlogPath, Verbosity = MSBuildLoggerVerbosity.Diagnostic };
        projectCollection.RegisterLogger(binaryLog);
        buildManager = new BuildManager("AssistantServer");
        buildManager.BeginBuild(new BuildParameters(projectCollection));
        OnDispose += buildManager.EndBuild;
        OnDispose += binaryLog.Shutdown;
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

    public string? GenerateIlcResponseFile(string testProject, string operatingSystem, string architecture, string configuration)
    {
        var projectInstance = buildManager.GetProjectInstanceForBuild(
            projectCollection.LoadProject(testProject, new Dictionary<string, string>
            {
                { "TargetOS", operatingSystem },
                { "TargetArchitecture", architecture },
                { "Configuration", configuration },
                { "TestBuildMode", "nativeaot" },
                { "IlcDynamicBuildPropertyDependencies", "_ComputeResolvedCopyLocalPublishAssets" }
            },
            projectCollection.DefaultToolsVersion));
        var submission = buildManager.BuildRequest(new BuildRequestData(projectInstance, new[] { "Build", "GetCopyToPublishDirectoryItems", "_ComputeAssembliesToCompileToNative", "WriteIlcRspFileForCompilation" }));

        if (submission.OverallResult != BuildResultCode.Success)
        {
            return null;
        }

        return submission.ResultsByTarget["WriteIlcRspFileForCompilation"].Items[0].ItemSpec;
    }

    public void Dispose()
    {
        OnDispose?.Invoke();
    }
}
