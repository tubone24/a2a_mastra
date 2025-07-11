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

const PORT = process.env.PORT || 3002;
const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

// Create Data Processor Agent first
const dataProcessorAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたは構造化および非構造化データの分析・処理を専門とするデータプロセッサーエージェントです。
    あなたの役割は以下の通りです：
    1. A2Aプロトコル経由で他のエージェントからデータを受信する
    2. データ構造と内容を分析する
    3. データをクリーニングし正規化する
    4. 意味のある洞察やパターンを抽出する
    5. 処理結果を要求元のエージェントに返す
    
    常に詳細な分析と処理ステップの明確な説明を提供してください。
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

console.log('Langfuse client initialized:', {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ? 'SET' : 'NOT SET',
  secretKey: process.env.LANGFUSE_SECRET_KEY ? 'SET' : 'NOT SET',
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
});

// Initialize Mastra with agent
const mastra = new Mastra({
  agents: { dataProcessorAgent }, // Register the agent
});

console.log('Mastra initialized successfully with agent registered');

// Task schema for data processing
const processTaskSchema = z.object({
  type: z.enum(['process', 'analyze', 'research-analysis']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  options: z.object({
    analyzePatterns: z.boolean().optional(),
    extractInsights: z.boolean().optional(),
    depth: z.enum(['basic', 'comprehensive', 'expert']).optional(),
  }).optional(),
});

// Task storage (in production, this would be a proper database)
const tasks = new Map();

// Helper function to process tasks
async function processTask(task: any, taskId: string, parentTraceId?: string) {
  // Create Langfuse trace for this processing task
  const trace = langfuse.trace({
    id: parentTraceId || undefined,
    name: 'data-processing-task',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      taskId: taskId,
      taskType: task?.type || 'unknown',
    },
    tags: ['data-processor', 'processing-task'],
  });

  const validatedTask = processTaskSchema.parse(task);
  
  // Log task validation
  trace.event({
    name: 'task-validated',
    metadata: {
      type: validatedTask.type,
      dataSize: JSON.stringify(validatedTask.data).length,
      hasContext: !!validatedTask.context,
    },
  });
  
  let prompt = '';
  let processedResult;
  
  switch (validatedTask.type) {
    case 'process':
      prompt = `
        以下のデータを処理・分析してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を実行してください：
        1. データ構造とフォーマットを特定する
        2. 不整合をクリーニングし正規化する
        3. 主要なパターンや洞察を抽出する
        4. 発見事項の要約を提供する
        5. 処理済みデータを構造化された形式で返す
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'analyze':
      prompt = `
        以下のデータに対して詳細な分析を実行してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を実行してください：
        1. トレンド、パターン、異常値を特定する
        2. 該当する統計値を計算する（該当する場合）
        3. 洞察と推奨事項を提供する
        4. 潜在的なデータ品質の問題を強調する
        5. さらなる処理のための次のステップを提案する
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'research-analysis':
      const depth = validatedTask.options?.depth || 'comprehensive';
      const shouldAnalyzePatterns = validatedTask.options?.analyzePatterns !== false;
      const shouldExtractInsights = validatedTask.options?.extractInsights !== false;
      
      prompt = `
        以下は研究目的のデータセットです。詳細な研究分析を実行してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        分析レベル: ${depth}
        パターン分析: ${shouldAnalyzePatterns ? '実行する' : 'スキップ'}
        洞察抽出: ${shouldExtractInsights ? '実行する' : 'スキップ'}
        
        以下を実行してください：
        1. データソースと信頼性の評価
        2. 構造化された分析フレームワークの適用
        ${shouldAnalyzePatterns ? '3. 深いパターン分析と相関関係の特定' : ''}
        ${shouldExtractInsights ? '4. 戦略的洞察と示唆の抽出' : ''}
        5. 研究仮説や質問に対する証拠の評価
        6. 制限事項と潜在的バイアスの特定
        7. さらなる研究の方向性の提案
        8. 実用的な含意と提案の提供
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        分析結果は以下の構造で返してください：
        - データ概要
        - 主要な発見事項
        - パターンと傾向
        - 洞察と含意
        - 制限事項
        - 提案事項
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    default:
      throw new Error(`Unknown task type: ${validatedTask.type}`);
  }
  
  // Use Mastra Agent to process the data with Langfuse tracing
  console.log('Calling dataProcessorAgent.generate() with prompt length:', prompt.length);
  
  const generation = trace.generation({
    name: 'data-processing-llm-call',
    model: 'bedrock-claude',
    input: [{ role: "user", content: prompt }],
    metadata: {
      promptLength: prompt.length,
      processingType: validatedTask.type,
    },
  });
  
  try {
    const result = await dataProcessorAgent.generate([
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
    
    processedResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      result: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        processingType: validatedTask.type,
        originalDataSize: JSON.stringify(validatedTask.data).length,
        traceId: trace.id,
      },
    };
    
    // Log successful completion
    trace.event({
      name: 'processing-completed',
      metadata: {
        resultSize: result.text.length,
        success: true,
      },
    });
    
  } catch (error) {
    generation.end({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    
    trace.event({
      name: 'processing-failed',
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
    status: { state: 'completed', message: 'Task completed successfully' },
    result: processedResult,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
  
  return processedResult;
}

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const taskId = req.body.id || crypto.randomUUID();
    
    // Store initial task state
    tasks.set(taskId, {
      id: taskId,
      status: { state: 'working', message: 'Processing task...' },
      result: null,
      createdAt: new Date().toISOString(),
    });
    
    // Process task asynchronously
    processTask(req.body, taskId)
      .then(result => {
        console.log(`${AGENT_NAME} completed processing task`);
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
      status: { state: 'working', message: 'Task is being processed...' },
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
      taskData = { type: 'process', data: message.parts[0].text };
    }
    
    // Create a task for this message
    const taskId = crypto.randomUUID();
    
    // Process the task asynchronously
    let result;
    try {
      result = await processTask(taskData, taskId);
    } catch (error) {
      result = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processedBy: AGENT_ID,
      };
    }
    
    // Return A2A compliant response with task
    const taskState = result.status === 'completed' ? 'completed' : 'failed';
    const taskMessage = result.status === 'completed' ? 'Task completed successfully' : (result as any).error || 'Task failed';
    
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
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition']
  });
});

// A2A Protocol Endpoints

// Agent Card endpoint (A2A discovery)
app.get('/api/a2a/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'processor',
    description: 'データプロセッサーエージェント - 構造化および非構造化データの分析・処理を専門とします',
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition', 'data-cleaning', 'normalization'],
    endpoint: `http://data-processor:${PORT}`,
    status: 'online',
    version: '1.0.0',
    supportedProtocols: ['A2A'],
    supportedTaskTypes: ['process', 'analyze', 'research-analysis'],
    supportedMessageTypes: ['text/plain', 'application/json'],
  });
});

// Legacy agent info endpoint for backward compatibility
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'processor',
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition'],
    endpoint: `http://data-processor:${PORT}`,
    status: 'online',
    supportedTaskTypes: ['processData', 'analyzeData'],
  });
});

// Task History API Endpoints

// Get all tasks processed by this agent
app.get('/api/tasks', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  
  let taskList = Array.from(tasks.values());
  
  // Apply filters
  if (status) {
    taskList = taskList.filter(t => t.status.state === status);
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
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
  console.log(`Langfuse tracing enabled`);
});