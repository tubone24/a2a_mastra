# A2A Mastra Demo - Multi-Agent System with Amazon Bedrock

A demonstration of Agent-to-Agent (A2A) communication protocol using the Mastra framework, featuring multiple specialized AI agents powered by Amazon Bedrock. This project showcases how autonomous agents can communicate, collaborate, and delegate tasks to achieve complex goals.

The system uses a hybrid architecture where Gateway agent(A2A Client Agent) runs on Express server with REST API implementation, while Data Processor, Summarizer, and Web Search agents use Mastra Dev Server with native A2A protocol.

![demo](./docs/images/demo.gif)

## 🏗️ Architecture Overview

The system consists of four specialized agents that communicate via the A2A protocol

1. **Gateway Agent** - Request routing and workflow orchestration(A2A Client Agent)
2. **Data Processor Agent** - Data analysis and transformation(A2A Remote Agent)
3. **Summarizer Agent** - Content summarization and insight extraction(A2A Remote Agent)
4. **Web Search Agent** - Real-time web information retrieval(A2A Remote Agent)

### Technology Stack
- **Framework**: Hybrid Architecture - Gateway (Express Server + REST API) + Data Processor, Summarizer, Web Search (Mastra Dev Server)
- **LLM**: Amazon Bedrock Claude 3.5 Sonnet
- **Language**: TypeScript
- **Frontend**: Next.js
- **Containerization**: Docker & Docker Compose
- **Observability**: Langfuse
- **Web Search**: Brave Search API + MCP (Model Context Protocol)

### System Architecture Overview

