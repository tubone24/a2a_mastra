import express from 'express';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { 
  createWorkflowExecution, 
  completeWorkflowExecution,
  WorkflowExecution 
} from '../mastra/workflows/workflowManager.js';
import { asyncTasks, taskCounter, AsyncTask } from '../mastra/workflows/asyncTaskManager.js';
import { executeDeepResearchWorkflow } from '../mastra/workflows/deepResearchWorkflow.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// Request schema
const requestSchema = z.object({
  type: z.enum(['process', 'summarize', 'analyze', 'web-search', 'news-search', 'scholarly-search', 'deep-research']),
  data: z.any().optional(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
  query: z.string().optional(),
  topic: z.string().optional(),
  searchOptions: z.object({
    maxResults: z.number().optional(),
    timeRange: z.enum(['day', 'week', 'month', 'year', 'all']).optional(),
    language: z.string().optional(),
    region: z.string().optional(),
    category: z.enum(['general', 'news', 'images', 'videos', 'scholarly']).optional(),
    safesearch: z.enum(['strict', 'moderate', 'off']).optional(),
  }).optional(),
  options: z.object({
    depth: z.enum(['basic', 'comprehensive', 'expert']).optional(),
    sources: z.array(z.enum(['web', 'news', 'academic', 'reports'])).optional(),
    maxDuration: z.string().optional(),
    parallelTasks: z.boolean().optional(),
  }).optional(),
});

// New A2A Agents endpoint for modern API
router.post('/', async (req, res) => {
  const requestId = crypto.randomUUID();
  
  // Create Langfuse trace for the request
  const trace = langfuse.trace({
    id: requestId,
    name: 'a2a-agents-request',
    userId: req.headers['x-user-id'] as string || 'unknown',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      requestType: req.body?.type || 'unknown',
    },
    tags: ['gateway', 'a2a-agents', 'modern-api'],
  });

  let workflowExecution: WorkflowExecution | null = null;

  try {
    const validatedRequest = requestSchema.parse(req.body);
    console.log(`Gateway received A2A agents request of type: ${validatedRequest.type}`);
    
    // Handle deep-research as asynchronous task
    if (validatedRequest.type === 'deep-research') {
      const topic = validatedRequest.topic || validatedRequest.query || '';
      if (!topic) {
        return res.status(400).json({
          error: 'Topic or query is required for deep-research',
          type: 'validation_error'
        });
      }

      // Create async task
      const taskId = `research-task-${taskCounter + 1}-${Date.now()}`;
      const phases = ['search', 'analyze', 'synthesize'];
      
      // Create workflow execution record
      workflowExecution = createWorkflowExecution(
        requestId,
        'deep-research',
        req.headers['x-user-id'] as string || 'anonymous',
        trace.id,
        JSON.stringify({ topic, options: validatedRequest.options }).length,
        validatedRequest.audienceType
      );

      const task: AsyncTask = {
        id: taskId,
        type: 'deep-research',
        status: 'initiated',
        progress: 0,
        currentPhase: 'initiation',
        phases,
        startedAt: new Date().toISOString(),
        estimatedDuration: '8-10 minutes',
        metadata: {
          topic,
          options: validatedRequest.options,
          traceId: trace.id,
        },
        workflowExecutionId: workflowExecution.id,
      };

      asyncTasks.set(taskId, task);

      // Start the workflow asynchronously (fire and forget)
      executeDeepResearchWorkflow(taskId, topic, validatedRequest.options || {}, trace)
        .catch(error => {
          console.error(`Deep Research workflow error for task ${taskId}:`, error);
        });

      // Return immediate response with task information
      return res.json({
        taskId,
        status: 'initiated',
        estimatedDuration: task.estimatedDuration,
        pollUrl: `/api/a2a/task/${taskId}`,
        steps: {
          total: phases.length,
          current: 0,
          phases,
        },
        metadata: {
          type: 'deep-research',
          topic,
          workflowExecutionId: workflowExecution.id,
          traceId: trace.id,
        },
      });
    }

    // For non-deep-research types, fall back to synchronous processing
    // (delegate to the existing /api/request handler logic)
    
    res.status(400).json({
      error: `Type ${validatedRequest.type} not supported in async mode yet. Use /api/request for synchronous processing.`,
      supportedAsyncTypes: ['deep-research'],
    });

  } catch (error) {
    console.error('A2A Agents endpoint error:', error);
    
    // Complete workflow execution with error
    if (workflowExecution) {
      completeWorkflowExecution(
        workflowExecution.id, 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    
    // Mark trace as failed
    trace.event({
      name: 'request-failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        workflowExecutionId: workflowExecution?.id,
      },
    });
    
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      gateway: AGENT_ID,
      traceId: trace.id,
      workflowExecutionId: workflowExecution?.id,
    });
  }
});

export { router as a2aAgentsHandler };