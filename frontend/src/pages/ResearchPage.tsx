import { useState, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { startResearch } from '../utils/api';
import { AgentEvent } from '../types';

interface FeedItem {
  id: number;
  agent: string;
  message: string;
  timestamp: Date;
}

const AGENT_COLORS: Record<string, string> = {
  OrchestratorAgent: '#7c3aed',
  ResearchAgent: '#0ea5e9',
  AnalysisAgent: '#f59e0b',
  WritingAgent: '#10b981',
};

const AGENT_ICONS: Record<string, string> = {
  OrchestratorAgent: '🧭',
  ResearchAgent: '🔍',
  AnalysisAgent: '🧪',
  WritingAgent: '✍️',
};

interface Props {
  username: string;
  onViewObservability: () => void;
}

export default function ResearchPage({ username, onViewObservability }: Props) {
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedCounter = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  function appendFeed(agent: string, message: string) {
    setFeed((prev) => [
      ...prev,
      { id: feedCounter.current++, agent, message, timestamp: new Date() },
    ]);
    setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function handleStart(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || running) return;

    setRunning(true);
    setFeed([]);
    setReport(null);
    setError(null);
    setSessionId(null);

    const cancel = startResearch(topic.trim(), (eventType, data) => {
      const d = data as AgentEvent & Record<string, unknown>;

      if (eventType === 'session_started') {
        setSessionId(d.sessionId ?? null);
        appendFeed('OrchestratorAgent', `Research started for: "${d.topic}"`);
      } else if (eventType === 'agent_start') {
        appendFeed(d.agent ?? 'Agent', d.message ?? '');
      } else if (eventType === 'agent_done') {
        appendFeed(d.agent ?? 'Agent', d.message ?? 'Done.');
      } else if (eventType === 'report_ready') {
        setReport(d.report ?? '');
        setRunning(false);
      } else if (eventType === 'error') {
        setError((d as { message?: string }).message ?? 'Unknown error');
        setRunning(false);
      }
    });

    cancelRef.current = cancel;
  }

  function handleStop() {
    cancelRef.current?.();
    setRunning(false);
    appendFeed('System', 'Research cancelled by user.');
  }

  return (
    <div className="research-page">
      <header className="app-header">
        <div className="header-left">
          <h2>Topic Research</h2>
          <span className="user-badge">{username}</span>
        </div>
        <button className="btn-secondary" onClick={onViewObservability}>
          Observability Dashboard
        </button>
      </header>

      <div className="research-layout">
        <div className="left-panel">
          <form onSubmit={handleStart} className="topic-form">
            <div className="topic-input-row">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a research topic..."
                disabled={running}
                className="topic-input"
              />
              {running ? (
                <button type="button" onClick={handleStop} className="btn-stop">
                  Stop
                </button>
              ) : (
                <button type="submit" className="btn-primary" disabled={!topic.trim()}>
                  Research
                </button>
              )}
            </div>
          </form>

          <div className="agent-feed">
            <div className="feed-title">
              Agent Activity Feed
              {running && <span className="pulse-dot" />}
            </div>

            {feed.length === 0 && !running && (
              <div className="feed-empty">
                Enter a topic above and press Research to begin.
              </div>
            )}

            {feed.map((item) => (
              <div key={item.id} className="feed-item">
                <div
                  className="feed-agent-badge"
                  style={{ backgroundColor: AGENT_COLORS[item.agent] ?? '#6b7280' }}
                >
                  {AGENT_ICONS[item.agent] ?? '🤖'} {item.agent}
                </div>
                <div className="feed-message">{item.message}</div>
                <div className="feed-time">
                  {item.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}

            {error && (
              <div className="feed-error">Error: {error}</div>
            )}

            <div ref={feedEndRef} />
          </div>
        </div>

        <div className="right-panel">
          {report ? (
            <div className="report-container">
              <div className="report-header">
                <span>Research Report</span>
                {sessionId && (
                  <button
                    className="btn-link"
                    onClick={onViewObservability}
                  >
                    View in Observability →
                  </button>
                )}
              </div>
              <div className="report-body">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="report-placeholder">
              {running
                ? 'Report will appear here when the pipeline completes...'
                : 'Your research report will appear here.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
