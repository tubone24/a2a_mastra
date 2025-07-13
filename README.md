# A2A Mastra Demo - Multi-Agent System with Amazon Bedrock

A demonstration of Agent-to-Agent (A2A) communication protocol using the Mastra framework, featuring multiple specialized AI agents powered by Amazon Bedrock. This project showcases how autonomous agents can communicate, collaborate, and delegate tasks to achieve complex goals.

**Current Implementation**: All agents are now built with Mastra's standard A2A protocol using Mastra Dev Server, providing unified and consistent agent-to-agent communication across the entire system.

![demo](./docs/images/demo.gif)

## 🏗️ Architecture Overview

The system consists of four specialized agents that communicate via the A2A protocol:

1. **Gateway Agent** - Request routing and workflow orchestration
2. **Data Processor Agent** - Data analysis and transformation
3. **Summarizer Agent** - Content summarization and insight extraction
4. **Web Search Agent** - Real-time web information retrieval

### Technology Stack
- **Framework**: Mastra Framework - All agents use Mastra Dev Server with native A2A protocol
- **LLM**: Amazon Bedrock Claude 3.5 Sonnet
- **Language**: TypeScript
- **Frontend**: Next.js
- **Containerization**: Docker & Docker Compose
- **Observability**: Langfuse
- **Web Search**: Brave Search API + MCP (Model Context Protocol)

### System Architecture Overview

```mermaid
graph TB
    subgraph "Mastra Dev Server Agents"
        subgraph "Gateway Agent (Mastra Dev Server)"
            subgraph "Mastra Native Stack - Gateway"
                GW_MASTRA_DEV[Mastra Dev Server<br/>Port: 3001]
                GW_MASTRA_HONO[Built-in Hono Server]
                GW_MASTRA_AGENT[Gateway Agent]
                GW_MASTRA_A2A[Native A2A Protocol]
                GW_MASTRA_STORAGE[In-Memory Storage<br/>LibSQL]
            end
            
            GW_MASTRA_DEV --> GW_MASTRA_HONO
            GW_MASTRA_HONO --> GW_MASTRA_AGENT
            GW_MASTRA_AGENT --> GW_MASTRA_A2A
            GW_MASTRA_DEV --> GW_MASTRA_STORAGE
        end
        
        subgraph "Data Processor Agent (Mastra Dev Server)"
            subgraph "Mastra Native Stack - Data Processor"
                DP_MASTRA_DEV[Mastra Dev Server<br/>Port: 3002]
                DP_MASTRA_HONO[Built-in Hono Server]
                DP_MASTRA_AGENT[Data Processor Agent]
                DP_MASTRA_A2A[Native A2A Protocol]
                DP_MASTRA_STORAGE[In-Memory Storage<br/>LibSQL]
            end
            
            DP_MASTRA_DEV --> DP_MASTRA_HONO
            DP_MASTRA_HONO --> DP_MASTRA_AGENT
            DP_MASTRA_AGENT --> DP_MASTRA_A2A
            DP_MASTRA_DEV --> DP_MASTRA_STORAGE
        end
        
        subgraph "Summarizer Agent (Mastra Dev Server)"
            subgraph "Mastra Native Stack - Summarizer"
                SM_MASTRA_DEV[Mastra Dev Server<br/>Port: 3003]
                SM_MASTRA_HONO[Built-in Hono Server]
                SM_MASTRA_AGENT[Summarizer Agent]
                SM_MASTRA_A2A[Native A2A Protocol]
                SM_MASTRA_STORAGE[In-Memory Storage<br/>LibSQL]
            end
            
            SM_MASTRA_DEV --> SM_MASTRA_HONO
            SM_MASTRA_HONO --> SM_MASTRA_AGENT
            SM_MASTRA_AGENT --> SM_MASTRA_A2A
            SM_MASTRA_DEV --> SM_MASTRA_STORAGE
        end
        
        subgraph "Web Search Agent (Mastra Dev Server)"
            subgraph "Mastra Native Stack - Web Search"
                WS_MASTRA_DEV[Mastra Dev Server<br/>Port: 3004]
                WS_MASTRA_HONO[Built-in Hono Server]
                WS_MASTRA_AGENT[Web Search Agent]
                WS_MASTRA_A2A[Native A2A Protocol]
                WS_MASTRA_STORAGE[In-Memory Storage<br/>LibSQL]
                WS_MCP_INTEGRATION[MCP Integration]
            end
            
            WS_MASTRA_DEV --> WS_MASTRA_HONO
            WS_MASTRA_HONO --> WS_MASTRA_AGENT
            WS_MASTRA_AGENT --> WS_MASTRA_A2A
            WS_MASTRA_AGENT --> WS_MCP_INTEGRATION
            WS_MASTRA_DEV --> WS_MASTRA_STORAGE
        end
    end
    
    subgraph "External Services"
        BEDROCK[Amazon Bedrock<br/>Claude 3.5 Sonnet]
        LANGFUSE[Langfuse<br/>Observability]
        BRAVE[Brave Search API]
        MCP[MCP Server<br/>Web Search Tools]
    end
    
    GW_MASTRA_A2A <-->|Mastra A2A Protocol| DP_MASTRA_A2A
    GW_MASTRA_A2A <-->|Mastra A2A Protocol| SM_MASTRA_A2A
    GW_MASTRA_A2A <-->|Mastra A2A Protocol| WS_MASTRA_A2A
    
    DP_MASTRA_AGENT --> BEDROCK
    SM_MASTRA_AGENT --> BEDROCK
    GW_MASTRA_AGENT --> BEDROCK
    WS_MASTRA_AGENT --> BEDROCK
    WS_MCP_INTEGRATION --> MCP
    MCP --> BRAVE
    
    GW_MASTRA_AGENT -.->|Traces| LANGFUSE
    DP_MASTRA_AGENT -.->|Traces| LANGFUSE
    SM_MASTRA_AGENT -.->|Traces| LANGFUSE
    WS_MASTRA_AGENT -.->|Traces| LANGFUSE
    
    style GW_MASTRA_DEV fill:#e8f5e8
    style DP_MASTRA_DEV fill:#e8f5e8
    style SM_MASTRA_DEV fill:#e8f5e8
    style WS_MASTRA_DEV fill:#e8f5e8
    style GW_MASTRA_STORAGE fill:#fff3e0
    style DP_MASTRA_STORAGE fill:#fff3e0
    style SM_MASTRA_STORAGE fill:#fff3e0
    style WS_MASTRA_STORAGE fill:#fff3e0
```

