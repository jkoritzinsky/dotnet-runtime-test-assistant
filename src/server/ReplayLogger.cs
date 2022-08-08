using Microsoft.Build.Framework;
using Microsoft.Build.Logging;

namespace AssistantServer;

internal class ReplayLogger : ILogger
{
    private readonly List<BuildEventArgs> _events = new();

    public LoggerVerbosity Verbosity { get; set; }
    public string Parameters { get; set; } = string.Empty;

    public void Initialize(IEventSource eventSource)
    {
        if (eventSource is IEventSource3 ev3)
        {
            ev3.IncludeEvaluationMetaprojects();
            ev3.IncludeTaskInputs();
        }
        if (eventSource is IEventSource4 ev4)
        {
            ev4.IncludeEvaluationPropertiesAndItems();
        }
        eventSource.AnyEventRaised += (o, e) => _events.Add(e);
    }

    public void ReplayEvents(ILogger logger)
    {
        EventArgsDispatcher dispatcher = new();
        logger.Initialize(dispatcher);
        try
        {
            foreach (var evt in _events)
            {
                dispatcher.Dispatch(evt);
            }
        }
        finally
        {
            logger.Shutdown();
        }
    }

    public void Shutdown()
    {
    }
}