```mermaid
flowchart TB
   subgraph subGraph0["Express + REST API - Gateway"]
      GW_EXPRESS["Express Server<br>Port: 3001"]
      GW_ROUTES["Express Routes<br>/api/gateway/*"]
      GW_MASTRA_AGENT["Gateway Agent"]
      GW_REST_API["REST API Interface"]
   end
   subgraph subGraph1["Gateway Agent (Express Server)"]
      subGraph0
   end
   subgraph subGraph2["Express Server Agent"]
      subGraph1
   end
   subgraph subGraph3["Mastra Native Stack - Data Processor"]
      DP_MASTRA_DEV["Mastra Dev Server<br>Port: 3002"]
      DP_MASTRA_HONO["Built-in Hono Server"]
      DP_MASTRA_AGENT["Data Processor Agent"]
      DP_MASTRA_A2A["Native A2A Protocol"]
      DP_MASTRA_STORAGE["In-Memory Storage<br>LibSQL"]
   end
   subgraph subGraph4["Data Processor Agent (Mastra Dev Server)"]
      subGraph3
   end
   subgraph subGraph5["Mastra Native Stack - Summarizer"]
      SM_MASTRA_DEV["Mastra Dev Server<br>Port: 3003"]
      SM_MASTRA_HONO["Built-in Hono Server"]
      SM_MASTRA_AGENT["Summarizer Agent"]
      SM_MASTRA_A2A["Native A2A Protocol"]
      SM_MASTRA_STORAGE["In-Memory Storage<br>LibSQL"]
   end
   subgraph subGraph6["Summarizer Agent (Mastra Dev Server)"]
      subGraph5
   end
   subgraph subGraph7["Mastra Native Stack - Web Search"]
      WS_MASTRA_DEV["Mastra Dev Server<br>Port: 3004"]
      WS_MASTRA_HONO["Built-in Hono Server"]
      WS_MASTRA_AGENT["Web Search Agent"]
      WS_MASTRA_A2A["Native A2A Protocol"]
      WS_MASTRA_STORAGE["In-Memory Storage<br>LibSQL"]
      WS_MCP_INTEGRATION["MCP Integration"]
   end
   subgraph subGraph8["Web Search Agent (Mastra Dev Server)"]
      subGraph7
   end
   subgraph subGraph9["Mastra Dev Server Agents"]
      subGraph4
      subGraph6
      subGraph8
   end
   subgraph subGraph10["External Services"]
      BEDROCK["Amazon Bedrock<br>Claude 3.5 Sonnet"]
      LANGFUSE["Langfuse<br>Observability"]
      BRAVE["Brave Search API"]
      MCP["MCP Server<br>Web Search Tools"]
   end
   GW_EXPRESS --> GW_ROUTES
   GW_ROUTES --> GW_MASTRA_AGENT
   GW_MASTRA_AGENT --> GW_REST_API & BEDROCK
   DP_MASTRA_DEV --> DP_MASTRA_HONO & DP_MASTRA_STORAGE
   DP_MASTRA_HONO --> DP_MASTRA_AGENT
   DP_MASTRA_AGENT --> DP_MASTRA_A2A & BEDROCK
   SM_MASTRA_DEV --> SM_MASTRA_HONO & SM_MASTRA_STORAGE
   SM_MASTRA_HONO --> SM_MASTRA_AGENT
   SM_MASTRA_AGENT --> SM_MASTRA_A2A & BEDROCK
   WS_MASTRA_DEV --> WS_MASTRA_HONO & WS_MASTRA_STORAGE
   WS_MASTRA_HONO --> WS_MASTRA_AGENT
   WS_MASTRA_AGENT --> WS_MASTRA_A2A & WS_MCP_INTEGRATION & BEDROCK
   GW_REST_API <-- Native A2A Protocol --> DP_MASTRA_A2A & SM_MASTRA_A2A & WS_MASTRA_A2A
   WS_MCP_INTEGRATION -- MCP Stdio --> MCP
   MCP --> BRAVE
   GW_MASTRA_AGENT -. Traces .-> LANGFUSE
   DP_MASTRA_AGENT -. Traces .-> LANGFUSE
   SM_MASTRA_AGENT -. Traces .-> LANGFUSE
   WS_MASTRA_AGENT -. Traces .-> LANGFUSE

   style GW_EXPRESS fill:#e3f2fd
   style DP_MASTRA_DEV fill:#e8f5e8
   style DP_MASTRA_STORAGE fill:#fff3e0
   style SM_MASTRA_DEV fill:#e8f5e8
   style SM_MASTRA_STORAGE fill:#fff3e0
   style WS_MASTRA_DEV fill:#e8f5e8
   style WS_MASTRA_STORAGE fill:#fff3e0
```

**Architecture Features:**
- **Hybrid Implementation**: Gateway uses Express with REST API, Data Processor/Summarizer/Web Search use Mastra Dev Server
- **Mixed Communication Protocols**: REST API for Gateway, native Mastra A2A for other agents
- **Native Integration**: Data Processor, Summarizer, and Web Search agents use built-in Hono server and LibSQL storage
- **MCP Support**: Web Search agent integrates MCP protocol for external tool access

### Simplified System Architecture

```mermaid
graph TB
   subgraph "Frontend Layer"
      UI[Next.js Frontend<br/>Port: 3000]
   end

   subgraph "Agent Layer - Hybrid Architecture"
      GW[Gateway Agent<br/>Express Server<br/>Port: 3001]
      DP[Data Processor<br/>Mastra Dev Server<br/>Port: 3002]
      SM[Summarizer Agent<br/>Mastra Dev Server<br/>Port: 3003]
      WS[Web Search Agent<br/>Mastra Dev Server<br/>Port: 3004]
   end

   subgraph "External Services"
      BEDROCK[Amazon Bedrock<br/>Claude 3.5 Sonnet]
      LANGFUSE[Langfuse<br/>Tracing]
      BRAVE[Brave Search API]
      MCP[MCP Server<br/>Web Search Tools]
   end

   UI -->|HTTP/REST| GW
   GW <-->|Native A2A Protocol| DP
   GW <-->|Native A2A Protocol| SM
   GW <-->|Native A2A Protocol| WS

   DP --> BEDROCK
   SM --> BEDROCK
   GW --> BEDROCK
   WS --> BEDROCK
   WS --> |MCP Stdio| MCP
   MCP --> BRAVE

   GW -.->|Traces| LANGFUSE
   DP -.->|Traces| LANGFUSE
   SM -.->|Traces| LANGFUSE
   WS -.->|Traces| LANGFUSE

   style UI fill:#e1f5fe
   style GW fill:#e3f2fd
   style DP fill:#e8f5e8
   style SM fill:#e8f5e8
   style WS fill:#e8f5e8
```

