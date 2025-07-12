import express from 'express';
import { mastra } from '../mastra/index.js';
import { processSummarizationTask } from '../mastra/workflows/summarizationTaskProcessor.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';
const PORT = process.env.PORT || 3003;

// Task storage (in production, this would be a database)
export const tasks = new Map();

// A2A Task endpoint for receiving tasks from other agents
router.post('/task', async (req, res) => {
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
      .then((result: any) => {
        console.log(`${AGENT_NAME} completed summarization task`);
        // Store task result
        tasks.set(taskId, {
          id: taskId,
          status: { state: 'completed', message: 'Summarization completed successfully' },
          result: result,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      })
      .catch((error: any) => {
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
router.post('/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { id, from, message, timestamp } = req.body;
    
    // Parse the task from the message content
    let taskData;
    try {
      taskData = JSON.parse(message.parts[0].text);
      console.log(`Parsed taskData:`, JSON.stringify(taskData, null, 2));
    } catch {
      taskData = { type: 'summarize', data: message.parts[0].text };
      console.log(`Fallback taskData:`, JSON.stringify(taskData, null, 2));
    }
    
    // Create a task for this message
    const taskId = crypto.randomUUID();
    
    // Process the task asynchronously
    let result;
    try {
      // Always use our specialized summarization workflow for A2A messages
      // Set default type if not provided
      if (!taskData.type) {
        taskData.type = 'summarize';
      }
      
      const validTaskTypes = ['summarize', 'executive-summary', 'brief', 'research-synthesis', 'comprehensive'];
      
      if (validTaskTypes.includes(taskData.type)) {
        result = await processSummarizationTask(taskData, taskId);
      } else {
        // For unknown types, convert to general summarization
        result = await processSummarizationTask({
          ...taskData,
          type: 'summarize'
        }, taskId);
      }
    } catch (error) {
      result = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processedBy: AGENT_ID,
      };
    }
    
    // Return A2A compliant response with task
    const taskState = result?.status === 'completed' ? 'completed' : 'failed';
    const taskMessage = result?.status === 'completed' ? 'Summarization completed successfully' : (result as any)?.error || 'Summarization failed';
    
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

// Agent Card endpoint (A2A discovery)
router.get('/agent', (req, res) => {
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
    supportedTaskTypes: ['summarize', 'executive-summary', 'brief', 'research-synthesis'],
    supportedAudienceTypes: ['technical', 'executive', 'general'],
    supportedMessageTypes: ['text/plain', 'application/json'],
    // Enhanced with Mastra agent capabilities
    mastraAgent: {
      id: AGENT_ID,
      available: true,
      tools: mastra.getAgent(AGENT_ID)?.tools ? Object.keys(mastra.getAgent(AGENT_ID).tools) : [],
    }
  });
});

export { router as a2aRoutes };