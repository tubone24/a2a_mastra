import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

// 静的ファイルサービング（フロントエンド用）
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3001;
const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// Initialize Mastra
const mastra = new Mastra({
  agents: {},
});

// Create Gateway Agent
const gatewayAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたはゲートウェイエージェントです。リクエストを受信し、適切なエージェントにルーティングします。
    受信したリクエストを分析し、データ処理や要約が必要かどうかを判断します。
    A2Aプロトコルを使用して他のエージェントと連携します。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
});

// Agent endpoints for A2A communication
const AGENT_ENDPOINTS = {
  'data-processor': process.env.DATA_PROCESSOR_URL || 'http://data-processor:3002',
  'summarizer': process.env.SUMMARIZER_URL || 'http://summarizer:3003',
};

// Request schema
const requestSchema = z.object({
  type: z.enum(['process', 'summarize', 'analyze']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
});

// A2A helper function to send tasks to other agents
async function sendA2ATask(agentType: 'data-processor' | 'summarizer', task: any) {
  const endpoint = AGENT_ENDPOINTS[agentType];
  const response = await fetch(`${endpoint}/api/a2a/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...task,
      from: AGENT_ID,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send task to ${agentType}: ${response.statusText}`);
  }

  return await response.json();
}

// A2A helper function to send messages to other agents
async function sendA2AMessage(agentType: 'data-processor' | 'summarizer', message: string) {
  const endpoint = AGENT_ENDPOINTS[agentType];
  const response = await fetch(`${endpoint}/api/a2a/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: AGENT_ID,
      content: message,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message to ${agentType}: ${response.statusText}`);
  }

  return await response.json();
}

// Main request handler
app.post('/api/request', async (req, res) => {
  try {
    const validatedRequest = requestSchema.parse(req.body);
    console.log(`Gateway received request of type: ${validatedRequest.type}`);

    let result: any;

    switch (validatedRequest.type) {
      case 'process':
        // Send processing task to data-processor agent
        console.log('Routing to data-processor agent...');
        result = await sendA2ATask('data-processor', {
          type: 'process',
          data: validatedRequest.data,
          context: validatedRequest.context,
        });
        break;

      case 'summarize':
        // Send summarization task to summarizer agent
        console.log('Routing to summarizer agent...');
        result = await sendA2ATask('summarizer', {
          type: 'summarize',
          data: validatedRequest.data,
          context: validatedRequest.context,
          audienceType: validatedRequest.audienceType || 'general',
        });
        break;

      case 'analyze':
        // First process with data-processor, then summarize with summarizer
        console.log('Starting analysis workflow: data-processor -> summarizer');
        
        // Step 1: Process the data
        const processResult = await sendA2ATask('data-processor', {
          type: 'analyze',
          data: validatedRequest.data,
          context: validatedRequest.context,
        });

        // Step 2: Summarize the processed results
        const summaryResult = await sendA2ATask('summarizer', {
          type: 'executive-summary',
          data: processResult,
          context: {
            ...validatedRequest.context,
            workflow: 'analyze',
            previousStep: 'data-processing',
          },
          audienceType: validatedRequest.audienceType || 'executive',
        });

        result = {
          workflow: 'analyze',
          steps: {
            processing: processResult,
            summary: summaryResult,
          },
          final_result: summaryResult,
        };
        break;

      default:
        throw new Error('Unknown request type');
    }

    console.log(`Gateway completed ${validatedRequest.type} request`);

    res.json({
      status: 'success',
      type: validatedRequest.type,
      result,
      metadata: {
        completedAt: new Date().toISOString(),
        gateway: AGENT_ID,
      },
    });

  } catch (error) {
    console.error('Gateway error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      gateway: AGENT_ID,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID 
  });
});

// Agent info endpoint (for A2A discovery)
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'gateway',
    capabilities: ['routing', 'orchestration'],
    endpoint: `http://gateway:${PORT}`,
    status: 'online',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
});