**Architecture Features:**
- **Unified Implementation**: All agents use Mastra Dev Server with native A2A protocol
- **Consistent Communication**: Standard Mastra A2A protocol across all agent interactions
- **Native Integration**: Built-in Hono server and LibSQL storage for each agent
- **MCP Support**: Web Search agent integrates MCP protocol for external tool access

### Simplified System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js Frontend<br/>Port: 3000]
    end
    
    subgraph "Agent Layer - All Mastra Dev Server"
        GW[Gateway Agent<br/>Mastra Dev Server<br/>Port: 3001]
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
    GW <-->|Mastra A2A Protocol| DP
    GW <-->|Mastra A2A Protocol| SM
    GW <-->|Mastra A2A Protocol| WS
    
    DP --> BEDROCK
    SM --> BEDROCK
    GW --> BEDROCK
    WS --> BEDROCK
    WS --> MCP
    MCP --> BRAVE
    
    GW -.->|Traces| LANGFUSE
    DP -.->|Traces| LANGFUSE
    SM -.->|Traces| LANGFUSE
    WS -.->|Traces| LANGFUSE
    
    style UI fill:#e1f5fe
    style GW fill:#e8f5e8
    style DP fill:#e8f5e8
    style SM fill:#e8f5e8
    style WS fill:#e8f5e8
