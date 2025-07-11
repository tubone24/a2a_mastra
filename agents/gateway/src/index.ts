import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { LangfuseExporter } from 'langfuse-vercel';

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

// Create Gateway Agent first  
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

// Initialize Mastra with Langfuse telemetry and register agent
const mastra = new Mastra({
  agents: { gatewayAgent }, // Register the agent
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

// Agent IDs for A2A communication
const AGENT_IDS = {
  'data-processor': process.env.DATA_PROCESSOR_AGENT_ID || 'data-processor-agent-01',
  'summarizer': process.env.SUMMARIZER_AGENT_ID || 'summarizer-agent-01',
};


// Request schema
const requestSchema = z.object({
  type: z.enum(['process', 'summarize', 'analyze']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
});

// A2A helper function to send messages to other agents using standard HTTP
async function sendA2AMessage(agentType: 'data-processor' | 'summarizer', content: any) {
  const endpoint = agentType === 'data-processor' 
    ? process.env.DATA_PROCESSOR_URL || 'http://data-processor:3002'
    : process.env.SUMMARIZER_URL || 'http://summarizer:3003';
  
  const messageId = crypto.randomUUID();
  
  const response = await fetch(`${endpoint}/api/a2a/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: messageId,
      from: AGENT_ID,
      message: {
        role: "user",
        parts: [{
          type: "text",
          text: JSON.stringify(content)
        }]
      },
      timestamp: new Date().toISOString(),
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send message to ${agentType}: ${response.statusText}`);
  }
  
  const result: any = await response.json();
  
  // Wait for task completion if it's in working state
  if (result.task?.status?.state === "working") {
    console.log(`Waiting for ${agentType} task to complete...`);
    let taskId = result.task.id;
    
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const taskResponse = await fetch(`${endpoint}/api/a2a/task/${taskId}`);
      if (taskResponse.ok) {
        const task: any = await taskResponse.json();
        if (task.status.state !== "working") {
          return task.result || task;
        }
      } else {
        break;
      }
    }
  }
  
  return result.task?.result || result;
}

// A2A helper function to get agent information
async function getAgentCard(agentType: 'data-processor' | 'summarizer') {
  const endpoint = agentType === 'data-processor' 
    ? process.env.DATA_PROCESSOR_URL || 'http://data-processor:3002'
    : process.env.SUMMARIZER_URL || 'http://summarizer:3003';
  
  try {
    const response = await fetch(`${endpoint}/api/a2a/agent`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn(`Failed to get agent card for ${agentType}:`, error);
    return null;
  }
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
        result = await sendA2AMessage('data-processor', {
          type: 'process',
          data: validatedRequest.data,
          context: validatedRequest.context,
        });
        break;

      case 'summarize':
        // Send summarization task to summarizer agent
        console.log('Routing to summarizer agent...');
        result = await sendA2AMessage('summarizer', {
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
        const processResult = await sendA2AMessage('data-processor', {
          type: 'analyze',
          data: validatedRequest.data,
          context: validatedRequest.context,
        });

        // Step 2: Summarize the processed results
        const summaryResult = await sendA2AMessage('summarizer', {
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

// A2A Protocol Endpoints

// Agent Card endpoint (A2A discovery)
app.get('/api/a2a/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'gateway',
    description: 'ゲートウェイエージェント - リクエストを受信し、適切なエージェントにルーティングします',
    capabilities: ['routing', 'orchestration', 'workflow-management'],
    endpoint: `http://gateway:${PORT}`,
    status: 'online',
    version: '1.0.0',
    supportedProtocols: ['A2A'],
    connectedAgents: Object.keys(AGENT_IDS),
  });
});

// Legacy agent info endpoint for backward compatibility
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

// A2A Message handling endpoint
app.post('/api/a2a/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { from, message } = req.body;
    
    // Process the message using the gateway agent
    const response = await gatewayAgent.generate([
      { role: "user", content: message.parts[0].text }
    ]);
    
    res.json({
      id: crypto.randomUUID(),
      from: AGENT_ID,
      to: from,
      message: {
        role: "assistant",
        parts: [{
          type: "text",
          text: response.text
        }]
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

// A2A Task creation endpoint
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const taskId = crypto.randomUUID();
    
    // Handle the task and return task information
    res.json({
      id: taskId,
      status: {
        state: 'completed',
        message: 'Task completed by gateway agent'
      },
      result: {
        processedBy: AGENT_ID,
        completedAt: new Date().toISOString(),
        message: 'Task routed and processed successfully'
      }
    });
    
  } catch (error) {
    console.error(`${AGENT_NAME} task processing error:`, error);
    res.status(500).json({
      id: req.body.id || crypto.randomUUID(),
      status: {
        state: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// A2A Get Task endpoint
app.get('/api/a2a/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // Return task status (in a real implementation, this would be stored)
  res.json({
    id: taskId,
    status: {
      state: 'completed',
      message: 'Task completed'
    },
    result: {
      processedBy: AGENT_ID,
      completedAt: new Date().toISOString(),
    }
  });
});

// Agent discovery endpoint - lists connected agents
app.get('/api/a2a/agents', async (req, res) => {
  try {
    const connectedAgents = [];
    
    // Try to get information about connected agents
    for (const [type] of Object.entries(AGENT_IDS)) {
      try {
        const agentCard = await getAgentCard(type as 'data-processor' | 'summarizer');
        if (agentCard) {
          connectedAgents.push(agentCard);
        }
      } catch (error) {
        console.warn(`Failed to get agent info for ${type}:`, error);
      }
    }
    
    res.json({
      gateway: {
        id: AGENT_ID,
        name: AGENT_NAME,
        status: 'online'
      },
      connectedAgents,
      totalAgents: connectedAgents.length
    });
  } catch (error) {
    console.error('Error fetching connected agents:', error);
    res.status(500).json({ error: 'Failed to fetch connected agents' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
});