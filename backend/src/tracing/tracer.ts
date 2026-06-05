import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? 'deepseek-ai/DeepSeek-V3';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-ai/DeepSeek-V3': { input: 0.26, output: 0.38 },
  'Qwen/Qwen3-30B-A3B': { input: 0.07, output: 0.15 },
  'Qwen/Qwen3-235B-A22B': { input: 0.13, output: 0.60 },
  'THUDM/GLM-4-32B-0414': { input: 0.10, output: 0.20 },
  default: { input: 0.26, output: 0.38 },
};

export function calculateCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[modelId] ?? MODEL_PRICING['default'];
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
}

export async function createSession(userId: string, topic: string): Promise<string> {
  const id = uuidv4();
  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, topic, status, started_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, userId, topic, 'running', Date.now()],
  });
  return id;
}

export async function createAgentTrace(sessionId: string, agentName: string): Promise<string> {
  const id = uuidv4();
  await db.execute({
    sql: 'INSERT INTO agent_traces (id, session_id, agent_name, started_at, status) VALUES (?, ?, ?, ?, ?)',
    args: [id, sessionId, agentName, Date.now(), 'running'],
  });
  return id;
}

export async function recordAgentStep(params: {
  traceId: string;
  sessionId: string;
  stepIndex: number;
  agentName: string;
  type: string;
  input?: string;
  output?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  promptTokens: number;
  completionTokens: number;
  modelId: string;
}): Promise<void> {
  const id = uuidv4();
  const cost = calculateCost(params.modelId, params.promptTokens, params.completionTokens);

  await db.execute({
    sql: `INSERT INTO agent_steps
      (id, trace_id, session_id, step_index, agent_name, type,
       input, output, tool_name, tool_args, tool_result,
       prompt_tokens, completion_tokens, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, params.traceId, params.sessionId, params.stepIndex,
      params.agentName, params.type,
      params.input ?? null, params.output ?? null,
      params.toolName ?? null, params.toolArgs ?? null, params.toolResult ?? null,
      params.promptTokens, params.completionTokens, Date.now(),
    ],
  });

  await db.execute({
    sql: `UPDATE agent_traces
          SET prompt_tokens = prompt_tokens + ?,
              completion_tokens = completion_tokens + ?,
              cost_usd = cost_usd + ?,
              steps_executed = steps_executed + 1
          WHERE id = ?`,
    args: [params.promptTokens, params.completionTokens, cost, params.traceId],
  });

  await db.execute({
    sql: `UPDATE sessions
          SET total_prompt_tokens = total_prompt_tokens + ?,
              total_completion_tokens = total_completion_tokens + ?,
              total_cost_usd = total_cost_usd + ?,
              total_steps = total_steps + 1
          WHERE id = ?`,
    args: [params.promptTokens, params.completionTokens, cost, params.sessionId],
  });
}

export async function finishAgentTrace(
  traceId: string,
  status: 'completed' | 'max_steps_reached' | 'failed',
  error?: string
): Promise<void> {
  await db.execute({
    sql: 'UPDATE agent_traces SET finished_at = ?, status = ?, error = ? WHERE id = ?',
    args: [Date.now(), status, error ?? null, traceId],
  });
}

export async function finishSession(
  sessionId: string,
  status: 'completed' | 'max_steps_reached' | 'failed',
  report?: string
): Promise<void> {
  await db.execute({
    sql: 'UPDATE sessions SET finished_at = ?, status = ?, final_report = ? WHERE id = ?',
    args: [Date.now(), status, report ?? null, sessionId],
  });
}
