import express from 'express';
import { tasks } from './a2aRoutes.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID,
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition']
  });
});

// Legacy agent info endpoint for backward compatibility
router.get('/agent', (req, res) => {
  const PORT = process.env.PORT || 3002;
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'processor',
    capabilities: ['data-processing', 'data-analysis', 'pattern-recognition'],
    endpoint: `http://data-processor:${PORT}`,
    status: 'online',
    supportedTaskTypes: ['processData', 'analyzeData'],
  });
});

// Get all tasks processed by this agent
router.get('/tasks', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  
  let taskList = Array.from(tasks.values());
  
  // Apply filters
  if (status) {
    taskList = taskList.filter(t => t.status.state === status);
  }
  
  // Sort by most recent first
  taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
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
      completed: taskList.filter(t => t.status.state === 'completed').length,
      failed: taskList.filter(t => t.status.state === 'failed').length,
      working: taskList.filter(t => t.status.state === 'working').length,
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