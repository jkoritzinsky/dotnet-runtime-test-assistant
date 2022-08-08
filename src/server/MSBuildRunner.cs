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
    // All evaluation submission IDs are the invalid submission ID of -1.
    private const int EvaluationSubmissionId = -1;
    private static readonly string BinLogPathRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Temp", "dnrt-assistant");
    private readonly ProjectCollection projectCollection;
    private readonly BuildManager buildManager;
    private readonly MuxLogger evaluationMuxLogger;
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
        projectCollection.RegisterLogger(evaluationMuxLogger = new());
        buildManager = new BuildManager("AssistantServer");
    }

    private BinaryLogger GetBinlogForRequest([CallerMemberName] string requestName = "")
    {
        string binlogPath = Path.Combine(BinLogPathRoot, $"{requestName}-{Guid.NewGuid()}.binlog");
        BinaryLogger log = new() { Parameters = $"{binlogPath}" };
        log.CollectProjectImports = BinaryLogger.ProjectImportsCollectionMode.Embed;
        logger.BinlogPathForRequest(binlogPath, requestName);
        return log;
    }

    private static void MergeBinLogs(BinaryLogger sink, params BinaryLogger[] sources)
    {
        BinaryLogReplayEventSource replaySource = new();
        sink.Initialize(replaySource);
        foreach (var source in sources)
        {
            replaySource.Replay(source.Parameters);
        }
        sink.Shutdown();
    }

    public string[] GetProjectTargetFrameworks(string projectPath)
    {
        logger.GetProjectTargetFrameworks(projectPath);
        BinaryLogger binLog = GetBinlogForRequest();
        evaluationMuxLogger.RegisterLogger(EvaluationSubmissionId, binLog);
        try
        {
            var project = projectCollection.LoadProject(projectPath);
            var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
            return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks.Split(';') : new string[] { project.GetPropertyValue("TargetFramework") };
        }
        finally
        {
            evaluationMuxLogger.UnregisterLoggers(EvaluationSubmissionId);
            binLog.Shutdown();
        }
    }

    public Dictionary<string, string> GetProjectProperties(string projectPath, string[] properties)
    {
        logger.GetProjectProperties(projectPath, properties);
        BinaryLogger binLog = GetBinlogForRequest();
        evaluationMuxLogger.RegisterLogger(EvaluationSubmissionId, binLog);
        try
        {
            var project = projectCollection.LoadProject(projectPath);
            Dictionary<string, string> results = new();
            foreach (var property in properties)
            {
                results[property] = project.GetPropertyValue(property);
            }
            return results;
        }
        finally
        {
            evaluationMuxLogger.UnregisterLoggers(EvaluationSubmissionId);
            binLog.Shutdown();
        }
    }

    public bool TryCreateVsCodeRunSettings(string preTestProject, string operatingSystem, string architecture, string configuration)
    {
        MuxLogger buildMuxLogger = new();
        buildManager.BeginBuild(new BuildParameters(projectCollection)
        {
            LogTaskInputs = true,
            LogInitialPropertiesAndItems = true,
            Loggers = new[] { buildMuxLogger }
        });

        BinaryLogger finalBinLog = GetBinlogForRequest($"{nameof(TryCreateVsCodeRunSettings)}");
        BinaryLogger evalBinLog = GetBinlogForRequest($"{nameof(TryCreateVsCodeRunSettings)}-evaltemp");
        BinaryLogger execBinLog = GetBinlogForRequest($"{nameof(TryCreateVsCodeRunSettings)}-exectemp");
        evaluationMuxLogger.RegisterLogger(EvaluationSubmissionId, evalBinLog);
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
            buildMuxLogger.RegisterLogger(submission.SubmissionId, execBinLog);
            var result = submission.Execute();

            return result.OverallResult == BuildResultCode.Success;
        }
        finally
        {
            evaluationMuxLogger.UnregisterLoggers(EvaluationSubmissionId);
            buildManager.EndBuild();
            MergeBinLogs(finalBinLog, evalBinLog, execBinLog);
        }
    }

    public string? GenerateIlcResponseFile(string testProject, string operatingSystem, string architecture, string configuration)
    {
        MuxLogger buildMuxLogger = new();
        buildManager.BeginBuild(new BuildParameters(projectCollection)
        {
            LogTaskInputs = true,
            LogInitialPropertiesAndItems = true,
            Loggers = new[] { buildMuxLogger }
        });
        BinaryLogger finalBinLog = GetBinlogForRequest($"{nameof(GenerateIlcResponseFile)}");
        BinaryLogger evalBinLog = GetBinlogForRequest($"{nameof(GenerateIlcResponseFile)}-evaltemp");
        BinaryLogger execBinLog = GetBinlogForRequest($"{nameof(GenerateIlcResponseFile)}-exectemp");
        evaluationMuxLogger.RegisterLogger(EvaluationSubmissionId, evalBinLog);
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
            buildMuxLogger.RegisterLogger(submission.SubmissionId, execBinLog);
            var result = submission.Execute();

            if (result.OverallResult != BuildResultCode.Success)
            {
                return null;
            }

            return result.ResultsByTarget["WriteIlcRspFileForCompilation"].Items[0].ItemSpec;
        }
        finally
        {
            evaluationMuxLogger.UnregisterLoggers(EvaluationSubmissionId);
            buildManager.EndBuild();
            MergeBinLogs(finalBinLog, evalBinLog, execBinLog);
        }
    }

    public void Dispose()
    {
    }
}
