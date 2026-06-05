import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createSession, finishSession, createAgentTrace, recordAgentStep, finishAgentTrace, DEFAULT_MODEL } from '../tracing/tracer';
import { orchestratorAgent } from '../agents/orchestratorAgent';
import { db } from '../db/database';

const router = Router();

// POST /api/research/start — starts the pipeline and streams SSE events
router.post('/start', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { topic } = req.body as { topic?: string };

  if (!topic || topic.trim().length === 0) {
    res.status(400).json({ error: 'Topic is required' });
    return;
  }

  const sessionId = await createSession(req.userId!, topic.trim());

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('session_started', { sessionId, topic: topic.trim() });

  try {
    const traceId = await createAgentTrace(sessionId, 'OrchestratorAgent');

    send('agent_start', { agent: 'OrchestratorAgent', message: 'Breaking topic into research sub-tasks...' });

    await recordAgentStep({
      traceId,
      sessionId,
      stepIndex: 0,
      agentName: 'OrchestratorAgent',
      type: 'input',
      input: topic.trim(),
      promptTokens: 0,
      completionTokens: 0,
      modelId: DEFAULT_MODEL,
    });

    let stepIndex = 1;

    const onStepFinish = async (stepResult: {
      stepType: string;
      toolCalls?: Array<{ toolName: string; args: unknown }>;
      toolResults?: Array<{ result: unknown }>;
      text?: string;
      usage?: { promptTokens: number; completionTokens: number };
    }) => {
      if (stepResult.toolCalls) {
        for (const tc of stepResult.toolCalls) {
          if (tc.toolName === 'delegateResearch') {
            send('agent_start', { agent: 'ResearchAgent', message: 'Searching the web for information...' });
          } else if (tc.toolName === 'delegateAnalysis') {
            send('agent_start', { agent: 'AnalysisAgent', message: 'Evaluating sources and extracting key findings...' });
          } else if (tc.toolName === 'delegateWriting') {
            send('agent_start', { agent: 'WritingAgent', message: 'Drafting the final research report...' });
          }
        }
      }

      if (stepResult.usage) {
        await recordAgentStep({
          traceId,
          sessionId,
          stepIndex: stepIndex++,
          agentName: 'OrchestratorAgent',
          type: stepResult.stepType,
          output: stepResult.text,
          toolName: stepResult.toolCalls?.[0]?.toolName,
          toolArgs: stepResult.toolCalls ? JSON.stringify(stepResult.toolCalls[0]?.args) : undefined,
          toolResult: stepResult.toolResults ? JSON.stringify(stepResult.toolResults[0]?.result) : undefined,
          promptTokens: stepResult.usage.promptTokens,
          completionTokens: stepResult.usage.completionTokens,
          modelId: DEFAULT_MODEL,
        });
      }
    };

    const result = await orchestratorAgent.generate(
      [{ role: 'user', content: `Research topic: "${topic.trim()}"\nSession ID: ${sessionId}` }],
      { onStepFinish }
    );

    await finishAgentTrace(traceId, 'completed');
    await finishSession(sessionId, 'completed', result.text);

    send('agent_done', { agent: 'OrchestratorAgent', message: 'Pipeline complete.' });
    send('report_ready', { sessionId, report: result.text });
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Unknown error';
    // Improve misleading auth errors that are actually LLM API errors
    if (message.toLowerCase().includes('not authenticated') || message.includes('401')) {
      message = 'LLM API error: Invalid API key. Check DEEPINFRA_API_KEY in your .env file.';
    } else if (message.toLowerCase().includes('balance') || message.includes('402')) {
      message = 'LLM API error: Insufficient balance on DeepInfra. Please top up at https://deepinfra.com';
    } else if (message.toLowerCase().includes('model') && message.toLowerCase().includes('not found')) {
      message = `LLM API error: Model "${process.env.DEFAULT_MODEL}" not found. Check DEFAULT_MODEL in .env.`;
    }
    console.error('[Research error]', err);
    await finishSession(sessionId, 'failed');
    send('error', { message });
  } finally {
    res.end();
  }
});

// GET /api/research/sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await db.execute({
    sql: `SELECT id, topic, status, started_at, finished_at,
               total_cost_usd, total_steps, total_prompt_tokens, total_completion_tokens
          FROM sessions WHERE user_id = ? ORDER BY started_at DESC`,
    args: [req.userId!],
  });
  res.json(result.rows);
});

// GET /api/research/sessions/:id
router.get('/sessions/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionResult = await db.execute({
    sql: 'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId!],
  });

  if (sessionResult.rows.length === 0) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const tracesResult = await db.execute({
    sql: 'SELECT * FROM agent_traces WHERE session_id = ? ORDER BY started_at ASC',
    args: [req.params.id],
  });

  const stepsResult = await db.execute({
    sql: 'SELECT * FROM agent_steps WHERE session_id = ? ORDER BY timestamp ASC',
    args: [req.params.id],
  });

  res.json({
    session: sessionResult.rows[0],
    traces: tracesResult.rows,
    steps: stepsResult.rows,
  });
});

export default router;
