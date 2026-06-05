import { useState, useEffect } from 'react';
import { getSessions, getSessionDetail } from '../utils/api';
import { Session, SessionDetail, AgentTrace, AgentStep } from '../types';

interface Props {
  onBack: () => void;
}

function formatDuration(startMs: number, endMs: number | null): string {
  if (!endMs) return 'Running...';
  const ms = endMs - startMs;
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 1000).toFixed(3)}m`;
  return `$${usd.toFixed(4)}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: '#10b981',
    failed: '#ef4444',
    running: '#f59e0b',
    max_steps_reached: '#f97316',
  };
  return (
    <span className="status-badge" style={{ backgroundColor: colors[status] ?? '#6b7280' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function StepRow({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="step-row">
      <div className="step-summary" onClick={() => setOpen((v) => !v)}>
        <span className="step-index">#{step.step_index}</span>
        <span className="step-type">{step.type}</span>
        {step.tool_name && <span className="step-tool">{step.tool_name}</span>}
        <span className="step-tokens">{step.prompt_tokens + step.completion_tokens} tokens</span>
        <span className="step-time">{new Date(step.timestamp).toLocaleTimeString()}</span>
        <span className="step-toggle">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="step-detail">
          {step.input && (
            <div className="detail-block">
              <div className="detail-label">Input</div>
              <pre>{step.input}</pre>
            </div>
          )}
          {step.tool_args && (
            <div className="detail-block">
              <div className="detail-label">Tool Args</div>
              <pre>{step.tool_args}</pre>
            </div>
          )}
          {step.tool_result && (
            <div className="detail-block">
              <div className="detail-label">Tool Result</div>
              <pre>{step.tool_result}</pre>
            </div>
          )}
          {step.output && (
            <div className="detail-block">
              <div className="detail-label">Output</div>
              <pre>{step.output.slice(0, 1000)}{step.output.length > 1000 ? '...' : ''}</pre>
            </div>
          )}
          <div className="detail-tokens">
            Prompt: {step.prompt_tokens} | Completion: {step.completion_tokens}
          </div>
        </div>
      )}
    </div>
  );
}

function TraceCard({ trace, steps }: { trace: AgentTrace; steps: AgentStep[] }) {
  const [open, setOpen] = useState(false);
  const traceSteps = steps.filter((s) => s.trace_id === trace.id);

  return (
    <div className="trace-card">
      <div className="trace-header" onClick={() => setOpen((v) => !v)}>
        <div className="trace-title">
          <strong>{trace.agent_name}</strong>
          <StatusBadge status={trace.status} />
        </div>
        <div className="trace-meta">
          <span>{formatDuration(trace.started_at, trace.finished_at)}</span>
          <span>{formatCost(trace.cost_usd)}</span>
          <span>{trace.steps_executed} steps</span>
          <span>{trace.prompt_tokens + trace.completion_tokens} tokens</span>
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="trace-steps">
          {trace.error && <div className="trace-error">Error: {trace.error}</div>}
          {traceSteps.length === 0 && <div className="no-steps">No steps recorded</div>}
          {traceSteps.map((step) => <StepRow key={step.id} step={step} />)}
        </div>
      )}
    </div>
  );
}

export default function ObservabilityPage({ onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    getSessions()
      .then((data) => setSessions(data as Session[]))
      .catch(() => setSessions([]))
      .finally(() => setLoadingList(false));
  }, []);

  async function openSession(id: string) {
    setLoadingDetail(true);
    try {
      const detail = await getSessionDetail(id) as SessionDetail;
      setSelected(detail);
    } catch {}
    setLoadingDetail(false);
  }

  return (
    <div className="obs-page">
      <header className="app-header">
        <div className="header-left">
          <button className="btn-link" onClick={() => { setSelected(null); onBack(); }}>
            ← Back to Research
          </button>
          <h2>Observability Dashboard</h2>
        </div>
      </header>

      <div className="obs-layout">
        <div className="obs-sidebar">
          <div className="sidebar-title">Research Sessions</div>
          {loadingList && <div className="loading">Loading...</div>}
          {!loadingList && sessions.length === 0 && (
            <div className="no-sessions">No sessions yet. Run a research topic first.</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${selected?.session.id === s.id ? 'active' : ''}`}
              onClick={() => openSession(s.id)}
            >
              <div className="session-topic">{s.topic}</div>
              <div className="session-meta-row">
                <StatusBadge status={s.status} />
                <span>{formatDuration(s.started_at, s.finished_at)}</span>
                <span>{formatCost(s.total_cost_usd)}</span>
              </div>
              <div className="session-date">
                {new Date(s.started_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="obs-main">
          {loadingDetail && <div className="loading">Loading session...</div>}

          {!loadingDetail && !selected && (
            <div className="obs-empty">Select a session from the left to view its details.</div>
          )}

          {!loadingDetail && selected && (
            <>
              <div className="session-stats">
                <div className="stat-card">
                  <div className="stat-label">Status</div>
                  <StatusBadge status={selected.session.status} />
                </div>
                <div className="stat-card">
                  <div className="stat-label">Duration</div>
                  <div className="stat-value">
                    {formatDuration(selected.session.started_at, selected.session.finished_at)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Cost</div>
                  <div className="stat-value">{formatCost(selected.session.total_cost_usd)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Steps</div>
                  <div className="stat-value">{selected.session.total_steps}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Prompt Tokens</div>
                  <div className="stat-value">{selected.session.total_prompt_tokens.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Completion Tokens</div>
                  <div className="stat-value">{selected.session.total_completion_tokens.toLocaleString()}</div>
                </div>
              </div>

              <div className="obs-section-title">Agent Traces</div>
              {selected.traces.map((trace) => (
                <TraceCard key={trace.id} trace={trace} steps={selected.steps} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
