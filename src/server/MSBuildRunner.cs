using System.Runtime.CompilerServices;
using Microsoft.Build.Evaluation;
using Microsoft.Build.Execution;
using Microsoft.Build.Locator;
using Microsoft.Build.Logging;
using Microsoft.Build.Utilities;
using Microsoft.Extensions.Logging;
using MSBuildLoggerVerbosity = Microsoft.Build.Framework.LoggerVerbosity;

namespace AssistantServer;

internal sealed partial class MSBuildRunner : IDisposable
{
    private static readonly string BinLogPathRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Temp", "dnrt-assistant");
    private readonly ProjectCollection projectCollection;
    private readonly BuildManager buildManager;
    private readonly EvaluationLogger evaluationLogger;
    private readonly ILogger logger;

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
        projectCollection.RegisterLogger(evaluationLogger = new());
        buildManager = new BuildManager("AssistantServer");
    }

    private BinaryLogger GetBinlogForRequest([CallerMemberName] string requestName = "")
    {
        string binlogPath = Path.Combine(BinLogPathRoot, $"{requestName}-{Guid.NewGuid()}.binlog");
        BinaryLogger log = new()
        {
            Parameters = $"{binlogPath}",
            CollectProjectImports = BinaryLogger.ProjectImportsCollectionMode.Embed
        };
        logger.BinlogPathForRequest(binlogPath, requestName);
        return log;
    }

    public string[] GetProjectTargetFrameworks(string projectPath)
    {
        logger.GetProjectTargetFrameworks(projectPath);
        var project = projectCollection.LoadProject(projectPath);
        evaluationLogger.ReplayEventsForEvaluationId(project.LastEvaluationId, GetBinlogForRequest());

        var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
        return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks.Split(';') : new string[] { project.GetPropertyValue("TargetFramework") };
    }

    public Dictionary<string, string> GetProjectProperties(string projectPath, string[] properties)
    {
        logger.GetProjectProperties(projectPath, properties);
        var project = projectCollection.LoadProject(projectPath);
        evaluationLogger.ReplayEventsForEvaluationId(project.LastEvaluationId, GetBinlogForRequest());

        Dictionary<string, string> results = new();
        foreach (var property in properties)
        {
            results[property] = project.GetPropertyValue(property);
        }
        return results;
    }

    public bool TryCreateVsCodeRunSettings(string preTestProject, string operatingSystem, string architecture, string configuration)
    {
        MuxLogger buildMuxLogger = new()
        {
            IncludeEvaluationMetaprojects = true,
            IncludeEvaluationPropertiesAndItems = true,
            IncludeTaskInputs = true,
        };
        buildManager.BeginBuild(new BuildParameters(projectCollection)
        {
            LogTaskInputs = true,
            LogInitialPropertiesAndItems = true,
            Loggers = new[] { buildMuxLogger }
        });

        var replayLogger = new BuildWithEvaluationLogger(evaluationLogger);
        BinaryLogger finalBinLog = GetBinlogForRequest();
        try
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
            var submission = buildManager.PendBuildRequest(new BuildRequestData(projectInstance, new[] { "GenerateRunSettingsFile" }));
            buildMuxLogger.RegisterLogger(submission.SubmissionId, replayLogger);
            var result = submission.Execute();

            return result.OverallResult == BuildResultCode.Success;
        }
        finally
        {
            buildManager.EndBuild();
            replayLogger.ReplayEvents(finalBinLog);
        }
    }

    public string? GenerateIlcResponseFile(string testProject, string operatingSystem, string architecture, string configuration)
    {
        MuxLogger buildMuxLogger = new()
        {
            IncludeEvaluationMetaprojects = true,
            IncludeEvaluationPropertiesAndItems = true,
            IncludeTaskInputs = true,
        };
        buildManager.BeginBuild(new BuildParameters(projectCollection)
        {
            LogTaskInputs = true,
            LogInitialPropertiesAndItems = true,
            Loggers = new[] { buildMuxLogger }
        });
        var replayLogger = new BuildWithEvaluationLogger(evaluationLogger);
        BinaryLogger finalBinLog = GetBinlogForRequest();
        try
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
            var submission = buildManager.PendBuildRequest(new BuildRequestData(projectInstance, new[] { "Build", "GetCopyToPublishDirectoryItems", "_ComputeAssembliesToCompileToNative", "WriteIlcRspFileForCompilation" }));
            buildMuxLogger.RegisterLogger(submission.SubmissionId, replayLogger);
            var result = submission.Execute();

            if (result.OverallResult != BuildResultCode.Success)
            {
                return null;
            }

            return result.ResultsByTarget["WriteIlcRspFileForCompilation"].Items[0].ItemSpec;
        }
        finally
        {
            buildManager.EndBuild();
            replayLogger.ReplayEvents(finalBinLog);
        }
    }

    public readonly record struct BuildSubset(string Name, string Description, bool OnDemand);

    public BuildSubset[] GetBuildSubsets(string rootBuildProjectPath)
    {
        logger.GetBuildSubsets(rootBuildProjectPath);
        var project = projectCollection.LoadProject(rootBuildProjectPath);
        evaluationLogger.ReplayEventsForEvaluationId(project.LastEvaluationId, GetBinlogForRequest());

        List<BuildSubset> subsets = new();

        foreach (var item in project.Items.Where(item => item.ItemType == "SubsetName"))
        {
            subsets.Add(new()
            {
                Name = item.GetMetadataValue("Identity"),
                Description = item.GetMetadataValue(nameof(BuildSubset.Description)),
                OnDemand = item.HasMetadata(nameof(BuildSubset.OnDemand))
                    && bool.TryParse(item.GetMetadataValue(nameof(BuildSubset.OnDemand)), out var onDemand)
                    && onDemand
            });
        }

        return subsets.ToArray();
    }

    public void Dispose()
    {
    }
}