## 🚀 Features

- **Hybrid API Communication**: REST API for Gateway, native Mastra A2A for Data Processor/Summarizer/Web Search
- **Mixed Architecture**: Express server for Gateway, Mastra Dev Server for Data Processor/Summarizer/Web Search
- **Workflow Orchestration**: Complex multi-step workflows with automatic task delegation
- **Real-time Visualization**: Live visualization of agent communication flows
- **Tracing & Observability**: Comprehensive tracing with Langfuse integration
- **MCP Integration**: Model Context Protocol support for web search capabilities
- **Japanese Language Support**: All agents respond in Japanese
- **Containerized Deployment**: Docker-based microservices architecture

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local development)
- AWS Account with Bedrock access
- Langfuse account (optional, for tracing)
- Brave Search API key (optional, for web search)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/tubone24/a2a_mastra.git
cd a2a_mastra
```

### 2. Copy the environment variables

```bash
cp .env.example .env
```

### 3. Configure your `.env` file
```env
# AWS Credentials for Amazon Bedrock
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1

# Bedrock Model
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0

# Langfuse (optional)
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_BASEURL=https://cloud.langfuse.com

# Brave Search (optional)
BRAVE_SEARCH_API_KEY=your-api-key
```

### 4. Build and start the services

```bash
docker-compose up --build
```

## 🎯 Usage

Once the system is running, access the frontend at `http://localhost:3000`.

### Available Operations

1. **Data Processing** (`/api/gateway/agents` - type: process)
   - Analyzes and transforms data
   - Extracts patterns and insights

2. **Summarization** (`/api/gateway/agents` - type: summarize)
   - Creates concise summaries
   - Supports different audience types (technical, executive, general)

3. **Analysis Workflow** (`/api/gateway/agents` - type: analyze)
   - Combines data processing and summarization
   - End-to-end data analysis pipeline

4. **Web Search** (`/api/gateway/agents` - type: web-search)
   - Real-time web information retrieval
   - News and scholarly article search

5. **Deep Research** (`/api/gateway/agents` - type: deep-research)
   - Multi-step research workflow using asynchronous task processing
   - Combines web search, data processing, and summarization
   - Long-running tasks with progress tracking and status polling

### API Examples

```bash
# Analyze data with full workflow
curl -X POST http://localhost:3001/api/gateway/agents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "analyze",
    "data": "Your data here",
    "options": {
      "audienceType": "executive"
    }
  }'

# Deep Research (Asynchronous)
curl -X POST http://localhost:3001/api/gateway/agents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "deep-research",
    "topic": "AI trends in healthcare 2024",
    "options": {
      "depth": "comprehensive",
      "sources": ["web", "news", "academic"],
      "audienceType": "technical",
      "maxDuration": "10 minutes"
    }
  }'

# Response for Deep Research
{
  "taskId": "research-task-abc-123",
  "status": "initiated",
  "estimatedDuration": "8-10 minutes",
  "pollUrl": "/api/gateway/task/research-task-abc-123",
  "steps": {
    "total": 5,
    "current": 1,
    "phases": ["search", "analyze", "synthesize", "validate", "report"]
  }
}

# Poll for status
curl http://localhost:3001/api/gateway/task/research-task-abc-123
```

## 🔄 Communication Flows

