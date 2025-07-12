import express from 'express';
import { tasks } from './a2aRoutes.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';
const PORT = process.env.PORT || 3003;

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID,
    capabilities: ['text-summarization', 'executive-summary', 'insight-extraction']
  });
});

// Legacy agent info endpoint for backward compatibility
router.get('/agent', (req, res) => {
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

// Get all tasks processed by this agent
router.get('/tasks', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const type = req.query.type as string;
  
  let taskList = Array.from(tasks.values());
  
  // Apply filters
  if (status) {
    taskList = taskList.filter((t: any) => t.status.state === status);
  }
  if (type && taskList.length > 0) {
    taskList = taskList.filter((t: any) => {
      // Extract type from task result metadata if available
      const taskType = t.result?.metadata?.summaryType;
      return taskType === type;
    });
  }
  
  // Sort by most recent first
  taskList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedTasks = taskList.slice(startIndex, endIndex);
  
  res.json({
    tasks: paginatedTasks,
    pagination: {
      page,
      limit,
      total: taskList.length,
      totalPages: Math.ceil(taskList.length / limit),
      hasNext: endIndex < taskList.length,
      hasPrev: page > 1,
    },
    statistics: {
      total: taskList.length,
      completed: taskList.filter((t: any) => t.status.state === 'completed').length,
      failed: taskList.filter((t: any) => t.status.state === 'failed').length,
      working: taskList.filter((t: any) => t.status.state === 'working').length,
      byType: {
        summarize: taskList.filter((t: any) => t.result?.metadata?.summaryType === 'summarize').length,
        'executive-summary': taskList.filter((t: any) => t.result?.metadata?.summaryType === 'executive-summary').length,
        brief: taskList.filter((t: any) => t.result?.metadata?.summaryType === 'brief').length,
      },
    },
  });
});

// Get specific task details
router.get('/tasks/:taskId', (req, res) => {
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

export { router as apiRoutes };