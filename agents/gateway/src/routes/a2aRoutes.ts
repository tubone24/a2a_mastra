import express from 'express';
import { gatewayAgent } from '../mastra/agents/gatewayAgent.js';
import { asyncTasks } from '../mastra/workflows/asyncTaskManager.js';
import { getAgentCard } from '../utils/mastraA2AClient.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';
const PORT = process.env.PORT || 3001;

// Agent IDs for A2A communication
const AGENT_IDS = {
  'data-processor': process.env.DATA_PROCESSOR_AGENT_ID || 'data-processor-agent-01',
  'summarizer': process.env.SUMMARIZER_AGENT_ID || 'summarizer-agent-01',
  'web-search': process.env.WEB_SEARCH_AGENT_ID || 'web-search-agent-01',
};

// Agent Card endpoint (A2A discovery)
router.get('/agent', (req, res) => {
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

// A2A Message handling endpoint
router.post('/message', async (req, res) => {
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
router.post('/task', async (req, res) => {
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
router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // Check if this is an async task we're managing
  const asyncTask = asyncTasks.get(taskId);
  if (asyncTask) {
    return res.json({
      taskId: asyncTask.id,
      status: asyncTask.status,
      progress: asyncTask.progress,
      currentPhase: asyncTask.currentPhase,
      phases: asyncTask.phases,
      result: asyncTask.result,
      error: asyncTask.error,
      startedAt: asyncTask.startedAt,
      completedAt: asyncTask.completedAt,
      estimatedDuration: asyncTask.estimatedDuration,
      details: asyncTask.status === 'working' ? 
        `Processing ${asyncTask.currentPhase} phase (${asyncTask.progress}%)` :
        asyncTask.status === 'completed' ? 'Research completed successfully' :
        asyncTask.status === 'failed' ? `Failed: ${asyncTask.error}` :
        'Task initiated',
      metadata: asyncTask.metadata,
      workflowExecutionId: asyncTask.workflowExecutionId,
    });
  }
  
  // Fallback for other task types (legacy behavior)
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
router.get('/agents', async (req, res) => {
  try {
    const connectedAgents = [];
    
    // Try to get information about connected agents
    for (const [type] of Object.entries(AGENT_IDS)) {
      try {
        const agentCard = await getAgentCard(type as 'data-processor' | 'summarizer' | 'web-search');
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

export { router as a2aRoutes };