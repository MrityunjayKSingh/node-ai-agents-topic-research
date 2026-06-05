export interface User {
  username: string;
  token: string;
}

export interface AgentEvent {
  type: 'session_started' | 'agent_start' | 'agent_done' | 'report_ready' | 'error';
  agent?: string;
  message?: string;
  sessionId?: string;
  topic?: string;
  report?: string;
}

export interface Session {
  id: string;
  topic: string;
  status: 'running' | 'completed' | 'max_steps_reached' | 'failed';
  started_at: number;
  finished_at: number | null;
  total_cost_usd: number;
  total_steps: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
}

export interface AgentTrace {
  id: string;
  session_id: string;
  agent_name: string;
  started_at: number;
  finished_at: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  steps_executed: number;
  status: string;
  error: string | null;
}

export interface AgentStep {
  id: string;
  trace_id: string;
  session_id: string;
  step_index: number;
  agent_name: string;
  type: string;
  input: string | null;
  output: string | null;
  tool_name: string | null;
  tool_args: string | null;
  tool_result: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  timestamp: number;
}

export interface SessionDetail {
  session: Session & { final_report: string | null };
  traces: AgentTrace[];
  steps: AgentStep[];
}
