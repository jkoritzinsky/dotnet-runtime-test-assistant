using Microsoft.Build.Framework;
using Microsoft.Build.Logging;

namespace AssistantServer;

internal class EvaluationLogger : ILogger
{
    private readonly Dictionary<int, List<BuildEventArgs>> _eventsByEvaluationId = new();

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

        eventSource.AnyEventRaised += AnyEventRaised;
    }

    public void ReplayEventsForEvaluationId(int evaluationId, ILogger targetLogger)
    {
        EventArgsDispatcher dispatcher = new();
        targetLogger.Initialize(dispatcher);

        try
        {
            lock (_eventsByEvaluationId)
            {
                if (_eventsByEvaluationId.TryGetValue(evaluationId, out var events))
                {
                    foreach (var evt in events)
                    {
                        dispatcher.Dispatch(evt);
                    }
                }
            }
        }
        finally
        {
            targetLogger.Shutdown();
        }
    }

    private void AnyEventRaised(object sender, BuildEventArgs e)
    {
        if (e.BuildEventContext.EvaluationId == BuildEventContext.InvalidEvaluationId)
        {
            return;
        }
        lock (_eventsByEvaluationId)
        {
            if (!_eventsByEvaluationId.TryGetValue(e.BuildEventContext.EvaluationId, out var events))
            {
                _eventsByEvaluationId.Add(e.BuildEventContext.EvaluationId, events = new());
            }
            events.Add(e);
        }
    }

    public void Shutdown()
    {
        _eventsByEvaluationId.Clear();
    }
}