```

## 🚀 Features

- **Unified A2A Communication**: Standardized Mastra A2A protocol for all inter-agent messaging
- **Native Mastra Architecture**: All agents use Mastra Dev Server with built-in Hono server
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

### 3. Configure your `.env` file:
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

1. **Data Processing** (`/api/a2a/agents` - type: process)
   - Analyzes and transforms data
   - Extracts patterns and insights

2. **Summarization** (`/api/a2a/agents` - type: summarize)
   - Creates concise summaries
   - Supports different audience types (technical, executive, general)

3. **Analysis Workflow** (`/api/a2a/agents` - type: analyze)
   - Combines data processing and summarization
   - End-to-end data analysis pipeline

4. **Web Search** (`/api/a2a/agents` - type: web-search)
   - Real-time web information retrieval
   - News and scholarly article search

5. **Deep Research** (`/api/a2a/agents` - type: deep-research)
   - Multi-step research workflow using asynchronous task processing
   - Combines web search, data processing, and summarization
   - Long-running tasks with progress tracking and status polling

### API Examples

```bash
# Analyze data with full workflow
curl -X POST http://localhost:3001/api/a2a/agents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "analyze",
    "data": "Your data here",
    "options": {
      "audienceType": "executive"
    }
  }'

# Deep Research (Asynchronous)
curl -X POST http://localhost:3001/api/a2a/agents \
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
  "pollUrl": "/api/a2a/task/research-task-abc-123",
  "steps": {
    "total": 5,
    "current": 1,
    "phases": ["search", "analyze", "synthesize", "validate", "report"]
  }
}

# Poll for status
curl http://localhost:3001/api/a2a/task/research-task-abc-123
```

## 🔄 Communication Flows

### Agent Discovery Protocol

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
    
    Frontend->>FrontendAPI: GET /api/a2a/agents
    activate FrontendAPI
    
    FrontendAPI->>Gateway: GET /api/a2a/agents<br/>http://gateway:3001
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
    
    Gateway->>WebSearch: HTTP GET /api/a2a/agent<br/>Port: 3004
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

#### Agent Discovery Error Handling

```mermaid
sequenceDiagram
    participant Gateway
    participant MastraAgent
    participant ExpressAgent
    
    Note over Gateway,ExpressAgent: Fallback Discovery Mechanism
    
    Gateway->>MastraAgent: Mastra A2A.getCard()<br/>agentId: "data-processor-agent-01"
    MastraAgent-->>Gateway: Connection Error
    
    Gateway->>MastraAgent: HTTP Fallback<br/>GET /api/a2a/agent
    alt Agent Responds
        MastraAgent-->>Gateway: Agent Card Data
    else Agent Unavailable
        Gateway->>Gateway: Mark as "offline"<br/>Use cached agent info
    end
    
    Gateway->>ExpressAgent: HTTP GET /api/a2a/agent
    alt Agent Responds
        ExpressAgent-->>Gateway: Agent Card Data
    else Network Error
        Gateway->>Gateway: Mark as "unknown"<br/>Skip from discovery
    end
    
    Note over Gateway: Return Available Agents Only
