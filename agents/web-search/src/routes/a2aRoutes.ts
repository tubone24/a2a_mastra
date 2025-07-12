import express from 'express';
import { processSearchTask } from '../mastra/workflows/searchTaskProcessor.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Web Search Agent';
const PORT = process.env.PORT || 3004;

// Task storage (in production, this would be a database)
const tasks = new Map();

// We'll receive the webSearchAgent as a parameter when router is initialized
let webSearchAgent: any;

export function createA2ARoutes(agent: any) {
  webSearchAgent = agent;
  return router;
}

// A2A Task endpoint for receiving tasks from other agents
router.post('/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const { to } = req.body;
    
    // Validate target agent ID if specified
    if (to && to !== AGENT_ID) {
      return res.status(400).json({
        error: `Task intended for agent ${to}, but this is ${AGENT_ID}`,
        from: AGENT_ID,
      });
    }
    
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
    processSearchTask(taskData, taskId, webSearchAgent)
      .then(result => {
        console.log(`${AGENT_NAME} completed search task`);
        // Store task result
        tasks.set(taskId, {
          id: taskId,
          status: { 
            state: result.status === 'completed' ? 'completed' : 'failed', 
            message: result.status === 'completed' ? 'Search completed successfully' : (result.error || 'Search failed') 
          },
          result: result,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
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
router.get('/task/:taskId', (req, res) => {
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
router.delete('/task/:taskId', (req, res) => {
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
router.post('/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { id, from, message, timestamp, to } = req.body;
    
    // Validate target agent ID if specified
    if (to && to !== AGENT_ID) {
      return res.status(400).json({
        error: `Message intended for agent ${to}, but this is ${AGENT_ID}`,
        from: AGENT_ID,
      });
    }
    
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
      result = await processSearchTask(taskData, taskId, webSearchAgent);
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

// Agent Card endpoint (A2A discovery)
router.get('/agent', (req, res) => {
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

export { router as a2aRoutes, tasks };