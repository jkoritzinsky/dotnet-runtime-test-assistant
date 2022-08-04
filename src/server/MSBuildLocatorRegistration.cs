using Microsoft.Build.Locator;

namespace AssistantServer;

internal static class MSBuildLocatorRegistration
{
    static MSBuildLocatorRegistration()
    {
        MSBuildLocator.RegisterInstance(MSBuildLocator.QueryVisualStudioInstances(new VisualStudioInstanceQueryOptions { DiscoveryTypes = DiscoveryType.DotNetSdk }).First());
    }

    public static void Register() { }
}