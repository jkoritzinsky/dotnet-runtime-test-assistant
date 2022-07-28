using AssistantServer;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;

using IHost host = Host.CreateDefaultBuilder(args)
    .ConfigureLogging(logging =>
    {
        logging.Services.Configure<ConsoleLoggerOptions>(options =>
        {
            // Log everything to stderr as we use stdout/in for communication with the client.
            options.LogToStandardErrorThreshold = LogLevel.Trace;
        });
    })
    .ConfigureServices(services =>
    {
        services.AddHostedService<RpcService>();
    })
    .Build();

await host.RunAsync();