# AI Agent Topic Research System - Complete Code Flow

## 🏗️ System Overview

This is a **multi-agent AI research system** that breaks down complex research topics into focused sub-tasks, executes them in parallel through specialized agents, and synthesizes a structured report. It's built on:
- **Backend**: Node.js/Express + Mastra SDK (multi-agent framework)
- **Frontend**: React + Vite
- **Database**: SQLite (custom observability tracking)
- **LLM Provider**: DeepInfra (OpenAI-compatible API)

---

## 🔄 Complete Data Flow

### 1. USER AUTHENTICATION

```
User Input → /api/auth/register or /api/auth/login
                    ↓
         Verify credentials (bcrypt hash)
                    ↓
         JWT token issued + stored in localStorage
```

**Auth Routes** (`backend/src/routes/authRoutes.ts`):
- `POST /api/auth/register`: Create new user with username/password validation
  - Username: ≥3 chars, Password: ≥6 chars
  - Passwords hashed with bcryptjs (10 salt rounds)
  - Returns JWT token on success

- `POST /api/auth/login`: Authenticate existing user
  - Compares provided password with stored hash
  - Returns JWT token valid for 24 hours

**Auth Middleware** (`backend/src/middleware/auth.ts`):
- Validates Bearer token on all `/api/research` endpoints
- Extracts userId and username from JWT payload
- Returns 401 if token is missing or invalid

---

### 2. RESEARCH INITIATION

```
User enters topic → ResearchPage.tsx → startResearch() API call
                                           ↓
                    POST /api/research/start (with JWT header)
                                           ↓
                    Authentication middleware validates token
                                           ↓
                    Session created in database (SQLite)
                                           ↓
                    Server-Sent Events (SSE) stream opened
                                           ↓
                    Frontend receives events and updates UI in real-time
```

**Frontend Flow** (`frontend/src/pages/ResearchPage.tsx`):
1. User enters research topic in text input
2. Clicks "Research" button
3. `handleStart()` calls `startResearch(topic)`
4. Establishes SSE connection with `/api/research/start`
5. Listens for events:
   - `session_started`: Display topic and session ID
   - `agent_start`: Show which agent is running
   - `agent_done`: Confirm agent completion
   - `report_ready`: Display final Markdown report
   - `error`: Show error message

**Backend Route** (`backend/src/routes/researchRoutes.ts`):
1. `POST /api/research/start` receives topic
2. Creates new session in database
3. Sets up SSE headers for real-time streaming
4. Triggers orchestrator agent with `onStepFinish` callback
5. Streams progress events to frontend
6. Handles errors with helpful messages (API key, balance, model not found)

---

## 🤖 Multi-Agent Pipeline (Core Logic)

### Phase 1: Orchestrator Agent

**File**: `backend/src/agents/orchestratorAgent.ts`

```
Input: "Research topic: [topic], Session ID: [sessionId]"
                    ↓
Orchestrator breaks topic into 3-5 focused sub-tasks
Example: "What is AI?" → 
  - "History and evolution of AI"
  - "Current AI applications and market"
  - "Ethical implications of AI"
  - "Future trends in AI"
                    ↓
Creates delegation tool calls:
  - delegateResearch() → sends sub-tasks to Research Agent
  - delegateAnalysis() → sends findings to Analysis Agent
  - delegateWriting() → sends analysis to Writing Agent
```

**Orchestrator Instructions**:
1. Receive research topic with embedded session ID
2. Decompose topic into 3-5 distinct research angles
3. Call `delegateResearch` tool with sub-tasks and sessionId
4. Pass findings to `delegateAnalysis` tool with sessionId
5. Send analysis to `delegateWriting` tool with topic and sessionId
6. Return final report as response

**Tool: delegateResearch**
- Calls `researchAgent.generate()` with formatted prompt
- Records agent trace (starts/finishes)
- Logs all steps to database with token counts
- Returns findings as JSON

---

### Phase 2: Research Agent

**File**: `backend/src/agents/researchAgent.ts`

```
Input: List of sub-tasks from Orchestrator
                    ↓
For EACH sub-task:
  - Execute web-search tool (DuckDuckGo API)
  - Return raw findings with URLs
  - Vary search queries for comprehensive coverage
                    ↓
Output: Structured JSON with findings, sources, and URLs
```