```

### A2A Protocol

The system implements unified Mastra A2A protocol across all agents:

**For All Mastra Dev Server Agents (Gateway, Data Processor, Summarizer, Web Search):**
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
    
    Client->>Gateway: POST /api/a2a/agents<br/>{type: "analyze", data: {...}}
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

### Web Search Flow with MCP Protocol Details

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant WebSearch
    participant MCPServer
    participant BraveAPI
    
    Note over Gateway,WebSearch: Agent Card Exchange
    
    Gateway->>WebSearch: GET /api/a2a/agent
    WebSearch-->>Gateway: {<br/>  agentId: "web-search-agent-01",<br/>  name: "Web Search Agent",<br/>  capabilities: ["web-search", "news-search"],<br/>  mcpEnabled: true,<br/>  protocols: ["a2a/v1", "mcp/v1"]<br/>}
    
    Note over Client,BraveAPI: Search Request Flow
    
    Client->>Gateway: POST /api/a2a/agents<br/>{type: "web-search", query: "AI trends 2024"}
    activate Gateway
    
    Gateway->>WebSearch: POST /api/a2a/message<br/>{<br/>  type: "search",<br/>  query: "AI trends 2024",<br/>  options: {limit: 10},<br/>  metadata: {requestId: "req-789"}<br/>}
    activate WebSearch
    
    Note over WebSearch,MCPServer: MCP Communication
    
    WebSearch->>MCPServer: POST /mcp/execute<br/>{<br/>  tool: "brave_web_search",<br/>  arguments: {<br/>    query: "AI trends 2024",<br/>    count: 10<br/>  }<br/>}
    activate MCPServer
    
    MCPServer->>BraveAPI: GET /web/search<br/>Headers: {<br/>  "X-Subscription-Token": "api-key",<br/>  "Accept": "application/json"<br/>}<br/>Query: q=AI+trends+2024&count=10
    
    BraveAPI-->>MCPServer: {<br/>  web: {<br/>    results: [<br/>      {title: "...", url: "...", snippet: "..."},<br/>      ...<br/>    ]<br/>  }<br/>}
    
    MCPServer->>MCPServer: Format Results<br/>Extract Relevant Data
    
    MCPServer-->>WebSearch: {<br/>  success: true,<br/>  results: [formatted_results],<br/>  metadata: {<br/>    source: "brave",<br/>    resultCount: 10<br/>  }<br/>}
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
    
    Client->>Gateway: POST /api/a2a/agents<br/>{<br/>  type: "deep-research",<br/>  topic: "AI in healthcare 2024",<br/>  options: {depth: "comprehensive"}<br/>}
    activate Gateway
    
    Gateway->>Gateway: Generate Research Plan<br/>taskId: "research-abc-123"<br/>phases: [search, analyze, synthesize]
    
    Gateway-->>Client: {<br/>  taskId: "research-abc-123",<br/>  status: "initiated",<br/>  phases: ["search", "analyze", "synthesize"],<br/>  pollUrl: "/api/a2a/task/research-abc-123"<br/>}
    
    Note over Gateway,Summarizer: Phase 2: Initial Web Search (Async)
    
    Gateway->>WebSearch: POST /api/a2a/task<br/>{<br/>  taskId: "search-sub-task-1",<br/>  type: "comprehensive-search",<br/>  query: "AI healthcare trends 2024",<br/>  options: {sources: ["web", "news"]}<br/>}
    activate WebSearch
    
    WebSearch-->>Gateway: {<br/>  taskId: "search-sub-task-1",<br/>  status: "accepted",<br/>  estimatedTime: "2-3 minutes"<br/>}
    
    Note over Client,WebSearch: Client Polling During Search Phase
    
    Client->>Gateway: GET /api/a2a/task/research-abc-123
    Gateway->>WebSearch: GET /api/a2a/task/search-sub-task-1
    WebSearch-->>Gateway: {status: "working", progress: 30, phase: "web-search"}
    Gateway-->>Client: {<br/>  status: "working",<br/>  currentPhase: "search",<br/>  progress: 30,<br/>  details: "Searching web sources..."<br/>}
    
    WebSearch->>WebSearch: Execute Multiple Searches<br/>- General AI healthcare<br/>- Recent developments<br/>- Market analysis
    
    WebSearch-->>Gateway: {<br/>  taskId: "search-sub-task-1",<br/>  status: "completed",<br/>  result: {<br/>    sources: 50,<br/>    articles: [...],<br/>    keyThemes: [...]<br/>  }<br/>}
    deactivate WebSearch
    
    Note over Gateway,Summarizer: Phase 3: Data Analysis (Async)
    
    Gateway->>DataProcessor: A2A.createTask({<br/>  agentId: "data-processor-agent-01",<br/>  taskType: "research-analysis",<br/>  payload: {<br/>    data: {searchResults},<br/>    options: {analyzePatterns: true}<br/>  }<br/>})<br/>Port: 3002
    activate DataProcessor
    
    DataProcessor-->>Gateway: {<br/>  taskId: "analyze-sub-task-2",<br/>  status: "accepted",<br/>  estimatedTime: "3-4 minutes"<br/>}
    
    Client->>Gateway: GET /api/a2a/task/research-abc-123
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
    
    Client->>Gateway: GET /api/a2a/task/research-abc-123
    Gateway->>Summarizer: A2A.streamTaskUpdates("synthesis-sub-task-3")
    Summarizer-->>Gateway: {status: "working", progress: 85, phase: "synthesis"}
    Gateway-->>Client: {<br/>  status: "working",<br/>  currentPhase: "synthesize",<br/>  progress: 85,<br/>  details: "Generating comprehensive report..."<br/>}
    
    Summarizer->>Summarizer: Generate Research Report<br/>- Executive summary<br/>- Key findings<br/>- Trend analysis<br/>- Recommendations<br/>- Source citations
    
    Summarizer-->>Gateway: {<br/>  taskId: "synthesis-sub-task-3",<br/>  status: "completed",<br/>  result: {<br/>    executiveSummary: "...",<br/>    keyFindings: [...],<br/>    recommendations: [...],<br/>    fullReport: "...",<br/>    sources: [...]<br/>  }<br/>}
    deactivate Summarizer
    
    Gateway->>Gateway: Compile Final Results<br/>- Aggregate all findings<br/>- Create research timeline<br/>- Generate metadata
    
    Note over Client,Summarizer: Phase 5: Research Completion
    
    Client->>Gateway: GET /api/a2a/task/research-abc-123
    Gateway-->>Client: {<br/>  taskId: "research-abc-123",<br/>  status: "completed",<br/>  totalDuration: "8 minutes 23 seconds",<br/>  result: {<br/>    executiveSummary: "...",<br/>    detailedFindings: {...},<br/>    sourcesAnalyzed: 50,<br/>    trendsIdentified: 12,<br/>    recommendations: [...],<br/>    confidence: 0.92,<br/>    methodology: "multi-agent-research"<br/>  },<br/>  metadata: {<br/>    phases: ["search", "analyze", "synthesize"],<br/>    agentsUsed: ["web-search", "data-processor", "summarizer"],<br/>    processingTime: {<br/>      search: "2m 15s",<br/>      analysis: "3m 42s",<br/>      synthesis: "2m 26s"<br/>    }<br/>  }<br/>}
    deactivate Gateway
```

