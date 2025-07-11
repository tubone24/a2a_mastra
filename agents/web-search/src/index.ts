import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { MCPClient } from '@mastra/mcp';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { Langfuse } from 'langfuse';
// Remove the import since we'll define types inline
// import { TaskRequest, TaskResponse, SearchOptions, SearchResult } from './types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3004;
const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Web Search Agent';

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

console.log('Langfuse client initialized:', {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ? 'SET' : 'NOT SET',
  secretKey: process.env.LANGFUSE_SECRET_KEY ? 'SET' : 'NOT SET',
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
});

// Initialize variables for MCP and agent
let mcpClient: MCPClient;
let mcpTools: any = {};
let webSearchAgent: Agent;
let mastra: Mastra;


// Initialize MCP Client to connect to the standalone MCP server
async function initializeMCPClient() {
  try {
    mcpClient = new MCPClient({
      servers: {
        'brave-search': {
          command: 'node',
          args: ['/app/standalone-mcp-server/dist/server.js'],
          env: {
            BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY || '',
          },
          timeout: 30000,
        },
      },
    });

    console.log('MCP Client initialized, getting tools...');

    // Get available tools from MCP server
    const tools = await mcpClient.getTools();
    console.log('Available MCP tools:', Object.keys(tools));
    
    // Debug: Show tool details
    for (const [toolName, tool] of Object.entries(tools)) {
      console.log(`Tool: ${toolName}`, { 
        description: (tool as any).description,
        inputSchema: (tool as any).inputSchema 
      });
    }

    return tools;
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    throw error;
  }
}

