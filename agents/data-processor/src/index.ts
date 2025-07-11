import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { generateText } from 'ai';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

// Initialize Mastra
const mastra = new Mastra({
  agents: {},
});

// Create Data Processor Agent
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

// Task schema for data processing
const processTaskSchema = z.object({
  type: z.enum(['process', 'analyze']),
  data: z.any(),
  context: z.record(z.any()).optional(),
});

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const task = processTaskSchema.parse(req.body);
    
    let prompt = '';
    let processedResult;
    
    switch (task.type) {
      case 'process':
        prompt = `
          以下のデータを処理・分析してください：
          ${JSON.stringify(task.data, null, 2)}
          
          以下を実行してください：
          1. データ構造とフォーマットを特定する
          2. 不整合をクリーニングし正規化する
          3. 主要なパターンや洞察を抽出する
          4. 発見事項の要約を提供する
          5. 処理済みデータを構造化された形式で返す
          
          コンテキスト: ${task.context ? JSON.stringify(task.context) : '提供されていません'}
          
          回答は必ず日本語で行ってください。
        `;
        break;
        
      case 'analyze':
        prompt = `
          以下のデータに対して詳細な分析を実行してください：
          ${JSON.stringify(task.data, null, 2)}
          
          以下を実行してください：
          1. トレンド、パターン、異常値を特定する
          2. 該当する統計値を計算する（該当する場合）
          3. 洞察と推奨事項を提供する
          4. 潜在的なデータ品質の問題を強調する
          5. さらなる処理のための次のステップを提案する
          
          コンテキスト: ${task.context ? JSON.stringify(task.context) : '提供されていません'}
          
          回答は必ず日本語で行ってください。
        `;
        break;
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
    
    // Use AI model to process the data
    const result = await generateText({
      model: getBedrockModel(),
      prompt,
    });
    
    processedResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      result: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        processingType: task.type,
        originalDataSize: JSON.stringify(task.data).length,
      },
    };
    
    console.log(`${AGENT_NAME} completed processing task`);
    
    res.json(processedResult);
    
  } catch (error) {
    console.error(`${AGENT_NAME} task processing error:`, error);
    res.status(500).json({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      processedBy: AGENT_ID,
    });
  }
});

// A2A Message endpoint for receiving messages from other agents
app.post('/api/a2a/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { from, content, timestamp } = req.body;
    
    // Process the message and potentially respond
    const response = {
      from: AGENT_ID,
      to: from,
      content: `Message received and acknowledged by ${AGENT_NAME}`,
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
    
  } catch (error) {
    console.error(`${AGENT_NAME} message processing error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
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

// Agent info endpoint (for A2A discovery)
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
});