using Microsoft.Build.Construction;
using Microsoft.Build.Evaluation;
using Microsoft.Build.Locator;
using Microsoft.Extensions.Logging;

namespace AssistantServer;

internal sealed partial class MSBuildRunner
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
        Log.GetProjectTargetFrameworks(logger, projectPath);
        var project = new Project(ProjectRootElement.Open(projectPath));
        var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
        return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks : project.GetPropertyValue("TargetFramework");
    }
}