// Initialize everything
async function initialize() {
  try {
    // Initialize MCP Client and get tools
    mcpTools = await initializeMCPClient();
    
    console.log('Search tools loaded:', Object.keys(mcpTools));

    // Create Web Search Agent with MCP tools
    webSearchAgent = new Agent({
      name: AGENT_NAME,
      instructions: `
        あなたはWeb検索を専門とするエージェントです。Brave Search APIを通じてリアルタイムの情報検索と分析を提供します。
        あなたの役割は以下の通りです：
        1. A2Aプロトコル経由で他のエージェントから検索リクエストを受信する
        2. MCPプロトコルを使用してBrave Search APIにアクセスし、適切な検索クエリを実行する
        3. 検索結果を分析し、関連性の高い情報を抽出する
        4. 検索結果を要約し、構造化されたデータとして返す
        5. 最新の情報、ニュース、学術論文などの検索に特化する
        
        利用可能なツール：
        - brave_web_search: 一般的なWeb検索
        - brave_news_search: ニュース記事検索
        
        検索結果は常に信頼性、関連性、時系列を考慮して提供してください。
        すべての応答は日本語で行ってください。
      `,
      model: getBedrockModel(),
      tools: mcpTools,
    });

    // Initialize Mastra with agent
    mastra = new Mastra({
      agents: { webSearchAgent },
    });

    console.log('Mastra initialized successfully with web search agent and MCP tools');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Task schema for web search
const searchTaskSchema = z.object({
  type: z.enum(['web-search', 'news-search', 'scholarly-search', 'comprehensive-search']),
  query: z.string(),
  context: z.record(z.any()).optional(),
  options: z.object({
    maxResults: z.number().optional().default(10),
    language: z.string().optional().default('en'),
    region: z.string().optional().default('us'),
    timeRange: z.enum(['day', 'week', 'month', 'year', 'all']).optional().default('all'),
    category: z.enum(['general', 'news', 'images', 'videos', 'scholarly']).optional().default('general'),
    safesearch: z.enum(['strict', 'moderate', 'off']).optional().default('moderate'),
    sources: z.array(z.enum(['web', 'news', 'academic', 'reports'])).optional().default(['web']),
  }).optional(),
});

// Task storage (in production, this would be a database)
const tasks = new Map();

// Helper function to process search tasks
async function processSearchTask(task: any, taskId: string, parentTraceId?: string) {
  // Create Langfuse trace for this search task
  const trace = langfuse.trace({
    id: parentTraceId || undefined,
    name: 'web-search-task',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      taskId: taskId,
      taskType: task?.type || 'unknown',
    },
    tags: ['web-search', 'search-task'],
  });

  let validatedTask;
  try {
    validatedTask = searchTaskSchema.parse(task);
  } catch (error) {
    console.error('Task validation failed:', error);
    console.error('Received task:', JSON.stringify(task, null, 2));
    throw new Error(`Invalid task format: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
  }
  
  // Log task validation
  trace.event({
    name: 'task-validated',
    metadata: {
      type: validatedTask.type,
      query: validatedTask.query,
      hasContext: !!validatedTask.context,
      maxResults: validatedTask.options?.maxResults || 10,
    },
  });
  
  let searchResult;
  
  try {
    // Determine search strategy based on task type
    let enhancedQuery = validatedTask.query;
    const originalOptions = validatedTask.options || {};
    let searchOptions: any = { ...originalOptions };
    
    switch (validatedTask.type) {
      case 'news-search':
        enhancedQuery = `latest news ${validatedTask.query}`;
        searchOptions = {
          ...searchOptions,
          timeRange: 'week',
          category: 'news',
        };
        break;
        
      case 'scholarly-search':
        enhancedQuery = `academic research ${validatedTask.query}`;
        searchOptions = {
          ...searchOptions,
          category: 'scholarly',
        };
        break;
        
      case 'comprehensive-search':
        // For comprehensive search, we'll perform multiple searches
        // with different strategies and combine results
        enhancedQuery = validatedTask.query;
        const currentMaxResults = searchOptions.maxResults || 10;
        searchOptions = {
          ...searchOptions,
          maxResults: Math.max(currentMaxResults, 15),
        };
        break;
        
      default: // web-search
        // Keep original query for general web search
        break;
    }

    // Perform web search with Langfuse tracing
    console.log('Performing web search with query:', enhancedQuery);
    
    const generation = trace.generation({
      name: 'web-search-execution',
      model: 'web-search-api',
      input: {
        query: enhancedQuery,
        options: searchOptions,
      },
      metadata: {
        searchType: validatedTask.type,
        queryLength: enhancedQuery.length,
      },
    });
    
    try {
      // Use Mastra Agent with MCP tools to perform search
      console.log('Using Agent with MCP tools for search...');
      
      // Create search prompt for the agent - use the correct tool names from standalone MCP server
      const toolName = validatedTask.type === 'news-search' ? 'brave-search_brave_news_search' : 'brave-search_brave_web_search';
      
      const searchParams = {
        query: enhancedQuery,
        count: Math.min((searchOptions as any)?.maxResults || 10, 20)
      };

      console.log('Search parameters for tool:', searchParams);
      console.log('Tool name to be used:', toolName);

      const searchPrompt = `
        検索クエリ「${enhancedQuery}」について${validatedTask.type === 'news-search' ? 'ニュース検索' : 'Web検索'}を実行してください。

        必ず「${toolName}」ツールを使用して以下のパラメータで検索を実行してください：
        
        ツール名: ${toolName}
        パラメータ:
        {
          "query": "${enhancedQuery}",
          "count": ${searchParams.count}
        }

        重要: 必ずツールを呼び出してください。ツールを使用せずに想像で回答しないでください。

        ツール実行後、結果を基に以下を日本語で提供してください：
        1. 検索結果の要約（3-5文）
        2. 最も関連性の高い情報のハイライト
        3. 信頼性の評価
        4. 追加の検索が必要な場合の提案
      `;

      generation.end({
        input: searchPrompt,
        metadata: {
          searchType: validatedTask.type,
          queryLength: enhancedQuery.length,
        },
      });

      // Use agent to perform search and analysis
      console.log('Sending prompt to agent:', searchPrompt);
      console.log('Available tools:', Object.keys(mcpTools));
      console.log('Expected tool name:', toolName);
      console.log('Enhanced query:', enhancedQuery);
      console.log('Search options:', searchOptions);
      
      const result = await webSearchAgent.generate([
        { 
          role: "user", 
          content: searchPrompt
        }
      ]);

      console.log('Agent result:', result);
      console.log('Agent response text:', result.text);

      searchResult = {
        status: 'completed',
        processedBy: AGENT_ID,
        result: {
          query: enhancedQuery,
          summary: result.text,
          fullResponse: result,
        },
        metadata: {
          completedAt: new Date().toISOString(),
          searchType: validatedTask.type,
          traceId: trace.id,
          searchProvider: 'Brave Search (via MCP + Agent)',
          usage: result.usage || {},
        },
      };

      // Log successful completion
      trace.event({
        name: 'search-completed',
        metadata: {
          success: true,
          responseLength: result.text.length,
          usage: result.usage || {},
        },
      });

    } catch (error) {
      trace.event({
        name: 'search-failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        },
      });
      
      throw error;
    }

  } catch (error) {
    searchResult = {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      processedBy: AGENT_ID,
      metadata: {
        completedAt: new Date().toISOString(),
        searchType: validatedTask.type,
        traceId: trace.id,
      },
    };
  }
  
  // Store task result
  tasks.set(taskId, {
    id: taskId,
    status: { 
      state: searchResult.status === 'completed' ? 'completed' : 'failed', 
      message: searchResult.status === 'completed' ? 'Search completed successfully' : (searchResult.error || 'Search failed') 
    },
    result: searchResult,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
  
  return searchResult;
}

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const taskId = req.body.id || crypto.randomUUID();
    
    // Extract task data from A2A request format
    const taskData = req.body.data || req.body;
    
    // Store initial task state
    tasks.set(taskId, {
      id: taskId,
      status: { state: 'working', message: 'Processing search task...' },
      result: null,
      createdAt: new Date().toISOString(),
    });
    
    // Process task asynchronously
    processSearchTask(taskData, taskId)
      .then(result => {
        console.log(`${AGENT_NAME} completed search task`);
      })
      .catch(error => {
        console.error(`${AGENT_NAME} task processing error:`, error);
        tasks.set(taskId, {
          id: taskId,
          status: { state: 'failed', message: error.message },
          result: null,
          createdAt: tasks.get(taskId)?.createdAt || new Date().toISOString(),
          failedAt: new Date().toISOString(),
        });
      });
    
    // Return task immediately with working status
    res.json({
      id: taskId,
      status: { state: 'working', message: 'Search task is being processed...' },
      createdAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error(`${AGENT_NAME} task creation error:`, error);
    const taskId = req.body.id || crypto.randomUUID();
    res.status(500).json({
      id: taskId,
      status: { state: 'failed', message: error instanceof Error ? error.message : 'Unknown error' },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// A2A Get Task endpoint
app.get('/api/a2a/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  const task = tasks.get(taskId);
  if (!task) {
    return res.status(404).json({
      error: 'Task not found',
      taskId
    });
  }
  
  res.json(task);
});

// A2A Cancel Task endpoint
app.delete('/api/a2a/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  const task = tasks.get(taskId);
  if (!task) {
    return res.status(404).json({
      error: 'Task not found',
      taskId
    });
  }
  
  if (task.status.state === 'working') {
    task.status = { state: 'cancelled', message: 'Task cancelled by request' };
    task.cancelledAt = new Date().toISOString();
    tasks.set(taskId, task);
  }
  
  res.json(task);
});

// A2A Message endpoint for receiving messages from other agents
app.post('/api/a2a/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { id, from, message, timestamp } = req.body;
    
    // Parse the task from the message content
    let taskData;
    try {
      taskData = JSON.parse(message.parts[0].text);
    } catch {
      taskData = { type: 'web-search', query: message.parts[0].text };
    }
    
    // Create a task for this message
    const taskId = crypto.randomUUID();
    
    // Process the task asynchronously
    let result;
    try {
      result = await processSearchTask(taskData, taskId);
    } catch (error) {
      result = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processedBy: AGENT_ID,
      };
    }
    
    // Return A2A compliant response with task
    const taskState = result.status === 'completed' ? 'completed' : 'failed';
    const taskMessage = result.status === 'completed' ? 'Search completed successfully' : (result as any).error || 'Search failed';
    
    res.json({
      id: crypto.randomUUID(),
      from: AGENT_ID,
      to: from,
      message: {
        role: "assistant",
        parts: [{
          type: "text",
          text: JSON.stringify(result)
        }]
      },
      task: {
        id: taskId,
        status: {
          state: taskState,
          message: taskMessage
        },
        result: result
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error(`${AGENT_NAME} message processing error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      from: AGENT_ID,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID,
    capabilities: ['web-search', 'news-search', 'scholarly-search', 'real-time-information']
  });
});

