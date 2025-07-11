import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { LangfuseExporter } from 'langfuse-vercel';

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

// Initialize Mastra with Langfuse telemetry and register agent
console.log('Initializing Mastra with Langfuse config:', {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ? 'SET' : 'NOT SET',
  secretKey: process.env.LANGFUSE_SECRET_KEY ? 'SET' : 'NOT SET',
  baseUrl: process.env.LANGFUSE_BASEURL
});

const mastra = new Mastra({
  agents: { dataProcessorAgent }, // Register the agent
  telemetry: {
    serviceName: "ai", // Must be set to "ai" for Langfuse
    enabled: true,
    export: {
      type: "custom",
      exporter: new LangfuseExporter({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL,
      }),
    },
  },
});

console.log('Mastra initialized successfully with agent registered');

// Task schema for data processing
const processTaskSchema = z.object({
  type: z.enum(['process', 'analyze']),
  data: z.any(),
  context: z.record(z.any()).optional(),
});

// Task storage (in production, this would be a proper database)
const tasks = new Map();

// Helper function to process tasks
async function processTask(task: any, taskId: string) {
  const validatedTask = processTaskSchema.parse(task);
  
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
      
    default:
      throw new Error(`Unknown task type: ${validatedTask.type}`);
  }
  
  // Use Mastra Agent to process the data (enables Langfuse tracing)
  console.log('Calling dataProcessorAgent.generate() with prompt length:', prompt.length);
  const result = await dataProcessorAgent.generate([
    { role: "user", content: prompt }
  ]);
  console.log('Agent response received, length:', result.text.length);
  
  processedResult = {
    status: 'completed',
    processedBy: AGENT_ID,
    result: result.text,
    metadata: {
      completedAt: new Date().toISOString(),
      processingType: validatedTask.type,
      originalDataSize: JSON.stringify(validatedTask.data).length,
    },
  };
  
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
    supportedTaskTypes: ['process', 'analyze'],
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

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
});