# Topic Research System

A multi-agent deep research system built with the Mastra TypeScript SDK, React, and Node.js.

## Setup

### Prerequisites
- Node.js 20+
- A [DeepInfra](https://deepinfra.com) account and API key

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your DEEPINFRA_API_KEY and a strong JWT_SECRET
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3001`.

---

## Architecture

### Agent Roles

| Agent | Role |
|---|---|
| **OrchestratorAgent** | Receives the user's topic, decomposes it into 3–5 focused sub-tasks, delegates to other agents via Mastra tool calls, and synthesises the final output |
| **ResearchAgent** | Performs multiple targeted web searches via DuckDuckGo and returns raw source material with URLs |
| **AnalysisAgent** | Evaluates source quality, extracts key insights, resolves contradictions, and groups findings into themes |
| **WritingAgent** | Drafts the final structured Markdown report from the analysis output |

### How Mastra is Used

- Each agent is created with `new Agent(...)` from `@mastra/core/agent`.
- The Orchestrator delegates to sub-agents via `createTool` — each delegation tool calls `agent.generate()` and captures token usage and outputs.
- The LLM provider is DeepInfra's OpenAI-compatible API, connected via `createOpenAI` from `@mastra/core/llm`.
- `max_steps: 50` is set on every agent to bound autonomous execution.
- Agent activity is streamed to the frontend via Server-Sent Events using the `onStepFinish` callback.

### Custom Observability

All telemetry is captured in a SQLite database (`backend/data/research.db`):
- `sessions` — one row per research run with total tokens, cost, and duration
- `agent_traces` — one row per agent invocation with per-agent token counts and cost
- `agent_steps` — one row per step with tool call arguments/results, token counts, and timestamps

Cost is computed as: `(promptTokens / 1e6 × inputPrice) + (completionTokens / 1e6 × outputPrice)` for each model.

The observability dashboard is built from scratch in React and accessible from within the main application.
