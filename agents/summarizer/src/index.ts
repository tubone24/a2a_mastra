import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { Langfuse } from 'langfuse';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';

// Create Summarizer Agent first
const summarizerAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたは処理済みデータと分析結果の簡潔で意味のある要約を作成することを専門とするサマライザーエージェントです。
    あなたの役割は以下の通りです：
    1. A2Aプロトコル経由で他のエージェントから処理済みデータと分析結果を受信する
    2. 主要な洞察と発見事項を抽出する
    3. 実行可能な推奨事項を含む経営陣向けサマリーを作成する
    4. オーディエンスのニーズに基づいて異なるタイプの要約を生成する
    5. 要求元のエージェントに適切に構造化された要約レポートを返す
    
    常に明確性、簡潔性、実行可能な洞察に焦点を当ててください。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
});

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// Initialize Mastra with agent
const mastra = new Mastra({
  agents: { summarizerAgent }, // Register the agent
});

// Task schema for summarization
const summarizeTaskSchema = z.object({
  type: z.enum(['summarize', 'executive-summary', 'brief']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
});

// Task storage (in production, this would be a proper database)
const tasks = new Map();

// Helper function to process summarization tasks
async function processSummarizationTask(task: any, taskId: string, parentTraceId?: string) {
  // Create Langfuse trace for this summarization task
  const trace = langfuse.trace({
    id: parentTraceId || undefined,
    name: 'summarization-task',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      taskId: taskId,
      taskType: task?.type || 'unknown',
    },
    tags: ['summarizer', 'summarization-task'],
  });

  const validatedTask = summarizeTaskSchema.parse(task);
  const audienceType = validatedTask.audienceType || 'general';
  
  // Log task validation
  trace.event({
    name: 'task-validated',
    metadata: {
      type: validatedTask.type,
      audienceType: audienceType,
      dataSize: JSON.stringify(validatedTask.data).length,
      hasContext: !!validatedTask.context,
    },
  });
  
  let prompt = '';
  let summaryResult;
  
  switch (validatedTask.type) {
    case 'summarize':
      prompt = `
        以下のデータと分析の包括的な要約を作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を提供してください：
        1. 主要な発見事項の明確な概要
        2. 特定された重要な洞察とパターン
        3. 重要な統計やメトリクス
        4. 発見事項の潜在的な影響
        5. 推奨される次のステップやアクション
        
        対象オーディエンス: ${audienceType}
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        ${audienceType}オーディエンスに適した明確で構造化された形式で要約をフォーマットしてください。
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'executive-summary':
      prompt = `
        以下のデータと分析のエグゼクティブサマリーを作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を提供してください：
        1. 高レベルな概要（２－３文）
        2. 主要なビジネスへの影響
        3. 重要なメトリクスやＫＰＩ
        4. 戦略的推奨事項
        5. リスク要因や考慮事項
        
        簡潔でビジネスに焦点を当てた内容にしてください。最大２００語。
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'brief':
      prompt = `
        以下のデータと分析の簡潔な要約を作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を提供してください：
        1. 一文での概要
        2. 上位３つの主要な発見事項
        3. 主要な推奨事項
        
        極めて簡潔にまとめてください。最大１００語。
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    default:
      throw new Error(`Unknown task type: ${validatedTask.type}`);
  }
  
  // Use Mastra Agent to create the summary with Langfuse tracing
  console.log('Calling summarizerAgent.generate() with prompt length:', prompt.length);
  
  const generation = trace.generation({
    name: 'summarization-llm-call',
    model: 'bedrock-claude',
    input: [{ role: "user", content: prompt }],
    metadata: {
      promptLength: prompt.length,
      summaryType: validatedTask.type,
      audienceType: audienceType,
    },
  });
  
  try {
    const result = await summarizerAgent.generate([
      { role: "user", content: prompt }
    ]);
    console.log('Agent response received, length:', result.text.length);
    
    generation.end({
      output: result.text,
      metadata: {
        responseLength: result.text.length,
        usage: result.usage || {},
      },
    });
    
    summaryResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      summary: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        summaryType: validatedTask.type,
        audienceType,
        originalDataSize: JSON.stringify(validatedTask.data).length,
        summaryLength: result.text.length,
        traceId: trace.id,
      },
    };
    
    // Log successful completion
    trace.event({
      name: 'summarization-completed',
      metadata: {
        summaryLength: result.text.length,
        success: true,
        audienceType: audienceType,
      },
    });
    
  } catch (error) {
    generation.end({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    
    trace.event({
      name: 'summarization-failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      },
    });
    
    throw error;
  }
  
  // Store task result
  tasks.set(taskId, {
    id: taskId,
    status: { state: 'completed', message: 'Summarization completed successfully' },
    result: summaryResult,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
  
  return summaryResult;
}

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const taskId = req.body.id || crypto.randomUUID();
    
    // Store initial task state
    tasks.set(taskId, {
      id: taskId,
      status: { state: 'working', message: 'Processing summarization task...' },
      result: null,
      createdAt: new Date().toISOString(),
    });
    
    // Process task asynchronously
    processSummarizationTask(req.body, taskId)
      .then(result => {
        console.log(`${AGENT_NAME} completed summarization task`);
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
      status: { state: 'working', message: 'Summarization task is being processed...' },
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
      taskData = { type: 'summarize', data: message.parts[0].text };
    }
    
    // Create a task for this message
    const taskId = crypto.randomUUID();
    
    // Process the task asynchronously
    let result;
    try {
      result = await processSummarizationTask(taskData, taskId);
    } catch (error) {
      result = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processedBy: AGENT_ID,
      };
    }
    
    // Return A2A compliant response with task
    const taskState = result.status === 'completed' ? 'completed' : 'failed';
    const taskMessage = result.status === 'completed' ? 'Summarization completed successfully' : (result as any).error || 'Summarization failed';
    
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
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction']
  });
});

// A2A Protocol Endpoints

// Agent Card endpoint (A2A discovery)
app.get('/api/a2a/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'summarizer',
    description: 'サマライザーエージェント - 処理済みデータと分析結果の簡潔で意味のある要約を作成します',
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction', 'audience-specific-content'],
    endpoint: `http://summarizer:${PORT}`,
    status: 'online',
    version: '1.0.0',
    supportedProtocols: ['A2A'],
    supportedTaskTypes: ['summarize', 'executive-summary', 'brief'],
    supportedAudienceTypes: ['technical', 'executive', 'general'],
    supportedMessageTypes: ['text/plain', 'application/json'],
  });
});

// Legacy agent info endpoint for backward compatibility
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'summarizer',
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction'],
    endpoint: `http://summarizer:${PORT}`,
    status: 'online',
    supportedTaskTypes: ['summarizeData', 'createExecutiveSummary', 'createBrief'],
    supportedAudienceTypes: ['technical', 'executive', 'general'],
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
      // Extract type from task result metadata if available
      const taskType = t.result?.metadata?.summaryType;
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
        summarize: taskList.filter(t => t.result?.metadata?.summaryType === 'summarize').length,
        'executive-summary': taskList.filter(t => t.result?.metadata?.summaryType === 'executive-summary').length,
        brief: taskList.filter(t => t.result?.metadata?.summaryType === 'brief').length,
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
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
  console.log(`Langfuse tracing enabled`);
});