### Agent Discovery

The system implements a centralized agent discovery mechanism through the Gateway agent. The discovery process allows agents to register their capabilities and discover other agents in the network.

```mermaid
sequenceDiagram
    participant Frontend
    participant FrontendAPI
    participant Gateway
    participant DataProcessor
    participant Summarizer
    participant WebSearch
    
    Note over Frontend,WebSearch: Agent Discovery Initiation
    
    Frontend->>FrontendAPI: GET /api/gateway/agents
    activate FrontendAPI
    
    FrontendAPI->>Gateway: GET /api/gateway/agents<br/>http://gateway:3001
    activate Gateway
    
    Note over Gateway,WebSearch: Gateway Discovers All Agents
    
    Gateway->>DataProcessor: Mastra A2A.getCard()<br/>agentId: "data-processor-agent-01"<br/>Port: 3002
    activate DataProcessor
    DataProcessor-->>Gateway: Agent Card Response<br/>{id: "data-processor-agent-01", capabilities: ["data-analysis"], status: "online"}
    deactivate DataProcessor
    
    Gateway->>Summarizer: Mastra A2A.getCard()<br/>agentId: "summarizer-agent-01"<br/>Port: 3003
    activate Summarizer
    Summarizer-->>Gateway: Agent Card Response<br/>{id: "summarizer-agent-01", capabilities: ["text-summarization"], status: "online"}
    deactivate Summarizer
    
    Gateway->>WebSearch: HTTP GET /api/gateway/info<br/>Port: 3004
    activate WebSearch
    WebSearch-->>Gateway: Agent Card Response<br/>{id: "web-search-agent-01", capabilities: ["web-search"], mcpEnabled: true}
    deactivate WebSearch
    
    Note over Gateway: Aggregate Agent Information
    
    Gateway-->>FrontendAPI: Discovery Response<br/>{gateway: {id: "gateway-agent-01", status: "online"},<br/>connectedAgents: [3 agents], totalAgents: 4}
    deactivate Gateway
    
    FrontendAPI-->>Frontend: Agent List Response<br/>{agents: [4 agents], discoveryTime: "150ms", onlineAgents: 4}
    deactivate FrontendAPI
    
    Note over Frontend: Display Agent Dashboard
    Frontend->>Frontend: Render Agent Cards<br/>- Status indicators<br/>- Capabilities<br/>- Supported task types
```

### Gateway API Communication

The system implements REST API for Gateway and Mastra A2A protocol for other agents:

**For Express Server Agent (Gateway):**
1. **REST API Discovery** - HTTP endpoint `/api/gateway/info` for agent capability discovery
2. **REST API Message Exchange** - HTTP POST `/api/gateway/message` for synchronous communication
3. **REST API Task Management** - HTTP POST `/api/gateway/task` for asynchronous processing
4. **REST API Task Streaming** - HTTP GET `/api/gateway/task/{id}` for task progress polling

**For Mastra Dev Server Agents (Data Processor, Summarizer, Web Search):**
1. **Agent Discovery** - `A2A.getAgentCard(agentId)` - Agent capability discovery
2. **Message Exchange** - `A2A.sendMessage({to, from, content})` - Synchronous communication
3. **Task Management** - `A2A.createTask({agentId, taskType, payload})` - Asynchronous processing
4. **Task Streaming** - `A2A.streamTaskUpdates(taskId)` - Real-time task progress updates

