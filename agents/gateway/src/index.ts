import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { getBedrockModel } from './config/bedrock.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Langfuse } from 'langfuse';
import { WorkflowExecution, WorkflowStep, FlowHistory } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// 静的ファイルサービング（フロントエンド用）
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3001;
const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// Create Gateway Agent first  
const gatewayAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたはゲートウェイエージェントです。リクエストを受信し、適切なエージェントにルーティングします。
    受信したリクエストを分析し、データ処理や要約が必要かどうかを判断します。
    A2Aプロトコルを使用して他のエージェントと連携します。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
});

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// Initialize Mastra with agent
const mastra = new Mastra({
  agents: { gatewayAgent }, // Register the agent
});

// Agent IDs for A2A communication
const AGENT_IDS = {
  'data-processor': process.env.DATA_PROCESSOR_AGENT_ID || 'data-processor-agent-01',
  'summarizer': process.env.SUMMARIZER_AGENT_ID || 'summarizer-agent-01',
  'web-search': process.env.WEB_SEARCH_AGENT_ID || 'web-search-agent-01',
};

// Workflow execution storage (in production, this would be a database)
const workflowExecutions = new Map<string, WorkflowExecution>();
let executionCounter = 0;


// Request schema
const requestSchema = z.object({
  type: z.enum(['process', 'summarize', 'analyze', 'web-search', 'news-search', 'scholarly-search']),
  data: z.any().optional(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
  query: z.string().optional(),
  searchOptions: z.object({
    maxResults: z.number().optional(),
    timeRange: z.enum(['day', 'week', 'month', 'year', 'all']).optional(),
    language: z.string().optional(),
    region: z.string().optional(),
    category: z.enum(['general', 'news', 'images', 'videos', 'scholarly']).optional(),
    safesearch: z.enum(['strict', 'moderate', 'off']).optional(),
  }).optional(),
});

// Helper functions for workflow management
function createWorkflowExecution(
  requestId: string,
  type: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search',
  initiatedBy: string,
  langfuseTraceId: string,
  dataSize?: number,
  audienceType?: string
): WorkflowExecution {
  const executionId = `exec-${++executionCounter}-${Date.now()}`;
  
  const execution: WorkflowExecution = {
    id: executionId,
    requestId,
    type,
    status: 'pending',
    steps: [],
    metadata: {
      initiatedBy,
      startedAt: new Date().toISOString(),
      dataSize,
      audienceType,
    },
    langfuseTraceId,
  };
  
  workflowExecutions.set(executionId, execution);
  return execution;
}

function addWorkflowStep(
  executionId: string,
  agentId: string,
  agentName: string,
  operation: string,
  input: any,
  traceId?: string
): WorkflowStep {
  const execution = workflowExecutions.get(executionId);
  if (!execution) {
    throw new Error(`Workflow execution ${executionId} not found`);
  }
  
  const stepId = `step-${execution.steps.length + 1}-${Date.now()}`;
  const step: WorkflowStep = {
    id: stepId,
    stepNumber: execution.steps.length + 1,
    agentId,
    agentName,
    operation,
    input,
    status: 'pending',
    startedAt: new Date().toISOString(),
    traceId,
  };
  
  execution.steps.push(step);
  execution.status = 'in_progress';
  workflowExecutions.set(executionId, execution);
  
  return step;
}

function updateWorkflowStep(
  executionId: string,
  stepId: string,
  updates: Partial<WorkflowStep>
): void {
  const execution = workflowExecutions.get(executionId);
  if (!execution) {
    throw new Error(`Workflow execution ${executionId} not found`);
  }
  
  const stepIndex = execution.steps.findIndex((s: WorkflowStep) => s.id === stepId);
  if (stepIndex === -1) {
    throw new Error(`Step ${stepId} not found in execution ${executionId}`);
  }
  
  const step = execution.steps[stepIndex];
  Object.assign(step, updates);
  
  if (updates.status === 'completed' && !step.completedAt) {
    step.completedAt = new Date().toISOString();
    step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
  }
  
  workflowExecutions.set(executionId, execution);
}

function completeWorkflowExecution(
  executionId: string,
  result?: any,
  error?: string
): void {
  const execution = workflowExecutions.get(executionId);
  if (!execution) {
    throw new Error(`Workflow execution ${executionId} not found`);
  }
  
  execution.metadata.completedAt = new Date().toISOString();
  execution.metadata.totalDuration = new Date(execution.metadata.completedAt).getTime() - 
    new Date(execution.metadata.startedAt).getTime();
  
  if (error) {
    execution.status = 'failed';
    execution.error = error;
  } else {
    execution.status = 'completed';
    execution.result = result;
  }
  
  workflowExecutions.set(executionId, execution);
}

// A2A helper function to send messages to other agents using standard HTTP
async function sendA2AMessage(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any) {
  let endpoint: string;
  switch (agentType) {
    case 'data-processor':
      endpoint = process.env.DATA_PROCESSOR_URL || 'http://data-processor:3002';
      break;
    case 'summarizer':
      endpoint = process.env.SUMMARIZER_URL || 'http://summarizer:3003';
      break;
    case 'web-search':
      endpoint = process.env.WEB_SEARCH_URL || 'http://web-search:3004';
      break;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
  
  const messageId = crypto.randomUUID();
  
  const response = await fetch(`${endpoint}/api/a2a/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: messageId,
      from: AGENT_ID,
      message: {
        role: "user",
        parts: [{
          type: "text",
          text: JSON.stringify(content)
        }]
      },
      timestamp: new Date().toISOString(),
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send message to ${agentType}: ${response.statusText}`);
  }
  
  const result: any = await response.json();
  
  // Wait for task completion if it's in working state
  if (result.task?.status?.state === "working") {
    console.log(`Waiting for ${agentType} task to complete...`);
    let taskId = result.task.id;
    
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const taskResponse = await fetch(`${endpoint}/api/a2a/task/${taskId}`);
      if (taskResponse.ok) {
        const task: any = await taskResponse.json();
        if (task.status.state !== "working") {
          return task.result || task;
        }
      } else {
        break;
      }
    }
  }
  
  return result.task?.result || result;
}