### Asynchronous Task Processing Flow

#### For Mastra Dev Server Agents (Data Processor & Summarizer)

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant MastraAgent
    
    Note over Client,MastraAgent: Mastra A2A Task Processing
    
    Client->>Gateway: POST /api/a2a/task<br/>{<br/>  type: "long-running-analysis",<br/>  data: {large_dataset}<br/>}
    activate Gateway
    
    Gateway->>Gateway: Generate taskId: "task-abc-123"
    
    Gateway->>MastraAgent: A2A.createTask({<br/>  agentId: "data-processor-agent-01",<br/>  taskType: "analysis",<br/>  payload: {data: {large_dataset}}<br/>})<br/>Port: 3002/3003
    activate MastraAgent
    
    MastraAgent-->>Gateway: {<br/>  taskId: "task-abc-123",<br/>  status: "accepted",<br/>  estimatedTime: "5 minutes"<br/>}
    
    Gateway-->>Client: {<br/>  taskId: "task-abc-123",<br/>  status: "working",<br/>  pollUrl: "/api/a2a/task/task-abc-123"<br/>}
    deactivate Gateway
    
    Note over Client,MastraAgent: Status Polling with Streaming
    
    Client->>Gateway: GET /api/a2a/task/task-abc-123
    Gateway->>MastraAgent: A2A.streamTaskUpdates("task-abc-123")
    MastraAgent-->>Gateway: {status: "working", progress: 45}
    Gateway-->>Client: {status: "working", progress: 45}
    
    MastraAgent->>MastraAgent: Complete Processing
    deactivate MastraAgent
    
    Client->>Gateway: GET /api/a2a/task/task-abc-123
    Gateway->>MastraAgent: A2A.streamTaskUpdates("task-abc-123")
    MastraAgent-->>Gateway: {<br/>  status: "completed",<br/>  result: {analysis_results}<br/>}
    Gateway-->>Client: {<br/>  status: "completed",<br/>  result: {analysis_results}<br/>}
