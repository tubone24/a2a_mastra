# A2A Mastra Demo - Multi-Agent System with Amazon Bedrock

A demonstration of Agent-to-Agent (A2A) communication protocol using the Mastra framework, featuring multiple specialized AI agents powered by Amazon Bedrock. This project showcases how autonomous agents can communicate, collaborate, and delegate tasks to achieve complex goals.

## 🏗️ Architecture Overview

The system consists of four specialized agents that communicate via the A2A protocol:

1. **Gateway Agent** - Request router and workflow orchestrator
2. **Data Processor Agent** - Data analysis and transformation
3. **Summarizer Agent** - Content summarization and insight extraction
4. **Web Search Agent** - Real-time web information retrieval

### System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js Frontend<br/>Port: 3000]
    end
    
    subgraph "Agent Layer"
        GW[Gateway Agent<br/>Port: 3001]
        DP[Data Processor<br/>Port: 3002]
        SM[Summarizer<br/>Port: 3003]
        WS[Web Search<br/>Port: 3004]
    end
    
    subgraph "External Services"
        BEDROCK[Amazon Bedrock<br/>Claude 3.5 Sonnet]
        LANGFUSE[Langfuse<br/>Tracing]
        BRAVE[Brave Search API]
    end
    
    UI -->|HTTP/REST| GW
    GW -->|A2A Protocol| DP
    GW -->|A2A Protocol| SM
    GW -->|A2A Protocol| WS
    
    DP --> BEDROCK
    SM --> BEDROCK
    WS --> BEDROCK
    WS --> BRAVE
    
    GW -.->|Traces| LANGFUSE
    DP -.->|Traces| LANGFUSE
    SM -.->|Traces| LANGFUSE
    WS -.->|Traces| LANGFUSE
    
    style UI fill:#e1f5fe
    style GW fill:#fff3e0
    style DP fill:#f3e5f5
    style SM fill:#e8f5e9
    style WS fill:#fce4ec
```

## 🚀 Features

- **Agent-to-Agent Communication**: Standardized A2A protocol for inter-agent messaging
- **Workflow Orchestration**: Complex multi-step workflows with automatic task delegation
- **Real-time Visualization**: Live visualization of agent communication flows
- **Tracing & Observability**: Comprehensive tracing with Langfuse integration
- **MCP Integration**: Model Context Protocol support for web search capabilities
- **Japanese Language Support**: All agents respond in Japanese

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- AWS Account with Bedrock access
- Langfuse account (optional, for tracing)
- Brave Search API key (optional, for web search)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/your-repo/a2a-mastra-demo.git
cd a2a-mastra-demo
```

2. Copy the environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
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

4. Build and start the services:
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

