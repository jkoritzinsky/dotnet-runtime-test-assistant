using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StreamJsonRpc;

namespace AssistantServer;

public class RpcService : BackgroundService
{
    private readonly ILogger<RpcService> logger;
    private readonly IHostApplicationLifetime lifetime;

    public RpcService(ILogger<RpcService> logger, IHostApplicationLifetime lifetime)
    {
        this.logger = logger;
        this.lifetime = lifetime;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.Startup(Environment.ProcessId);

        MSBuildLocatorRegistration.Register();
        var rpc = new JsonRpc(Console.OpenStandardOutput(), Console.OpenStandardInput());

        rpc.AddLocalRpcTarget(new MSBuildRunner(logger), new JsonRpcTargetOptions { DisposeOnDisconnect = true });

        rpc.StartListening();

        stoppingToken.Register(() => rpc.Dispose());

        _ = rpc.Completion.ContinueWith(_ => lifetime.StopApplication(), TaskScheduler.Default);

        return rpc.Completion;
    }
}