```

#### For Express Server Agents (Gateway & Web Search)

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant ExpressAgent
    
    Note over Client,ExpressAgent: Express A2A Task Processing
    
    Client->>Gateway: POST /api/a2a/task<br/>{<br/>  type: "web-search-task",<br/>  query: "search query"<br/>}
    activate Gateway
    
    Gateway->>Gateway: Generate taskId: "task-xyz-456"
    
    Gateway->>ExpressAgent: POST /api/a2a/task<br/>{<br/>  taskId: "task-xyz-456",<br/>  type: "search",<br/>  query: "search query"<br/>}<br/>Port: 3004
    activate ExpressAgent
    
    ExpressAgent-->>Gateway: {<br/>  taskId: "task-xyz-456",<br/>  status: "accepted",<br/>  estimatedTime: "3 minutes"<br/>}
    
    Gateway-->>Client: {<br/>  taskId: "task-xyz-456",<br/>  status: "working",<br/>  pollUrl: "/api/a2a/task/task-xyz-456"<br/>}
    deactivate Gateway
    
    Note over Client,ExpressAgent: Status Polling via HTTP
    
    Client->>Gateway: GET /api/a2a/task/task-xyz-456
    Gateway->>ExpressAgent: GET /api/a2a/task/task-xyz-456
    ExpressAgent-->>Gateway: {status: "working", progress: 60}
    Gateway-->>Client: {status: "working", progress: 60}
    
    ExpressAgent->>ExpressAgent: Complete Processing
    deactivate ExpressAgent
    
    Client->>Gateway: GET /api/a2a/task/task-xyz-456
    Gateway->>ExpressAgent: GET /api/a2a/task/task-xyz-456
    ExpressAgent-->>Gateway: {<br/>  status: "completed",<br/>  result: {search_results}<br/>}
    Gateway-->>Client: {<br/>  status: "completed",<br/>  result: {search_results}<br/>}
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

All agent services are now implemented with unified Mastra architecture:

**All Agents (Gateway, Data Processor, Summarizer, Web Search):**
- **Mastra Dev Server**: Hono-based native server (started with `mastra dev`)
- **Native A2A Protocol**: Mastra standard A2A communication protocol
- **In-Memory Storage**: In-memory storage via LibSQL
- **Docker Container**: Isolated deployment of each service

### Local Development

Each agent can be developed independently using Mastra Dev Server:

```bash
# Gateway Agent (Mastra Dev Server)
cd agents/gateway
npm install
npm run start    # mastra dev

# Data Processor (Mastra Dev Server)
cd agents/data-processor
npm install
npm run start    # mastra dev

# Summarizer Agent (Mastra Dev Server)
cd agents/summarizer
npm install
npm run start    # mastra dev

# Web Search Agent (Mastra Dev Server)
cd agents/web-search
npm install
npm run start    # mastra dev
```

### Architecture Benefits

With the migration to full Mastra architecture:

**Achieved Benefits:**
- **Unified A2A Protocol**: All agents use the same native A2A communication
- **Consistent Development Experience**: All agents use `mastra dev` command
- **Built-in Features**: Native Hono server, LibSQL storage, and A2A protocol
- **Simplified Deployment**: Consistent Docker container setup across all agents

**Future Enhancement Options:**
- **Production Storage**: Migrate from in-memory LibSQL to production-ready backends (PostgreSQL, Redis)
- **Horizontal Scaling**: Implement multi-instance agent deployment
- **Custom API Routes**: Add additional HTTP endpoints via Mastra `registerApiRoute`

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