### Workflow Sequence with Agent Discovery

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant DataProcessor
    participant Summarizer
    
    Note over Gateway,Summarizer: Agent Discovery Phase (Mastra A2A)
    
    Gateway->>DataProcessor: A2A.getAgentCard("data-processor-agent-01")<br/>Port: 3002
    DataProcessor-->>Gateway: {agentId, name, capabilities,<br/>supportedTypes: ["process", "analyze"]}
    
    Gateway->>Summarizer: A2A.getAgentCard("summarizer-agent-01")<br/>Port: 3003
    Summarizer-->>Gateway: {agentId, name, capabilities,<br/>supportedTypes: ["summarize", "executive-summary"]}
    
    Note over Client,Summarizer: Workflow Execution Phase
    
    Client->>Gateway: POST /api/gateway/agents<br/>{type: "analyze", data: {...}}
    activate Gateway
    
    Gateway->>Gateway: Create Workflow Execution<br/>Generate traceId & workflowId
    
    Gateway->>DataProcessor: A2A.sendMessage({<br/>  to: "data-processor-agent-01",<br/>  from: "gateway-agent-01",<br/>  content: {<br/>    type: "process",<br/>    data: {...},<br/>    metadata: {<br/>      workflowId: "wf-123",<br/>      traceId: "trace-456",<br/>      step: 1<br/>    }<br/>  }<br/>})
    activate DataProcessor
    
    DataProcessor->>DataProcessor: Process with Bedrock<br/>Track with Langfuse
    DataProcessor-->>Gateway: {<br/>  status: "success",<br/>  data: {processed_data, insights},<br/>  metadata: {processingTime: 1200ms}<br/>}
    deactivate DataProcessor
    
    Gateway->>Summarizer: A2A.sendMessage({<br/>  to: "summarizer-agent-01",<br/>  from: "gateway-agent-01",<br/>  content: {<br/>    type: "summarize",<br/>    data: processed_data,<br/>    options: {audienceType: "executive"},<br/>    metadata: {<br/>      workflowId: "wf-123",<br/>      traceId: "trace-456",<br/>      step: 2<br/>    }<br/>  }<br/>})
    activate Summarizer
    
    Summarizer->>Summarizer: Generate with Bedrock<br/>Track with Langfuse
    Summarizer-->>Gateway: {<br/>  status: "success",<br/>  data: {summary, keyPoints, recommendations},<br/>  metadata: {processingTime: 800ms}<br/>}
    deactivate Summarizer
    
    Gateway->>Gateway: Complete Workflow<br/>Aggregate Results
    Gateway-->>Client: {<br/>  workflowId: "wf-123",<br/>  status: "completed",<br/>  result: {processedData, summary},<br/>  totalDuration: 2000ms<br/>}
    deactivate Gateway
```

### Web Search Flow with MCP Details

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant WebSearch
    participant MCPServer
    participant BraveAPI
    
    Note over Gateway,WebSearch: Agent Card Exchange via Mastra A2A
    
    Gateway->>WebSearch: A2A.getCard()<br/>agentId: "web-search-agent-01"<br/>Port: 3004
    WebSearch-->>Gateway: {<br/>  agentId: "web-search-agent-01",<br/>  name: "Web Search Agent",<br/>  capabilities: ["web-search", "news-search"],<br/>  mcpEnabled: true,<br/>  protocols: ["a2a/v1", "mcp/v1"]<br/>}
    
    Note over Client,BraveAPI: Search Request Flow
    
    Client->>Gateway: POST /api/gateway/agents<br/>{type: "web-search", query: "AI trends 2024"}
    activate Gateway
    
    Gateway->>WebSearch: A2A.sendMessage({<br/>  to: "web-search-agent-01",<br/>  from: "gateway-agent-01",<br/>  content: {<br/>    type: "search",<br/>    query: "AI trends 2024",<br/>    options: {limit: 10}<br/>  }<br/>})
    activate WebSearch
    
    Note over WebSearch,MCPServer: MCP Communication via Stdio
    
    WebSearch->>MCPServer: MCP Stdio Protocol<br/>{<br/>  method: "tool/call",<br/>  params: {<br/>    name: "brave_web_search",<br/>    arguments: {<br/>      query: "AI trends 2024",<br/>      count: 10<br/>    }<br/>  }<br/>}
    activate MCPServer
    
    MCPServer->>BraveAPI: GET /web/search<br/>Headers: {<br/>  "X-Subscription-Token": "api-key",<br/>  "Accept": "application/json"<br/>}<br/>Query: q=AI+trends+2024&count=10
    
    BraveAPI-->>MCPServer: {<br/>  web: {<br/>    results: [<br/>      {title: "...", url: "...", snippet: "..."},<br/>      ...<br/>    ]<br/>  }<br/>}
    
    MCPServer->>MCPServer: Format Results<br/>Extract Relevant Data
    
    MCPServer-->>WebSearch: MCP Stdio Response<br/>{<br/>  content: {<br/>    type: "tool_response",<br/>    tool_use_id: "...",<br/>    content: [<br/>      {type: "text", text: "Search results..."}<br/>    ]<br/>  }<br/>}
    deactivate MCPServer
    
    WebSearch->>WebSearch: Analyze with Bedrock<br/>{<br/>  task: "Summarize search results",<br/>  context: search_results<br/>}
    
    WebSearch-->>Gateway: {<br/>  status: "success",<br/>  data: {<br/>    searchResults: [...],<br/>    summary: "AI generated summary",<br/>    keyFindings: [...],<br/>    sources: [...]<br/>  },<br/>  metadata: {<br/>    totalResults: 10,<br/>    processingTime: 1500ms<br/>  }<br/>}
    deactivate WebSearch
    
    Gateway-->>Client: {<br/>  requestId: "req-789",<br/>  status: "completed",<br/>  results: {searchData}<br/>}
    deactivate Gateway
```