### API Example

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
```

## 🔄 Communication Flows

### A2A Protocol

The system implements a standardized A2A protocol with three main endpoints:

1. **Message Endpoint** (`/api/a2a/message`) - Synchronous message exchange
2. **Task Endpoint** (`/api/a2a/task`) - Asynchronous task processing
3. **Agent Discovery** (`/api/a2a/agent`) - Agent capability discovery

### Workflow Sequence with Agent Discovery

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant DataProcessor
    participant Summarizer
    
    Note over Gateway,Summarizer: Agent Discovery Phase
    
    Gateway->>DataProcessor: GET /api/a2a/agent
    DataProcessor-->>Gateway: {agentId, name, capabilities,<br/>supportedTypes: ["process", "analyze"]}
    
    Gateway->>Summarizer: GET /api/a2a/agent
    Summarizer-->>Gateway: {agentId, name, capabilities,<br/>supportedTypes: ["summarize", "executive-summary"]}
    
    Note over Client,Summarizer: Workflow Execution Phase
    
    Client->>Gateway: POST /api/a2a/agents<br/>{type: "analyze", data: {...}}
    activate Gateway
    
    Gateway->>Gateway: Create Workflow Execution<br/>Generate traceId & workflowId
    
    Gateway->>DataProcessor: POST /api/a2a/message<br/>{<br/>  type: "process",<br/>  data: {...},<br/>  metadata: {<br/>    workflowId: "wf-123",<br/>    traceId: "trace-456",<br/>    step: 1<br/>  }<br/>}
    activate DataProcessor
    
    DataProcessor->>DataProcessor: Process with Bedrock<br/>Track with Langfuse
    DataProcessor-->>Gateway: {<br/>  status: "success",<br/>  data: {processed_data, insights},<br/>  metadata: {processingTime: 1200ms}<br/>}
    deactivate DataProcessor
    
    Gateway->>Summarizer: POST /api/a2a/message<br/>{<br/>  type: "summarize",<br/>  data: processed_data,<br/>  options: {audienceType: "executive"},<br/>  metadata: {<br/>    workflowId: "wf-123",<br/>    traceId: "trace-456",<br/>    step: 2<br/>  }<br/>}
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

### Asynchronous Task Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Agent
    
    Note over Client,Agent: Asynchronous Task Submission
    
    Client->>Gateway: POST /api/a2a/task<br/>{<br/>  type: "long-running-analysis",<br/>  data: {large_dataset}<br/>}
    activate Gateway
    
    Gateway->>Gateway: Generate taskId: "task-abc-123"
    
    Gateway->>Agent: POST /api/a2a/task<br/>{<br/>  taskId: "task-abc-123",<br/>  type: "analysis",<br/>  data: {large_dataset}<br/>}
    activate Agent
    
    Agent-->>Gateway: {<br/>  taskId: "task-abc-123",<br/>  status: "accepted",<br/>  estimatedTime: "5 minutes"<br/>}
    
    Gateway-->>Client: {<br/>  taskId: "task-abc-123",<br/>  status: "working",<br/>  pollUrl: "/api/a2a/task/task-abc-123"<br/>}
    deactivate Gateway
    
    Note over Client,Agent: Status Polling
    
    Client->>Gateway: GET /api/a2a/task/task-abc-123
    Gateway->>Agent: GET /api/a2a/task/task-abc-123
    Agent-->>Gateway: {status: "working", progress: 45}
    Gateway-->>Client: {status: "working", progress: 45}
    
    Agent->>Agent: Complete Processing
    deactivate Agent
    
    Client->>Gateway: GET /api/a2a/task/task-abc-123
    Gateway->>Agent: GET /api/a2a/task/task-abc-123
    Agent-->>Gateway: {<br/>  status: "completed",<br/>  result: {analysis_results}<br/>}
    Gateway-->>Client: {<br/>  status: "completed",<br/>  result: {analysis_results}<br/>}
```

## 🔧 Development

### Project Structure

```
a2a-mastra-demo/
├── agents/                    # Agent services
│   ├── gateway/              # Gateway agent
│   ├── data-processor/       # Data processing agent
│   ├── summarizer/           # Summarization agent
│   └── web-search/          # Web search agent
├── frontend/                 # Next.js frontend
├── shared/                   # Shared types and utilities
└── docker-compose.yml        # Docker composition
```

### Local Development

Each agent can be run independently for development:

```bash
# Gateway Agent
cd agents/gateway
npm install
npm run dev

# Data Processor
cd agents/data-processor
npm install
npm run dev

# Continue for other agents...
```

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

## 🚢 Deployment

The system is containerized and can be deployed to any Docker-compatible platform:

1. **AWS ECS/Fargate**
2. **Google Cloud Run**
3. **Azure Container Instances**
4. **Kubernetes**

Ensure all environment variables are properly configured in your deployment environment.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Mastra](https://mastra.ai) - The agent orchestration framework
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) - AI/ML model hosting
- [Langfuse](https://langfuse.com) - LLM tracing and observability
- [MCP](https://modelcontextprotocol.io/) - Model Context Protocol