// A2A helper function to get agent information
async function getAgentCard(agentType: 'data-processor' | 'summarizer' | 'web-search') {
  let endpoint: string;
  switch (agentType) {
    case 'data-processor':
      endpoint = process.env.DATA_PROCESSOR_URL || 'http://data-processor:3002';
      break;
    case 'summarizer':
      endpoint = process.env.SUMMARIZER_URL || 'http://summarizer:3003';
      break;
    case 'web-search':
      endpoint = process.env.WEB_SEARCH_URL || 'http://web-search:3004';
      break;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
  
  try {
    const response = await fetch(`${endpoint}/api/a2a/agent`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn(`Failed to get agent card for ${agentType}:`, error);
    return null;
  }
}

// Main request handler
app.post('/api/request', async (req, res) => {
  const requestId = crypto.randomUUID();
  
  // Create Langfuse trace for the request
  const trace = langfuse.trace({
    id: requestId,
    name: 'gateway-request',
    userId: req.headers['x-user-id'] as string || 'unknown',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      requestType: req.body?.type || 'unknown',
    },
    tags: ['gateway', 'a2a-routing'],
  });

  let workflowExecution: WorkflowExecution | null = null;

  try {
    const validatedRequest = requestSchema.parse(req.body);
    console.log(`Gateway received request of type: ${validatedRequest.type}`);
    
    // Create workflow execution record
    const dataSize = validatedRequest.data != null ? JSON.stringify(validatedRequest.data).length : 0;
    workflowExecution = createWorkflowExecution(
      requestId,
      validatedRequest.type,
      req.headers['x-user-id'] as string || 'anonymous',
      trace.id,
      dataSize,
      validatedRequest.audienceType
    );
    
    // Add request details to trace
    const traceDataSize = validatedRequest.data != null ? JSON.stringify(validatedRequest.data).length : 0;
    trace.event({
      name: 'request-received',
      metadata: {
        type: validatedRequest.type,
        dataSize: traceDataSize,
        hasContext: !!validatedRequest.context,
        workflowExecutionId: workflowExecution.id,
      },
    });

    let result: any;

    switch (validatedRequest.type) {
      case 'process':
        // Send processing task to data-processor agent
        console.log('Routing to data-processor agent...');
        const processSpan = trace.span({
          name: 'route-to-data-processor',
          metadata: { targetAgent: 'data-processor' },
        });
        
        // Record workflow step
        const processStep = addWorkflowStep(
          workflowExecution.id,
          AGENT_IDS['data-processor'],
          'Data Processor Agent',
          'data-processing',
          {
            type: 'process',
            data: validatedRequest.data || {},
            context: validatedRequest.context,
          },
          processSpan.id
        );
        
        try {
          updateWorkflowStep(workflowExecution.id, processStep.id, { status: 'in_progress' });
          
          result = await sendA2AMessage('data-processor', {
            type: 'process',
            data: validatedRequest.data || {},
            context: validatedRequest.context,
          });
          
          updateWorkflowStep(workflowExecution.id, processStep.id, { 
            status: 'completed', 
            output: result 
          });
          
          processSpan.end({ output: result });
        } catch (error) {
          updateWorkflowStep(workflowExecution.id, processStep.id, { 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          processSpan.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
          throw error;
        }
        break;

      case 'summarize':
        // Send summarization task to summarizer agent
        console.log('Routing to summarizer agent...');
        const summarizeSpan = trace.span({
          name: 'route-to-summarizer',
          metadata: { 
            targetAgent: 'summarizer',
            audienceType: validatedRequest.audienceType || 'general'
          },
        });
        
        // Record workflow step
        const summarizeStep = addWorkflowStep(
          workflowExecution.id,
          AGENT_IDS['summarizer'],
          'Summarizer Agent',
          'summarization',
          {
            type: 'summarize',
            data: validatedRequest.data || {},
            context: validatedRequest.context,
            audienceType: validatedRequest.audienceType || 'general',
          },
          summarizeSpan.id
        );
        
        try {
          updateWorkflowStep(workflowExecution.id, summarizeStep.id, { status: 'in_progress' });
          
          result = await sendA2AMessage('summarizer', {
            type: 'summarize',
            data: validatedRequest.data || {},
            context: validatedRequest.context,
            audienceType: validatedRequest.audienceType || 'general',
          });
          
          updateWorkflowStep(workflowExecution.id, summarizeStep.id, { 
            status: 'completed', 
            output: result 
          });
          
          summarizeSpan.end({ output: result });
        } catch (error) {
          updateWorkflowStep(workflowExecution.id, summarizeStep.id, { 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          summarizeSpan.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
          throw error;
        }
        break;

      case 'analyze':
        // First process with data-processor, then summarize with summarizer
        console.log('Starting analysis workflow: data-processor -> summarizer');
        
        const analyzeWorkflowSpan = trace.span({
          name: 'analyze-workflow',
          metadata: { 
            workflow: 'data-processor -> summarizer',
            audienceType: validatedRequest.audienceType || 'executive'
          },
        });
        
        try {
          // Step 1: Process the data
          const step1Span = trace.span({
            name: 'analyze-step1-data-processing',
            metadata: { targetAgent: 'data-processor' },
          });
          
          const step1 = addWorkflowStep(
            workflowExecution.id,
            AGENT_IDS['data-processor'],
            'Data Processor Agent',
            'data-analysis',
            {
              type: 'analyze',
              data: validatedRequest.data || {},
              context: validatedRequest.context,
            },
            step1Span.id
          );
          
          let processResult;
          try {
            updateWorkflowStep(workflowExecution.id, step1.id, { status: 'in_progress' });
            
            processResult = await sendA2AMessage('data-processor', {
              type: 'analyze',
              data: validatedRequest.data || {},
              context: validatedRequest.context,
            });
            
            updateWorkflowStep(workflowExecution.id, step1.id, { 
              status: 'completed', 
              output: processResult 
            });
            
            step1Span.end({ output: processResult });
          } catch (error) {
            updateWorkflowStep(workflowExecution.id, step1.id, { 
              status: 'failed', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            step1Span.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
            throw error;
          }

          // Step 2: Summarize the processed results
          const step2Span = trace.span({
            name: 'analyze-step2-summarization',
            metadata: { 
              targetAgent: 'summarizer',
              audienceType: validatedRequest.audienceType || 'executive'
            },
          });
          
          const step2 = addWorkflowStep(
            workflowExecution.id,
            AGENT_IDS['summarizer'],
            'Summarizer Agent',
            'executive-summary',
            {
              type: 'executive-summary',
              data: processResult,
              context: {
                ...validatedRequest.context,
                workflow: 'analyze',
                previousStep: 'data-processing',
              },
              audienceType: validatedRequest.audienceType || 'executive',
            },
            step2Span.id
          );
          
          let summaryResult;
          try {
            updateWorkflowStep(workflowExecution.id, step2.id, { status: 'in_progress' });
            
            summaryResult = await sendA2AMessage('summarizer', {
              type: 'executive-summary',
              data: processResult,
              context: {
                ...validatedRequest.context,
                workflow: 'analyze',
                previousStep: 'data-processing',
              },
              audienceType: validatedRequest.audienceType || 'executive',
            });
            
            updateWorkflowStep(workflowExecution.id, step2.id, { 
              status: 'completed', 
              output: summaryResult 
            });
            
            step2Span.end({ output: summaryResult });
          } catch (error) {
            updateWorkflowStep(workflowExecution.id, step2.id, { 
              status: 'failed', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            step2Span.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
            throw error;
          }

          result = {
            workflow: 'analyze',
            steps: {
              processing: processResult,
              summary: summaryResult,
            },
            final_result: summaryResult,
          };
          
          analyzeWorkflowSpan.end({ output: result });
        } catch (error) {
          analyzeWorkflowSpan.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
          throw error;
        }
        break;

      case 'web-search':
      case 'news-search':
      case 'scholarly-search':
        // Send search task to web-search agent
        console.log(`Routing ${validatedRequest.type} to web-search agent...`);
        const searchSpan = trace.span({
          name: `route-to-web-search-${validatedRequest.type}`,
          metadata: { 
            targetAgent: 'web-search',
            searchType: validatedRequest.type,
            query: validatedRequest.query || 'data search'
          },
        });
        
        // Record workflow step
        const searchQuery = validatedRequest.query || (validatedRequest.data != null ? JSON.stringify(validatedRequest.data) : '');
        const searchStep = addWorkflowStep(
          workflowExecution.id,
          AGENT_IDS['web-search'],
          'Web Search Agent',
          validatedRequest.type,
          {
            type: validatedRequest.type,
            query: searchQuery,
            context: validatedRequest.context,
            options: validatedRequest.searchOptions,
          },
          searchSpan.id
        );
        
        try {
          updateWorkflowStep(workflowExecution.id, searchStep.id, { status: 'in_progress' });
          
          const searchMessageQuery = validatedRequest.query || (validatedRequest.data != null ? JSON.stringify(validatedRequest.data) : '');
          result = await sendA2AMessage('web-search', {
            type: validatedRequest.type,
            query: searchMessageQuery,
            context: validatedRequest.context,
            options: validatedRequest.searchOptions,
          });
          
          updateWorkflowStep(workflowExecution.id, searchStep.id, { 
            status: 'completed', 
            output: result 
          });
          
          searchSpan.end({ output: result });
        } catch (error) {
          updateWorkflowStep(workflowExecution.id, searchStep.id, { 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          searchSpan.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
          throw error;
        }
        break;

      default:
        throw new Error('Unknown request type');
    }

    console.log(`Gateway completed ${validatedRequest.type} request`);
    
    // Complete workflow execution successfully
    if (workflowExecution) {
      completeWorkflowExecution(workflowExecution.id, result);
    }
    
    // Mark trace as successful
    const resultSize = result != null ? JSON.stringify(result).length : 0;
    trace.event({
      name: 'request-completed',
      metadata: {
        type: validatedRequest.type,
        success: true,
        resultSize: resultSize,
        workflowExecutionId: workflowExecution?.id,
      },
    });

    res.json({
      status: 'success',
      type: validatedRequest.type,
      result,
      metadata: {
        completedAt: new Date().toISOString(),
        gateway: AGENT_ID,
        traceId: trace.id,
        workflowExecutionId: workflowExecution?.id,
      },
    });

  } catch (error) {
    console.error('Gateway error:', error);
    
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID 
  });
});

// Workflow History API Endpoints

// Get all workflow executions
app.get('/api/workflows', (req, res) => {
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
app.get('/api/workflows/:executionId', (req, res) => {
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
app.get('/api/workflows/:executionId/steps', (req, res) => {
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
app.get('/api/workflows/stats/summary', (req, res) => {
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

// A2A Protocol Endpoints

// Agent Card endpoint (A2A discovery)
app.get('/api/a2a/agent', (req, res) => {
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

// Legacy agent info endpoint for backward compatibility
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'gateway',
    capabilities: ['routing', 'orchestration'],
    endpoint: `http://gateway:${PORT}`,
    status: 'online',
  });
});

// A2A Message handling endpoint
app.post('/api/a2a/message', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A message:`, req.body);
    
    const { from, message } = req.body;
    
    // Process the message using the gateway agent
    const response = await gatewayAgent.generate([
      { role: "user", content: message.parts[0].text }
    ]);
    
    res.json({
      id: crypto.randomUUID(),
      from: AGENT_ID,
      to: from,
      message: {
        role: "assistant",
        parts: [{
          type: "text",
          text: response.text
        }]
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

// A2A Task creation endpoint
app.post('/api/a2a/task', async (req, res) => {
  try {
    console.log(`${AGENT_NAME} received A2A task:`, req.body);
    
    const taskId = crypto.randomUUID();
    
    // Handle the task and return task information
    res.json({
      id: taskId,
      status: {
        state: 'completed',
        message: 'Task completed by gateway agent'
      },
      result: {
        processedBy: AGENT_ID,
        completedAt: new Date().toISOString(),
        message: 'Task routed and processed successfully'
      }
    });
    
  } catch (error) {
    console.error(`${AGENT_NAME} task processing error:`, error);
    res.status(500).json({
      id: req.body.id || crypto.randomUUID(),
      status: {
        state: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// A2A Get Task endpoint
app.get('/api/a2a/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // Return task status (in a real implementation, this would be stored)
  res.json({
    id: taskId,
    status: {
      state: 'completed',
      message: 'Task completed'
    },
    result: {
      processedBy: AGENT_ID,
      completedAt: new Date().toISOString(),
    }
  });
});

// Agent discovery endpoint - lists connected agents
app.get('/api/a2a/agents', async (req, res) => {
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

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await langfuse.shutdownAsync();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await langfuse.shutdownAsync();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
  console.log(`Langfuse tracing enabled`);
});