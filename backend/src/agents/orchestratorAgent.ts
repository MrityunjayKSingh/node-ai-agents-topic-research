import { Agent, createTool } from '@mastra/core';
import { z } from 'zod';
import { getDeepInfraModel, DEFAULT_MODEL } from './mastraClient';
import { researchAgent } from './researchAgent';
import { analysisAgent } from './analysisAgent';
import { writingAgent } from './writingAgent';
import { createAgentTrace, recordAgentStep, finishAgentTrace } from '../tracing/tracer';

const delegateResearchTool = createTool({
  id: 'delegate-research',
  description: 'Delegate web research sub-tasks to the Research Agent',
  inputSchema: z.object({
    subTasks: z.array(z.string()).describe('List of research sub-tasks / search queries'),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    findings: z.string(),
  }),
  execute: async ({ context }) => {
    const traceId = await createAgentTrace(context.sessionId, 'ResearchAgent');
    const prompt = `Research the following sub-tasks and return your findings:\n${context.subTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

    await recordAgentStep({
      traceId,
      sessionId: context.sessionId,
      stepIndex: 0,
      agentName: 'ResearchAgent',
      type: 'input',
      input: prompt,
      promptTokens: 0,
      completionTokens: 0,
      modelId: DEFAULT_MODEL,
    });

    const result = await researchAgent.generate([{ role: 'user', content: prompt }]);

    await recordAgentStep({
      traceId,
      sessionId: context.sessionId,
      stepIndex: 1,
      agentName: 'ResearchAgent',
      type: 'output',
      output: result.text,
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      modelId: DEFAULT_MODEL,
    });

    await finishAgentTrace(traceId, 'completed');
    return { findings: result.text };
  },
});

const delegateAnalysisTool = createTool({
  id: 'delegate-analysis',
  description: 'Send raw research findings to the Analysis Agent for critical evaluation',
  inputSchema: z.object({
    findings: z.string(),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
  }),
  execute: async ({ context }) => {
    const traceId = await createAgentTrace(context.sessionId, 'AnalysisAgent');
    const prompt = `Analyse the following research findings:\n\n${context.findings}`;

    await recordAgentStep({
      traceId,
      sessionId: context.sessionId,
      stepIndex: 0,
      agentName: 'AnalysisAgent',
      type: 'input',
      input: prompt,
      promptTokens: 0,
      completionTokens: 0,
      modelId: DEFAULT_MODEL,
    });

    const result = await analysisAgent.generate([{ role: 'user', content: prompt }]);

    await recordAgentStep({
      traceId,
      sessionId: context.sessionId,
      stepIndex: 1,
      agentName: 'AnalysisAgent',
      type: 'output',
      output: result.text,
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      modelId: DEFAULT_MODEL,
    });

    await finishAgentTrace(traceId, 'completed');
    return { analysis: result.text };
  },
});

const delegateWritingTool = createTool({
  id: 'delegate-writing',
  description: 'Send analysed findings to the Writing Agent to produce the final report',
  inputSchema: z.object({
    topic: z.string(),
    analysis: z.string(),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    report: z.string(),
  }),
  execute: async ({ context }) => {
    const traceId = await createAgentTrace(context.sessionId, 'WritingAgent');
    const prompt = `Write a comprehensive research report on the topic: "${context.topic}"\n\nBased on this analysis:\n\n${context.analysis}`;

    await recordAgentStep({
      traceId,
      sessionId: context.sessionId,
      stepIndex: 0,
      agentName: 'WritingAgent',
      type: 'input',
      input: prompt,
      promptTokens: 0,
      completionTokens: 0,
      modelId: DEFAULT_MODEL,
    });

    const result = await writingAgent.generate([{ role: 'user', content: prompt }]);

    await recordAgentStep({
      traceId,
      sessionId: context.sessionId,
      stepIndex: 1,
      agentName: 'WritingAgent',
      type: 'output',
      output: result.text,
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      modelId: DEFAULT_MODEL,
    });

    await finishAgentTrace(traceId, 'completed');
    return { report: result.text };
  },
});

export const orchestratorAgent = new Agent({
  name: 'OrchestratorAgent',
  instructions: `You are the Orchestrator Agent for a multi-agent deep research system.

Your job:
1. Receive a research topic from the user.
2. Break it into 3-5 focused research sub-tasks (distinct angles, sub-questions, or aspects).
3. Use the delegate-research tool to send those sub-tasks to the Research Agent. Pass the sessionId.
4. Pass the findings to the delegate-analysis tool. Pass the sessionId.
5. Pass the analysis to the delegate-writing tool along with the topic. Pass the sessionId.
6. Return the final report text directly as your response.

The sessionId is embedded in the user message — extract it and pass it unchanged to every tool call.`,
  model: getDeepInfraModel(DEFAULT_MODEL),
  tools: {
    delegateResearch: delegateResearchTool,
    delegateAnalysis: delegateAnalysisTool,
    delegateWriting: delegateWritingTool,
  },
});
