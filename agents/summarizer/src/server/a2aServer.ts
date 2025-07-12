import express from 'express';
import { Agent } from '@mastra/core';
import { processSummarizationTask } from '../mastra/workflows/summarizationTaskProcessor.js';

// Task storage (in production, this would be a database)
const tasks = new Map();

interface A2AServerConfig {
  agent: Agent;
  agentId: string;
  agentName: string;
  port: number;
}

export function createA2AServer(config: A2AServerConfig) {
  const { agent, agentId, agentName, port } = config;
  const router = express.Router();

  // A2A Task endpoint for receiving tasks from other agents
  router.post('/task', async (req, res) => {
    try {
      console.log(`${agentName} received A2A task:`, req.body);
      
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
          console.log(`${agentName} completed summarization task`);
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
          console.error(`${agentName} task processing error:`, error);
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
      console.error(`${agentName} task creation error:`, error);
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
      console.log(`${agentName} received A2A message:`, req.body);
      
      const { id, from, message, timestamp } = req.body;
      
      // Parse the task from the message content
      let taskData;
      try {
        taskData = JSON.parse(message.parts[0].text);
      } catch {
        taskData = { type: 'summarize', data: message.parts[0].text };
      }
      
      // Process the task using the agent
      const taskId = crypto.randomUUID();
      let result;
      
      try {
        // Use the agent to generate a response
        const response = await agent.generate([
          { role: "user", content: JSON.stringify(taskData) }
        ]);
        
        // Process with summarization workflow if needed
        if (taskData.type && ['summarize', 'executive-summary', 'brief', 'research-synthesis'].includes(taskData.type)) {
          result = await processSummarizationTask(taskData, taskId);
        } else {
          result = {
            status: 'completed',
            processedBy: agentId,
            response: response.text,
            metadata: {
              completedAt: new Date().toISOString(),
            },
          };
        }
      } catch (error) {
        result = {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          processedBy: agentId,
        };
      }
      
      // Return A2A compliant response with task
      const taskState = result.status === 'completed' ? 'completed' : 'failed';
      const taskMessage = result.status === 'completed' ? 'Summarization completed successfully' : (result as any).error || 'Summarization failed';
      
      res.json({
        id: crypto.randomUUID(),
        from: agentId,
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
      console.error(`${agentName} message processing error:`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        from: agentId,
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
      id: agentId,
      name: agentName,
      type: 'summarizer',
      description: 'サマライザーエージェント - 処理済みデータと分析結果の簡潔で意味のある要約を作成します',
      capabilities: ['text-summarization', 'executive-summary', 'insight-extraction', 'audience-specific-content'],
      endpoint: `http://summarizer:${port}`,
      status: 'online',
      version: '1.0.0',
      supportedProtocols: ['A2A'],
      supportedTaskTypes: ['summarize', 'executive-summary', 'brief', 'research-synthesis'],
      supportedAudienceTypes: ['technical', 'executive', 'general'],
      supportedMessageTypes: ['text/plain', 'application/json'],
    });
  });

  return router;
}