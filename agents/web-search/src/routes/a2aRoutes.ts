import express from 'express';
import { mastra } from '../mastra/index.js';
import { processSearchTask } from '../mastra/workflows/searchTaskProcessor.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Web Search Agent';
const PORT = process.env.PORT || 3004;

// Task storage (in production, this would be a database)
export const tasks = new Map();

// We'll import the webSearchAgent from the mastra index
let webSearchAgent: any = null;

// Helper function to get the agent (lazy loading)
function getWebSearchAgent() {
  if (!webSearchAgent) {
    try {
      webSearchAgent = mastra?.getAgent?.('web-search-agent-01');
    } catch (error) {
      console.error('Failed to get web search agent:', error);
    }
  }
  return webSearchAgent;
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
    processSearchTask(taskData, taskId, getWebSearchAgent())
      .then((result: any) => {
        console.log(`${AGENT_NAME} completed search task`);
        // Store task result in A2A format
        tasks.set(taskId, result);
      })
      .catch((error: any) => {
        console.error(`${AGENT_NAME} task processing error:`, error);
        tasks.set(taskId, {
          task: {
            id: taskId,
            status: {
              state: 'failed',
              timestamp: new Date().toISOString(),
              message: {
                role: 'agent',
                parts: [{
                  type: 'text',
                  text: `エラーが発生しました: ${error.message}`
                }]
              }
            },
            artifacts: []
          }
        });
      });
    
    // Return task immediately with working status in A2A format
    res.json({
      task: {
        id: taskId,
        status: {
          state: 'working',
          timestamp: new Date().toISOString(),
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: 'Web検索タスクを処理中です...'
            }]
          }
        },
        artifacts: []
      }
    });
    
  } catch (error) {
    console.error(`${AGENT_NAME} task creation error:`, error);
    const taskId = req.body.id || crypto.randomUUID();
    res.status(500).json({
      task: {
        id: taskId,
        status: {
          state: 'failed',
          timestamp: new Date().toISOString(),
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: `タスク作成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          }
        },
        artifacts: []
      }
    });
  }
});

// A2A Get Task endpoint
router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  const taskResult = tasks.get(taskId);
  if (!taskResult) {
    return res.status(404).json({
      task: {
        id: taskId,
        status: {
          state: 'failed',
          timestamp: new Date().toISOString(),
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: 'タスクが見つかりません'
            }]
          }
        },
        artifacts: []
      }
    });
  }
  
  res.json(taskResult);
});

// A2A Cancel Task endpoint
router.delete('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  const taskResult = tasks.get(taskId);
  if (!taskResult) {
    return res.status(404).json({
      task: {
        id: taskId,
        status: {
          state: 'failed',
          timestamp: new Date().toISOString(),
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: 'タスクが見つかりません'
            }]
          }
        },
        artifacts: []
      }
    });
  }
  
  if (taskResult.task && taskResult.task.status.state === 'working') {
    taskResult.task.status = {
      state: 'cancelled',
      timestamp: new Date().toISOString(),
      message: {
        role: 'agent',
        parts: [{
          type: 'text',
          text: 'リクエストによりタスクがキャンセルされました'
        }]
      }
    };
    tasks.set(taskId, taskResult);
  }
  
  res.json(taskResult);
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
      console.log(`Parsed taskData:`, JSON.stringify(taskData, null, 2));
    } catch {
      taskData = { type: 'web-search', query: message.parts[0].text };
      console.log(`Fallback taskData:`, JSON.stringify(taskData, null, 2));
    }
    
    // Create a task for this message
    const taskId = crypto.randomUUID();
    
    // Process the task asynchronously
    let result;
    try {
      // Always use our specialized search workflow for A2A messages
      // Set default type if not provided
      if (!taskData.type) {
        taskData.type = 'web-search';
      }
      
      const validTaskTypes = ['web-search', 'news-search', 'scholarly-search', 'comprehensive-search'];
      
      if (validTaskTypes.includes(taskData.type)) {
        result = await processSearchTask(taskData, taskId, getWebSearchAgent());
      } else {
        // For unknown types, convert to general web search
        result = await processSearchTask({
          ...taskData,
          type: 'web-search'
        }, taskId, getWebSearchAgent());
      }
    } catch (error) {
      // Return error in the expected A2A task format
      result = {
        task: {
          id: taskId,
          status: {
            state: 'failed',
            timestamp: new Date().toISOString(),
            message: {
              role: 'agent',
              parts: [{
                type: 'text',
                text: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
              }]
            }
          },
          artifacts: []
        }
      };
    }
    
    // Return the task structure directly
    res.json(result);
    
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
    // Enhanced with Mastra agent capabilities
    mastraAgent: {
      id: AGENT_ID,
      available: true,
      tools: mastra?.getAgent?.(AGENT_ID)?.tools ? Object.keys(mastra.getAgent(AGENT_ID).tools) : [],
    }
  });
});

export { router as a2aRoutes };