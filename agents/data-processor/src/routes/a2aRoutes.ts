import express from 'express';
import { processTask } from '../mastra/workflows/taskProcessor.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

// Task storage (in production, this would be a proper database)
const tasks = new Map();

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
        // Store task result
        tasks.set(taskId, {
          id: taskId,
          status: { state: 'completed', message: 'Task completed successfully' },
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

// Agent Card endpoint (A2A discovery)
router.get('/agent', (req, res) => {
  const PORT = process.env.PORT || 3002;
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

export { router as a2aRoutes, tasks };