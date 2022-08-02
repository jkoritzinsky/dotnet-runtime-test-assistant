using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StreamJsonRpc;

namespace AssistantServer;

public class RpcService : BackgroundService
{
    private readonly ILogger<RpcService> logger;

    public RpcService(ILogger<RpcService> logger)
    {
        this.logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.Startup(Environment.ProcessId);

        var rpc = JsonRpc.Attach(Console.OpenStandardOutput(), Console.OpenStandardInput(), new MSBuildRunner(logger));

        stoppingToken.Register(() => rpc.Dispose());

        return rpc.Completion;
    }
}