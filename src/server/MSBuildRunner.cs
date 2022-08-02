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

    public string[] GetProjectTargetFrameworks(string projectPath)
    {
        logger.GetProjectTargetFrameworks(projectPath);
        var project = new Project(ProjectRootElement.Open(projectPath));
        var targetFrameworks = project.GetPropertyValue("TargetFrameworks");
        return !string.IsNullOrEmpty(targetFrameworks) ? targetFrameworks.Split(';') : new string[] { project.GetPropertyValue("TargetFramework") };
    }

    public Dictionary<string, string> GetProjectProperties(string projectPath, string[] properties)
    {
        logger.GetProjectProperties(projectPath, properties);
        var project = new Project(ProjectRootElement.Open(projectPath));
        Dictionary<string, string> results = new();
        foreach (var property in properties)
        {
            results[property] = project.GetPropertyValue(property);
        }
        return results;
    }
}
