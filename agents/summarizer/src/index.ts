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

const PORT = process.env.PORT || 3003;
const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';

// Initialize Mastra
const mastra = new Mastra({
  agents: {},
});

// Create Summarizer Agent
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

// Task schema for summarization
const summarizeTaskSchema = z.object({
  type: z.enum(['summarize', 'executive-summary', 'brief']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
});

// A2A Task endpoint for receiving tasks from other agents
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const task = summarizeTaskSchema.parse(req.body);
    
    let prompt = '';
    let summaryResult;
    
    const audienceType = task.audienceType || 'general';
    
    switch (task.type) {
      case 'summarize':
        prompt = `
          以下のデータと分析の包括的な要約を作成してください：
          ${JSON.stringify(task.data, null, 2)}
          
          以下を提供してください：
          1. 主要な発見事項の明確な概要
          2. 特定された重要な洞察とパターン
          3. 重要な統計やメトリクス
          4. 発見事項の潜在的な影響
          5. 推奨される次のステップやアクション
          
          対象オーディエンス: ${audienceType}
          コンテキスト: ${task.context ? JSON.stringify(task.context) : '提供されていません'}
          
          ${audienceType}オーディエンスに適した明確で構造化された形式で要約をフォーマットしてください。
          回答は必ず日本語で行ってください。
        `;
        break;
        
      case 'executive-summary':
        prompt = `
          以下のデータと分析のエグゼクティブサマリーを作成してください：
          ${JSON.stringify(task.data, null, 2)}
          
          以下を提供してください：
          1. 高レベルな概要（2-3文）
          2. 主要なビジネスへの影響
          3. 重要なメトリクスやKPI
          4. 戦略的推奨事項
          5. リスク要因や考慮事項
          
          簡潔でビジネスに焦点を当てた内容にしてください。最大200語。
          コンテキスト: ${task.context ? JSON.stringify(task.context) : '提供されていません'}
          
          回答は必ず日本語で行ってください。
        `;
        break;
        
      case 'brief':
        prompt = `
          以下のデータと分析の簡潔な要約を作成してください：
          ${JSON.stringify(task.data, null, 2)}
          
          以下を提供してください：
          1. 一文での概要
          2. 上位3つの主要な発見事項
          3. 主要な推奨事項
          
          極めて簡潔にまとめてください。最大100語。
          コンテキスト: ${task.context ? JSON.stringify(task.context) : '提供されていません'}
          
          回答は必ず日本語で行ってください。
        `;
        break;
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
    
    // Use AI model to create the summary
    const result = await generateText({
      model: getBedrockModel(),
      prompt,
    });
    
    summaryResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      summary: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        summaryType: task.type,
        audienceType,
        originalDataSize: JSON.stringify(task.data).length,
        summaryLength: result.text.length,
      },
    };
    
    console.log(`${AGENT_NAME} completed summarization task`);
    
    res.json(summaryResult);
    
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
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction']
  });
});

// Agent info endpoint (for A2A discovery)
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

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
});