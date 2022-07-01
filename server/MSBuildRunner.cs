using Microsoft.Build.Evaluation;
using Microsoft.Build.Locator;
using Microsoft.Extensions.Logging;
using StreamJsonRpc;

namespace AssistantServer;

internal sealed class MSBuildRunner
{
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
        var project = new Project(File.ReadAllText(projectPath));
        var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
        return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks : project.GetPropertyValue("TargetFramework");
    }
}