// A2A Protocol Endpoints

// Agent Card endpoint (A2A discovery)
app.get('/api/a2a/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'web-search',
    description: 'Web検索エージェント - リアルタイムの情報検索と分析を専門とします',
    capabilities: ['web-search', 'news-search', 'scholarly-search', 'real-time-information', 'search-analysis'],
    endpoint: `http://web-search:${PORT}`,
    status: 'online',
    version: '1.0.0',
    supportedProtocols: ['A2A'],
    supportedTaskTypes: ['web-search', 'news-search', 'scholarly-search', 'comprehensive-search'],
    supportedSearchOptions: ['maxResults', 'timeRange', 'language', 'region', 'category', 'safesearch'],
    supportedMessageTypes: ['text/plain', 'application/json'],
  });
});

// Legacy agent info endpoint for backward compatibility
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'web-search',
    capabilities: ['web-search', 'news-search', 'scholarly-search', 'real-time-information'],
    endpoint: `http://web-search:${PORT}`,
    status: 'online',
    supportedTaskTypes: ['webSearch', 'newsSearch', 'scholarlySearch'],
  });
});

// Task History API Endpoints

// Get all tasks processed by this agent
app.get('/api/tasks', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const type = req.query.type as string;
  
  let taskList = Array.from(tasks.values());
  
  // Apply filters
  if (status) {
    taskList = taskList.filter(t => t.status.state === status);
  }
  if (type && taskList.length > 0) {
    taskList = taskList.filter(t => {
      const taskType = t.result?.metadata?.searchType;
      return taskType === type;
    });
  }
  
  // Sort by most recent first
  taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedTasks = taskList.slice(startIndex, endIndex);
  
  res.json({
    tasks: paginatedTasks,
    pagination: {
      page,
      limit,
      total: taskList.length,
      totalPages: Math.ceil(taskList.length / limit),
      hasNext: endIndex < taskList.length,
      hasPrev: page > 1,
    },
    statistics: {
      total: taskList.length,
      completed: taskList.filter(t => t.status.state === 'completed').length,
      failed: taskList.filter(t => t.status.state === 'failed').length,
      working: taskList.filter(t => t.status.state === 'working').length,
      byType: {
        'web-search': taskList.filter(t => t.result?.metadata?.searchType === 'web-search').length,
        'news-search': taskList.filter(t => t.result?.metadata?.searchType === 'news-search').length,
        'scholarly-search': taskList.filter(t => t.result?.metadata?.searchType === 'scholarly-search').length,
      },
    },
  });
});

// Get specific task details
app.get('/api/tasks/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  const task = tasks.get(taskId);
  if (!task) {
    return res.status(404).json({
      error: 'Task not found',
      taskId
    });
  }
  
  res.json(task);
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await langfuse.shutdownAsync();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await langfuse.shutdownAsync();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize MCP client and agent
    await initialize();
    
    app.listen(PORT, () => {
      console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
      console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
      console.log(`Langfuse tracing enabled`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();