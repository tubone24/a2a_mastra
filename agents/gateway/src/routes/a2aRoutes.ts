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

// Agent Card endpoint (Gateway info)
router.get('/info', (req, res) => {
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

// Message handling endpoint
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
      taskData = { type: 'routing', data: message.parts[0].text };
      console.log(`Fallback taskData:`, JSON.stringify(taskData, null, 2));
    }
    
    // Create a task for this message
    const taskId = crypto.randomUUID();
    
    // Process the task
    let result;
    try {
      // Process the message using the gateway agent
      const response = await gatewayAgent.generate([
        { role: "user", content: message.parts[0].text }
      ]);
      
      result = {
        task: {
          id: taskId,
          status: {
            state: 'completed',
            timestamp: new Date().toISOString(),
            message: {
              role: 'agent',
              parts: [{
                type: 'text',
                text: 'ゲートウェイによりメッセージが正常に処理されました'
              }]
            }
          },
          artifacts: [{
            type: 'response',
            data: {
              originalMessage: message.parts[0].text,
              response: response.text,
              processedBy: AGENT_ID
            }
          }]
        }
      };
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

// Task creation endpoint
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
    
    // Handle the task and return task information in A2A format
    res.json({
      task: {
        id: taskId,
        status: {
          state: 'completed',
          timestamp: new Date().toISOString(),
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: 'ゲートウェイエージェントによりタスクが正常に処理されました'
            }]
          }
        },
        artifacts: [{
          type: 'routing-result',
          data: {
            processedBy: AGENT_ID,
            completedAt: new Date().toISOString(),
            message: 'Task routed and processed successfully'
          }
        }]
      }
    });
    
  } catch (error) {
    console.error(`${AGENT_NAME} task processing error:`, error);
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
              text: `タスク処理エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          }
        },
        artifacts: []
      }
    });
  }
});

// Get Task endpoint
router.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // Check if this is an async task we're managing
  const asyncTask = asyncTasks.get(taskId);
  if (asyncTask) {
    // Convert async task to A2A format
    const state = asyncTask.status === 'working' ? 'working' : 
                  asyncTask.status === 'completed' ? 'completed' :
                  asyncTask.status === 'cancelled' ? 'failed' : 'failed';
    const phaseNameMap: Record<string, string> = {
      'search': 'Web検索フェーズ',
      'analyze': 'データ分析フェーズ', 
      'synthesize': '結果統合フェーズ',
      'completed': '完了'
    };
    
    const statusText = asyncTask.status === 'working' ? 
      `${phaseNameMap[asyncTask.currentPhase] || asyncTask.currentPhase} (${asyncTask.progress}%)` :
      asyncTask.status === 'completed' ? 'Deep Research完了' :
      asyncTask.status === 'cancelled' ? 'タスクがキャンセルされました' :
      asyncTask.status === 'failed' ? `失敗: ${asyncTask.error}` :
      'タスク開始中';
    
    return res.json({
      task: {
        id: asyncTask.id,
        status: {
          state,
          timestamp: asyncTask.completedAt || asyncTask.startedAt,
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: statusText
            }]
          }
        },
        artifacts: asyncTask.result ? [{
          type: 'workflow-result',
          data: asyncTask.result,
          metadata: {
            progress: asyncTask.progress,
            currentPhase: asyncTask.currentPhase,
            phases: asyncTask.phases,
            startedAt: asyncTask.startedAt,
            completedAt: asyncTask.completedAt,
            estimatedDuration: asyncTask.estimatedDuration,
            workflowExecutionId: asyncTask.workflowExecutionId
          }
        }] : []
      }
    });
  }
  
  // Fallback for other task types (A2A format)
  res.json({
    task: {
      id: taskId,
      status: {
        state: 'completed',
        timestamp: new Date().toISOString(),
        message: {
          role: 'agent',
          parts: [{
            type: 'text',
            text: 'タスクが正常に完了しました'
          }]
        }
      },
      artifacts: [{
        type: 'routing-result',
        data: {
          processedBy: AGENT_ID,
          completedAt: new Date().toISOString(),
        }
      }]
    }
  });
});

// Cancel Task endpoint
router.delete('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // Check if this is an async task we're managing
  const asyncTask = asyncTasks.get(taskId);
  if (asyncTask) {
    if (asyncTask.status === 'working') {
      asyncTask.status = 'cancelled';
      asyncTask.error = 'Task cancelled by request';
      asyncTask.completedAt = new Date().toISOString();
      asyncTasks.set(taskId, asyncTask);
    }
    
    return res.json({
      task: {
        id: asyncTask.id,
        status: {
          state: 'failed',
          timestamp: asyncTask.completedAt || new Date().toISOString(),
          message: {
            role: 'agent',
            parts: [{
              type: 'text',
              text: 'リクエストによりタスクがキャンセルされました'
            }]
          }
        },
        artifacts: []
      }
    });
  }
  
  // Fallback for other task types (A2A format)
  res.json({
    task: {
      id: taskId,
      status: {
        state: 'failed',
        timestamp: new Date().toISOString(),
        message: {
          role: 'agent',
          parts: [{
            type: 'text',
            text: 'リクエストによりタスクがキャンセルされました'
          }]
        }
      },
      artifacts: []
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