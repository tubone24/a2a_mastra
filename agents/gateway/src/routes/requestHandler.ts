import express from 'express';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { 
  createWorkflowExecution, 
  addWorkflowStep, 
  updateWorkflowStep, 
  completeWorkflowExecution,
  WorkflowExecution 
} from '../mastra/workflows/workflowManager.js';
import { sendA2AMessage } from '../utils/a2aHelpers.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// Agent IDs for A2A communication
const AGENT_IDS = {
  'data-processor': process.env.DATA_PROCESSOR_AGENT_ID || 'data-processor-agent-01',
  'summarizer': process.env.SUMMARIZER_AGENT_ID || 'summarizer-agent-01',
  'web-search': process.env.WEB_SEARCH_AGENT_ID || 'web-search-agent-01',
};

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

// Main request handler
router.post('/', async (req, res) => {
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

export { router as requestHandler, langfuse };