### Deep Research Multi-Agent Workflow (Asynchronous)

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant WebSearch
    participant DataProcessor
    participant Summarizer
    
    Note over Client,Summarizer: Phase 1: Research Initiation
    
    Client->>Gateway: POST /api/gateway/agents<br/>{<br/>  type: "deep-research",<br/>  topic: "AI in healthcare 2024",<br/>  options: {depth: "comprehensive"}<br/>}
    activate Gateway
    
    Gateway->>Gateway: Generate Research Plan<br/>taskId: "research-abc-123"<br/>phases: [search, analyze, synthesize]
    
    Gateway-->>Client: {<br/>  taskId: "research-abc-123",<br/>  status: "initiated",<br/>  phases: ["search", "analyze", "synthesize"],<br/>  pollUrl: "/api/gateway/task/research-abc-123"<br/>}
    
    Note over Gateway,Summarizer: Phase 2: Initial Web Search (Async)
    
    Gateway->>WebSearch: A2A.createTask({<br/>  agentId: "web-search-agent-01",<br/>  taskType: "comprehensive-search",<br/>  payload: {<br/>    query: "AI healthcare trends 2024",<br/>    options: {sources: ["web", "news"]}<br/>  }<br/>})<br/>Port: 3004
    activate WebSearch
    
    WebSearch-->>Gateway: {<br/>  taskId: "search-sub-task-1",<br/>  status: "accepted",<br/>  estimatedTime: "2-3 minutes"<br/>}
    
    Note over Client,WebSearch: Client Polling During Search Phase
    
    Client->>Gateway: GET /api/gateway/task/research-abc-123
    Gateway->>WebSearch: A2A.streamTaskUpdates("search-sub-task-1")
    WebSearch-->>Gateway: {status: "working", progress: 30, phase: "web-search"}
    Gateway-->>Client: {<br/>  status: "working",<br/>  currentPhase: "search",<br/>  progress: 30,<br/>  details: "Searching web sources..."<br/>}
    
    WebSearch->>WebSearch: Execute Multiple Searches<br/>- General AI healthcare<br/>- Recent developments<br/>- Market analysis
    
    WebSearch-->>Gateway: {<br/>  taskId: "search-sub-task-1",<br/>  status: "completed",<br/>  result: {<br/>    sources: 50,<br/>    articles: [...],<br/>    keyThemes: [...]<br/>  }<br/>}
    deactivate WebSearch
    
    Note over Gateway,Summarizer: Phase 3: Data Analysis (Async)
    
    Gateway->>DataProcessor: A2A.createTask({<br/>  agentId: "data-processor-agent-01",<br/>  taskType: "research-analysis",<br/>  payload: {<br/>    data: {searchResults},<br/>    options: {analyzePatterns: true}<br/>  }<br/>})<br/>Port: 3002
    activate DataProcessor
    
    DataProcessor-->>Gateway: {<br/>  taskId: "analyze-sub-task-2",<br/>  status: "accepted",<br/>  estimatedTime: "3-4 minutes"<br/>}
    
    Client->>Gateway: GET /api/gateway/task/research-abc-123
    Gateway->>DataProcessor: A2A.streamTaskUpdates("analyze-sub-task-2")
    DataProcessor-->>Gateway: {status: "working", progress: 60, phase: "analysis"}
    Gateway-->>Client: {<br/>  status: "working",<br/>  currentPhase: "analyze",<br/>  progress: 60,<br/>  details: "Analyzing patterns and trends..."<br/>}
    
    DataProcessor->>DataProcessor: Deep Analysis<br/>- Pattern identification<br/>- Trend analysis<br/>- Data correlation<br/>- Statistical insights
    
    DataProcessor-->>Gateway: {<br/>  taskId: "analyze-sub-task-2",<br/>  status: "completed",<br/>  result: {<br/>    patterns: [...],<br/>    trends: [...],<br/>    insights: [...],<br/>    correlations: [...]<br/>  }<br/>}
    deactivate DataProcessor
    
    Note over Gateway,Summarizer: Phase 4: Synthesis & Report Generation (Async)
    
    Gateway->>Summarizer: A2A.createTask({<br/>  agentId: "summarizer-agent-01",<br/>  taskType: "research-synthesis",<br/>  payload: {<br/>    data: {searchResults, analysisResults},<br/>    options: {<br/>      reportType: "comprehensive",<br/>      audienceType: "technical"<br/>    }<br/>  }<br/>})<br/>Port: 3003
    activate Summarizer
    
    Summarizer-->>Gateway: {<br/>  taskId: "synthesis-sub-task-3",<br/>  status: "accepted",<br/>  estimatedTime: "2-3 minutes"<br/>}
    
    Client->>Gateway: GET /api/gateway/task/research-abc-123
    Gateway->>Summarizer: A2A.streamTaskUpdates("synthesis-sub-task-3")
    Summarizer-->>Gateway: {status: "working", progress: 85, phase: "synthesis"}
    Gateway-->>Client: {<br/>  status: "working",<br/>  currentPhase: "synthesize",<br/>  progress: 85,<br/>  details: "Generating comprehensive report..."<br/>}
    
    Summarizer->>Summarizer: Generate Research Report<br/>- Executive summary<br/>- Key findings<br/>- Trend analysis<br/>- Recommendations<br/>- Source citations
    
    Summarizer-->>Gateway: {<br/>  taskId: "synthesis-sub-task-3",<br/>  status: "completed",<br/>  result: {<br/>    executiveSummary: "...",<br/>    keyFindings: [...],<br/>    recommendations: [...],<br/>    fullReport: "...",<br/>    sources: [...]<br/>  }<br/>}
    deactivate Summarizer
    
    Gateway->>Gateway: Compile Final Results<br/>- Aggregate all findings<br/>- Create research timeline<br/>- Generate metadata
    
    Note over Client,Summarizer: Phase 5: Research Completion
    
    Client->>Gateway: GET /api/gateway/task/research-abc-123
    Gateway-->>Client: {<br/>  taskId: "research-abc-123",<br/>  status: "completed",<br/>  totalDuration: "8 minutes 23 seconds",<br/>  result: {<br/>    executiveSummary: "...",<br/>    detailedFindings: {...},<br/>    sourcesAnalyzed: 50,<br/>    trendsIdentified: 12,<br/>    recommendations: [...],<br/>    confidence: 0.92,<br/>    methodology: "multi-agent-research"<br/>  },<br/>  metadata: {<br/>    phases: ["search", "analyze", "synthesize"],<br/>    agentsUsed: ["web-search", "data-processor", "summarizer"],<br/>    processingTime: {<br/>      search: "2m 15s",<br/>      analysis: "3m 42s",<br/>      synthesis: "2m 26s"<br/>    }<br/>  }<br/>}
    deactivate Gateway