**Research Instructions**:
1. Receive list of search sub-tasks
2. For each sub-task, use `webSearch` tool multiple times with varied queries
3. Collect raw source material: facts, quotes, URLs
4. Include source URL alongside each finding
5. Do NOT analyze or interpret (Analysis Agent's job)
6. Output JSON: `{ "findings": [ { "query": "...", "content": "...", "source": "..." } ] }`

**Tool: webSearch** (`backend/src/tools/searchTool.ts`)
- Queries DuckDuckGo API: `https://api.duckduckgo.com/?q=...&format=json`
- Returns:
  - Abstract/summary text
  - Related topics (up to 5)
  - Direct search results (up to 3)
- Formats results with URLs for traceability

---

### Phase 3: Analysis Agent

**File**: `backend/src/agents/analysisAgent.ts`

```
Input: Raw research findings from Research Agent
                    ↓
1. Evaluate source quality and relevance
2. Extract key insights from each source
3. Identify contradictions between sources
4. Group findings into coherent themes
5. Discard unreliable information
                    ↓
Output: JSON with:
  - themes[] (title, insights, sources)
  - contradictions[] (issue, resolution)
  - key_findings[]
```

**Analysis Instructions**:
- Be objective and evidence-based
- Note contradictions and state which source appears more credible
- Remove off-topic or unreliable findings
- Output JSON structure:
  ```json
  {
    "themes": [
      { "title": "...", "insights": ["..."], "sources": ["..."] }
    ],
    "contradictions": [
      { "issue": "...", "resolution": "..." }
    ],
    "key_findings": ["..."]
  }
  ```

---

### Phase 4: Writing Agent

**File**: `backend/src/agents/writingAgent.ts`

```
Input: Analysis output + original topic
                    ↓
Produces polished Markdown report with:
  # [Topic Title]
  ## Executive Summary
  ## Key Findings
  ## Detailed Analysis
  ## Source References
  ## Conclusion
                    ↓
Output: Final research report (Markdown)
```

**Writing Instructions**:
1. Receive analysed findings and original topic
2. Draft comprehensive, well-structured Markdown report
3. Follow exact structure (Executive Summary, Key Findings, Detailed Analysis, etc.)
4. Write clearly for professional audience
5. Ensure every claim traces to a source
6. Maintain objective, factual tone
7. Output full Markdown report as final message

---

## 📊 Custom Observability Tracking

**File**: `backend/src/tracing/tracer.ts`

Every step is tracked in SQLite with these tables:

### Database Schema

**users**
- `id` (TEXT, PRIMARY KEY)
- `username` (TEXT, UNIQUE)
- `password_hash` (TEXT)
- `created_at` (INTEGER)

**sessions**
- `id` (TEXT, PRIMARY KEY)
- `user_id` (FOREIGN KEY)
- `topic` (TEXT)
- `status` ('running', 'completed', 'failed')
- `started_at` (INTEGER)
- `finished_at` (INTEGER, nullable)
- `total_prompt_tokens` (INTEGER)
- `total_completion_tokens` (INTEGER)
- `total_cost_usd` (REAL)
- `total_steps` (INTEGER)
- `final_report` (TEXT, nullable)

**agent_traces**
- `id` (TEXT, PRIMARY KEY)
- `session_id` (FOREIGN KEY)
- `agent_name` (TEXT)
- `started_at` (INTEGER)
- `finished_at` (INTEGER, nullable)
- `prompt_tokens` (INTEGER)
- `completion_tokens` (INTEGER)
- `cost_usd` (REAL)
- `steps_executed` (INTEGER)
- `status` ('running', 'completed', 'max_steps_reached', 'failed')
- `error` (TEXT, nullable)

**agent_steps**
- `id` (TEXT, PRIMARY KEY)
- `trace_id` (FOREIGN KEY)
- `session_id` (FOREIGN KEY)
- `step_index` (INTEGER)
- `agent_name` (TEXT)
- `type` ('input', 'output', 'tool_call', etc.)
- `input` (TEXT, nullable)
- `output` (TEXT, nullable)
- `tool_name` (TEXT, nullable)
- `tool_args` (TEXT, nullable - JSON)
- `tool_result` (TEXT, nullable - JSON)
- `prompt_tokens` (INTEGER)
- `completion_tokens` (INTEGER)
- `timestamp` (INTEGER)

### Cost Calculation

```typescript
Cost = (promptTokens / 1M × inputPrice) + (completionTokens / 1M × outputPrice)

Model Pricing (DeepInfra):
- DeepSeek-V3: input $0.26/M, output $0.38/M
- Qwen/Qwen3-30B-A3B: input $0.07/M, output $0.15/M
- Qwen/Qwen3-235B-A22B: input $0.13/M, output $0.60/M
- THUDM/GLM-4-32B-0414: input $0.10/M, output $0.20/M
```

### Tracer Functions

- `createSession(userId, topic)`: Initialize session on research start
- `createAgentTrace(sessionId, agentName)`: Start tracing for each agent
- `recordAgentStep(params)`: Log individual step with tokens and cost
- `finishAgentTrace(traceId, status)`: Mark agent execution as complete
- `finishSession(sessionId, status, report)`: Finalize session with report

---

## 🎯 Key Components & Their Functions

### Backend Routes

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `/api/auth/register` | POST | User registration with bcrypt password hashing | No |
| `/api/auth/login` | POST | User login, returns JWT token | No |
| `/api/research/start` | POST | **Main pipeline trigger** - starts SSE stream | Yes |
| `/api/research/sessions` | GET | List all user's research sessions | Yes |
| `/api/research/sessions/:id` | GET | Detailed observability for specific session | Yes |
| `/api/health` | GET | Health check endpoint | No |

### Frontend Pages

| Component | File | Function |
|---|---|---|
| **LoginPage** | `frontend/src/pages/LoginPage.tsx` | Auth UI - register/login with username/password |
| **ResearchPage** | `frontend/src/pages/ResearchPage.tsx` | Main research interface - input topic, view live agent feed, display report |
| **ObservabilityPage** | `frontend/src/pages/ObservabilityPage.tsx` | Analytics dashboard - view token usage, costs, step-by-step execution |

### Frontend Utilities

| File | Purpose |
|---|---|
| `frontend/src/utils/api.ts` | API client - auth, session retrieval, SSE streaming |
| `frontend/src/hooks/useAuth.ts` | React hook for auth state management |
| `frontend/src/types/index.ts` | TypeScript type definitions |

### Backend Tools

| Tool | File | Used By | Action |
|---|---|---|---|
| **webSearch** | `backend/src/tools/searchTool.ts` | ResearchAgent | Queries DuckDuckGo API, returns formatted results with sources |

### Backend Agents

| Agent | File | Role |
|---|---|---|
| **OrchestratorAgent** | `backend/src/agents/orchestratorAgent.ts` | Decomposes topic, delegates to sub-agents, synthesizes final output |
| **ResearchAgent** | `backend/src/agents/researchAgent.ts` | Performs web searches, returns raw findings with URLs |
| **AnalysisAgent** | `backend/src/agents/analysisAgent.ts` | Evaluates sources, extracts insights, resolves contradictions |
| **WritingAgent** | `backend/src/agents/writingAgent.ts` | Drafts final structured Markdown report |

---

## 🔐 Security

1. **JWT Authentication**: All research endpoints require valid Bearer token
   - Issued on login/register
   - Expires in 24 hours
   - Verified on every protected endpoint

2. **Password Security**: bcryptjs hashing
   - 10 salt rounds
   - Passwords compared with hash on login

3. **CORS**: Configured to only allow frontend URL
   - Default: `http://localhost:5173` (dev)
   - Configurable via `FRONTEND_URL` env variable

4. **Input Validation**:
   - Username: ≥3 chars
   - Password: ≥6 chars
   - Topic: Required, non-empty

---

## 💾 Data Storage

- **Database**: SQLite file at `backend/data/research.db`
- **Persisted Data**:
  - User accounts (username, hashed password)
  - Research sessions (topic, status, timestamps)
  - Agent traces (per-agent execution details)
  - Individual steps (detailed step-by-step tracking)
- **Transient Data**: JWT tokens stored in frontend localStorage

---

## 🔄 Real-Time Communication

### Frontend → Backend: POST Request with JWT

```javascript
fetch('/api/research/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ topic: 'What is artificial intelligence?' })
})
```

### Backend → Frontend: Server-Sent Events (SSE)

```
event: session_started
data: { "sessionId": "abc-123", "topic": "What is artificial intelligence?" }

event: agent_start
data: { "agent": "OrchestratorAgent", "message": "Breaking topic into research sub-tasks..." }

event: agent_start
data: { "agent": "ResearchAgent", "message": "Searching the web for information..." }

event: agent_start
data: { "agent": "AnalysisAgent", "message": "Evaluating sources and extracting key findings..." }

event: agent_start
data: { "agent": "WritingAgent", "message": "Drafting the final research report..." }

event: agent_done
data: { "agent": "OrchestratorAgent", "message": "Pipeline complete." }

event: report_ready
data: { "sessionId": "abc-123", "report": "# Artificial Intelligence\n\n## Executive Summary\n..." }

event: error
data: { "message": "LLM API error: Invalid API key..." }
```

**SSE Headers Set by Backend**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

---

## ✨ Complete User Journey

```
1. User visits application
        ↓
2. User registers/logs in → JWT token stored in localStorage
        ↓
3. User navigates to ResearchPage
        ↓
4. User enters research topic (e.g., "History of quantum computing")
        ↓
5. User clicks "Research" button
        ↓
6. Frontend sends POST /api/research/start with JWT header
        ↓
7. Backend creates session in database
        ↓
8. SSE stream opens between frontend and backend
        ↓
9. OrchestratorAgent receives topic + sessionId
        ↓
10. Orchestrator decomposes topic:
    - "History and evolution of quantum computing"
    - "Current quantum computing technology"
    - "Applications of quantum computing"
    - "Challenges and limitations"
        ↓
11. Orchestrator calls delegateResearch tool
        ↓
12. ResearchAgent executes for each sub-task:
    - webSearch("quantum computing history")
    - webSearch("quantum computing evolution")
    - webSearch("quantum computer applications")
    - ... (multiple queries per sub-task)
    - Returns findings with URLs
        ↓
13. ResearchAgent results stored in database + SSE event sent to frontend
        ↓
14. Orchestrator calls delegateAnalysis tool
        ↓
15. AnalysisAgent receives raw findings:
    - Evaluates source quality
    - Extracts key insights
    - Groups findings into themes
    - Identifies contradictions
    - Returns structured analysis
        ↓
16. AnalysisAgent results stored in database + SSE event sent to frontend
        ↓
17. Orchestrator calls delegateWriting tool
        ↓
18. WritingAgent receives analysis + topic:
    - Drafts professional Markdown report
    - Includes Executive Summary, Key Findings, Detailed Analysis, Sources, Conclusion
    - Returns polished report
        ↓
19. WritingAgent results stored in database
        ↓
20. Backend sends final report_ready SSE event to frontend
        ↓
21. Frontend displays Markdown report using ReactMarkdown
        ↓
22. Frontend displays agent activity feed (OrchestratorAgent → ResearchAgent → AnalysisAgent → WritingAgent)
        ↓
23. Session marked as 'completed' in database with total tokens and cost
        ↓
24. User can click "Observability Dashboard" to view:
    - Total cost (USD)
    - Token usage breakdown
    - Duration of execution
    - Per-step details (tool calls, results, arguments)
    - Agent-by-agent metrics
```

---

## 🚀 Environment Configuration

**Backend `.env` file**:
```
PORT=3001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-strong-secret-key
DEEPINFRA_API_KEY=your-deepinfra-api-key
DEEPINFRA_BASE_URL=https://api.deepinfra.com/v1/openai
DEFAULT_MODEL=deepseek-ai/DeepSeek-V3
```

**Frontend URLs** (hardcoded):
```
API_BASE=/api
```

---

## 📦 Key Dependencies

### Backend
- `@mastra/core`: Multi-agent framework with tool creation and agent orchestration
- `@ai-sdk/openai`: OpenAI-compatible LLM provider adapter
- `express`: Web server framework
- `@libsql/client`: SQLite database client
- `jsonwebtoken`: JWT authentication
- `bcryptjs`: Password hashing
- `cors`: Cross-origin request handling
- `zod`: Schema validation for tool inputs/outputs

### Frontend
- `react`: UI library
- `vite`: Build tool and dev server
- `react-markdown`: Markdown rendering component
- `typescript`: Type safety

---

## 🔧 Development

### Start Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3001
```

### Start Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Build for Production
```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

---

## 📝 Notes

- **Max Steps**: Every agent has `max_steps: 50` to bound autonomous execution
- **Session Tracking**: Every research run creates a unique session ID for full traceability
- **Cost Transparency**: All costs calculated in real-time and persisted to database
- **Error Handling**: Helpful error messages distinguish between LLM API issues and other errors
- **Real-Time Feedback**: SSE provides live updates without polling

---

**System Created**: June 2026  
**Architecture Pattern**: Multi-agent orchestration with tool delegation  
**Database**: SQLite with custom observability schema
