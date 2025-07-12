import express from 'express';
import { workflowExecutions } from '../mastra/workflows/workflowManager.js';
import { WorkflowStep, FlowHistory } from '../types.js';

const router = express.Router();

// Get all workflow executions
router.get('/', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const type = req.query.type as string;
  
  let executions = Array.from(workflowExecutions.values());
  
  // Apply filters
  if (status) {
    executions = executions.filter(e => e.status === status);
  }
  if (type) {
    executions = executions.filter(e => e.type === type);
  }
  
  // Sort by most recent first
  executions.sort((a, b) => new Date(b.metadata.startedAt).getTime() - new Date(a.metadata.startedAt).getTime());
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedExecutions = executions.slice(startIndex, endIndex);
  
  const history: FlowHistory = {
    executions: paginatedExecutions,
    totalExecutions: executions.length,
    completedExecutions: executions.filter(e => e.status === 'completed').length,
    failedExecutions: executions.filter(e => e.status === 'failed').length,
  };
  
  res.json({
    ...history,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(executions.length / limit),
      hasNext: endIndex < executions.length,
      hasPrev: page > 1,
    },
  });
});

// Get specific workflow execution
router.get('/:executionId', (req, res) => {
  const { executionId } = req.params;
  
  const execution = workflowExecutions.get(executionId);
  if (!execution) {
    return res.status(404).json({
      error: 'Workflow execution not found',
      executionId
    });
  }
  
  res.json(execution);
});

// Get workflow execution steps
router.get('/:executionId/steps', (req, res) => {
  const { executionId } = req.params;
  
  const execution = workflowExecutions.get(executionId);
  if (!execution) {
    return res.status(404).json({
      error: 'Workflow execution not found',
      executionId
    });
  }
  
  res.json({
    executionId,
    steps: execution.steps,
    totalSteps: execution.steps.length,
    completedSteps: execution.steps.filter((s: WorkflowStep) => s.status === 'completed').length,
    failedSteps: execution.steps.filter((s: WorkflowStep) => s.status === 'failed').length,
  });
});

// Get workflow execution statistics
router.get('/stats/summary', (req, res) => {
  const executions = Array.from(workflowExecutions.values());
  
  const stats = {
    total: executions.length,
    byStatus: {
      pending: executions.filter(e => e.status === 'pending').length,
      in_progress: executions.filter(e => e.status === 'in_progress').length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      partial: executions.filter(e => e.status === 'partial').length,
    },
    byType: {
      process: executions.filter(e => e.type === 'process').length,
      summarize: executions.filter(e => e.type === 'summarize').length,
      analyze: executions.filter(e => e.type === 'analyze').length,
      'web-search': executions.filter(e => e.type === 'web-search').length,
      'news-search': executions.filter(e => e.type === 'news-search').length,
      'scholarly-search': executions.filter(e => e.type === 'scholarly-search').length,
      'deep-research': executions.filter(e => e.type === 'deep-research').length,
    },
    averageDuration: executions
      .filter(e => e.metadata.totalDuration)
      .reduce((sum, e) => sum + (e.metadata.totalDuration || 0), 0) / 
      executions.filter(e => e.metadata.totalDuration).length || 0,
    recentExecutions: executions
      .sort((a, b) => new Date(b.metadata.startedAt).getTime() - new Date(a.metadata.startedAt).getTime())
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        type: e.type,
        status: e.status,
        startedAt: e.metadata.startedAt,
        duration: e.metadata.totalDuration,
      })),
  };
  
  res.json(stats);
});

export { router as workflowRoutes };