```

## 🔧 Development

### Project Structure

```
a2a-mastra-demo/
├── agents/                    # Agent services (Express + Mastra hybrid)
│   ├── gateway/              # Gateway agent with workflow orchestration
│   │   ├── src/
│   │   │   ├── index.ts      # Express server with Mastra integration
│   │   │   ├── mastra/       # Mastra agent definitions
│   │   │   └── routes/       # Express API routes
│   │   └── package.json      # Dependencies (express + @mastra/core)
│   ├── data-processor/       # Data processing agent
│   ├── summarizer/           # Summarization agent
│   └── web-search/          # Web search agent with MCP integration
├── frontend/                 # Next.js frontend
├── shared/                   # Shared types and utilities
├── standalone-mcp-server/    # Standalone MCP server for web search
└── docker-compose.yml        # Docker composition
```

### Current Architecture

Agent services use a hybrid architecture

**Express Server Agent (Gateway):**
- **Express Server**: Node.js-based server (started with `node dist/index.js`)
- **REST API Protocol**: Standard HTTP-based REST API communication
- **Custom Storage**: Application-specific data management
- **Docker Container**: Isolated deployment for frontend communication

**Mastra Dev Server Agents (Data Processor, Summarizer, Web Search):**
- **Mastra Dev Server**: Hono-based native server (started with `mastra dev`)
- **Native A2A Protocol**: Mastra standard A2A communication protocol
- **In-Memory Storage**: In-memory storage via LibSQL
- **Docker Container**: Isolated deployment with native Mastra features

### Architecture Benefits

With the substantial migration to Mastra architecture:

**Achieved Benefits:**
- **Multi-Agent Modernization**: Data Processor, Summarizer, and Web Search agents use native Mastra A2A
- **Hybrid Flexibility**: Express with REST API for Gateway (frontend communication), Mastra for processing agents
- **MCP Protocol Support**: Advanced web search capabilities through Model Context Protocol
- **Unified Processing**: Consistent Mastra Dev Server for all data processing agents

**Future Enhancement Options:**
- **Complete Mastra Migration**: Migrate Gateway to Mastra Dev Server for full unification
- **Unified A2A Protocol**: Standardize on native Mastra A2A for all agents including Gateway
- **Production Storage**: Migrate to production-ready storage backends
- **Horizontal Scaling**: Implement multi-instance agent deployment

## 🔍 Monitoring & Debugging

### Langfuse Tracing

All agent interactions are traced in Langfuse. Access your traces at:
- EU: https://cloud.langfuse.com
- US: https://us.cloud.langfuse.com

### Docker Logs

Monitor agent logs:
```bash
# All services
docker-compose logs -f

# Specific agent
docker-compose logs -f gateway
```

## 🚢 Deployment(TBD)

The system is containerized and can be deployed to any Docker-compatible platform:

1. **AWS ECS/Fargate**
2. **Google Cloud Run**
3. **Azure Container Instances**
4. **Kubernetes**

Ensure all environment variables are properly configured in your deployment environment.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Mastra](https://mastra.ai) - The agent orchestration framework
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) - AI/ML model hosting
- [Langfuse](https://langfuse.com) - LLM tracing and observability
- [MCP](https://modelcontextprotocol.io/) - Model Context Protocol
