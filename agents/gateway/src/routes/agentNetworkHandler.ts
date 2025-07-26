import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { Langfuse } from 'langfuse';
import { agentNetwork, externalAgents, A2AAgentInfo } from '../mastra/agents/gatewayAgent.js';
import { sendA2AMessage } from '../utils/mastraA2AClient.js';
import { 
  createWorkflowExecution, 
  addWorkflowStep, 
  updateWorkflowStep, 
  completeWorkflowExecution,
  WorkflowExecution 
} from '../mastra/workflows/workflowManager.js';

const router = express.Router();

const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent Network';

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// Request schema for AgentNetwork
const agentNetworkRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  context: z.union([z.record(z.any()), z.undefined()]).optional(),
  options: z.object({
    enableA2A: z.boolean().optional().default(true),
    depth: z.enum(['basic', 'comprehensive', 'expert']).optional().default('comprehensive'),
    audienceType: z.enum(['technical', 'executive', 'general']).optional().default('general'),
    maxAgents: z.number().min(1).max(5).optional().default(3),
  }).optional().default({}),
});

// Enhanced AgentNetwork handler with A2A integration
router.post('/', async (req, res) => {
  const requestId = randomUUID();
  
  // Create Langfuse trace for the request
  const trace = langfuse.trace({
    id: requestId,
    name: 'agent-network-request',
    userId: req.headers['x-user-id'] as string || 'unknown',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      networkType: 'multi-agent-collaboration',
    },
    tags: ['gateway', 'agent-network', 'a2a-integration'],
  });

  let workflowExecution: WorkflowExecution | null = null;

  try {
    const validatedRequest = agentNetworkRequestSchema.parse(req.body);
    console.log(`AgentNetwork received query: ${validatedRequest.query.substring(0, 100)}...`);
    
    // Create workflow execution record
    workflowExecution = createWorkflowExecution(
      requestId,
      'agent-network',
      req.headers['x-user-id'] as string || 'anonymous',
      trace.id,
      JSON.stringify(validatedRequest).length,
      validatedRequest.options?.audienceType
    );
    
    // Add request details to trace
    trace.event({
      name: 'agent-network-request-received',
      metadata: {
        query: validatedRequest.query.substring(0, 200),
        hasContext: !!validatedRequest.context,
        enableA2A: validatedRequest.options?.enableA2A,
        depth: validatedRequest.options?.depth,
        workflowExecutionId: workflowExecution.id,
      },
    });

    let result: any;

    if (validatedRequest.options?.enableA2A) {
      // Enhanced A2A mode: 
      // 1. AgentNetwork (coordinator) analyzes task and creates execution plan
      // 2. A2A communication executes the plan with actual external agents
      console.log('Running AgentNetwork with True A2A integration...');
      console.log('Available external agents:', externalAgents.map(a => a.id));
      
      const networkSpan = trace.span({
        name: 'agent-network-with-a2a',
        metadata: { 
          mode: 'enhanced-a2a-integration',
          depth: validatedRequest.options.depth,
        },
      });

      // Step 1: Use AgentNetwork to analyze and plan the approach
      const planningStep = addWorkflowStep(
        workflowExecution!.id,
        AGENT_ID,
        'Agent Network Coordinator',
        'task-planning',
        {
          query: validatedRequest.query,
          context: validatedRequest.context,
          options: validatedRequest.options,
        },
        networkSpan.id
      );

      try {
        updateWorkflowStep(workflowExecution!.id, planningStep.id, { status: 'in_progress' });

        // Get network decision on how to approach the task
        const networkResponse = await agentNetwork.generate(
          `タスク分析と実行計画を作成してください：

クエリ: ${validatedRequest.query}

以下の点を考慮して、最適なアプローチを決定してください：
1. このタスクに必要な専門エージェント（Web Search, Data Processor, Summarizer）
2. 実行順序と各エージェントの役割
3. A2A通信で実際のエージェントに送信するべき具体的なタスク

回答は以下のJSON形式で提供してください:
{
  "approach": "single-agent | sequential | parallel",
  "agents": [
    {
      "name": "web-search | data-processor | summarizer",
      "task": "具体的なタスク内容",
      "priority": 1,
      "dependencies": []
    }
  ],
  "reasoning": "アプローチの理由"
}`,
          validatedRequest.context
        );

        const networkPlan = networkResponse.text;
        console.log('Network plan:', networkPlan);

        updateWorkflowStep(workflowExecution!.id, planningStep.id, { 
          status: 'completed', 
          output: networkPlan 
        });

        // Step 2: Parse the plan and execute via A2A
        let planJson: any;
        try {
          // Extract JSON from the response
          const jsonMatch = networkPlan.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            planJson = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON plan found in network response');
          }
        } catch (parseError) {
          console.warn('Failed to parse network plan as JSON, using fallback approach');
          planJson = {
            approach: 'sequential',
            agents: [
              { name: 'web-search', task: validatedRequest.query, priority: 1 },
              { name: 'data-processor', task: '検索結果を分析', priority: 2 },
              { name: 'summarizer', task: '最終レポートを作成', priority: 3 }
            ],
            reasoning: 'Fallback sequential approach'
          };
        }

        // Step 3: Execute the plan via A2A
        const executionResults: any[] = [];

        if (planJson.approach === 'parallel') {
          // Execute agents in parallel
          const parallelPromises = planJson.agents.map(async (agentPlan: any) => {
            const agentStep = addWorkflowStep(
              workflowExecution!.id,
              `${agentPlan.name}-agent-01`,
              `${agentPlan.name} Agent`,
              agentPlan.name,
              { task: agentPlan.task },
              networkSpan.id
            );

            try {
              updateWorkflowStep(workflowExecution!.id, agentStep.id, { status: 'in_progress' });

              const agentResponse = await sendA2AMessage(agentPlan.name as any, {
                type: agentPlan.name === 'web-search' ? 'comprehensive-search' : 
                      agentPlan.name === 'data-processor' ? 'research-analysis' :
                      'research-synthesis',
                query: validatedRequest.query,
                task: agentPlan.task,
                context: validatedRequest.context,
                options: validatedRequest.options,
              });

              const agentResult = extractA2AResult(agentResponse);
              
              updateWorkflowStep(workflowExecution!.id, agentStep.id, { 
                status: 'completed', 
                output: agentResult 
              });

              return { agent: agentPlan.name, result: agentResult };
            } catch (error) {
              updateWorkflowStep(workflowExecution!.id, agentStep.id, { 
                status: 'failed', 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
              throw error;
            }
          });

          const parallelResults = await Promise.all(parallelPromises);
          executionResults.push(...parallelResults);

        } else {
          // Execute agents sequentially
          let previousResult: any = null;

          for (const agentPlan of planJson.agents.sort((a: any, b: any) => a.priority - b.priority)) {
            const agentStep = addWorkflowStep(
              workflowExecution!.id,
              `${agentPlan.name}-agent-01`,
              `${agentPlan.name} Agent`,
              agentPlan.name,
              { 
                task: agentPlan.task,
                previousResult: previousResult ? 'Available' : 'None'
              },
              networkSpan.id
            );

            try {
              updateWorkflowStep(workflowExecution!.id, agentStep.id, { status: 'in_progress' });

              // Prepare the task based on previous results
              let taskData: any = {
                type: agentPlan.name === 'web-search' ? 'comprehensive-search' : 
                      agentPlan.name === 'data-processor' ? 'research-analysis' :
                      'research-synthesis',
                query: validatedRequest.query,
                task: agentPlan.task,
                context: validatedRequest.context,
                options: validatedRequest.options,
              };

              // Include previous results for dependent tasks
              if (previousResult && agentPlan.name !== 'web-search') {
                taskData.data = previousResult;
              }

              const agentResponse = await sendA2AMessage(agentPlan.name as any, taskData);
              const agentResult = extractA2AResult(agentResponse);
              
              updateWorkflowStep(workflowExecution!.id, agentStep.id, { 
                status: 'completed', 
                output: agentResult 
              });

              executionResults.push({ agent: agentPlan.name, result: agentResult });
              previousResult = agentResult;
            } catch (error) {
              updateWorkflowStep(workflowExecution!.id, agentStep.id, { 
                status: 'failed', 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
              throw error;
            }
          }
        }

        // Step 4: Compile final result
        result = {
          approach: planJson.approach,
          plan: planJson,
          executionResults,
          finalResult: executionResults[executionResults.length - 1]?.result || executionResults,
          metadata: {
            agentsUsed: planJson.agents.length,
            executionMode: planJson.approach,
            reasoning: planJson.reasoning,
          },
        };

        networkSpan.end({ output: result });

      } catch (error) {
        updateWorkflowStep(workflowExecution!.id, planningStep.id, { 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        networkSpan.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
        throw error;
      }

    } else {
      // Standard mode: Use AgentNetwork directly
      console.log('Running standard AgentNetwork...');
      
      const standardSpan = trace.span({
        name: 'agent-network-standard',
        metadata: { mode: 'standard-network-only' },
      });

      const networkStep = addWorkflowStep(
        workflowExecution!.id,
        AGENT_ID,
        'Agent Network',
        'direct-processing',
        {
          query: validatedRequest.query,
          context: validatedRequest.context,
        },
        standardSpan.id
      );

      try {
        updateWorkflowStep(workflowExecution!.id, networkStep.id, { status: 'in_progress' });

        const networkResponse = await agentNetwork.generate(
          validatedRequest.query,
          validatedRequest.context
        );

        result = {
          approach: 'direct-network',
          result: networkResponse.text,
          metadata: {
            mode: 'standard',
            tokensUsed: networkResponse.text.length,
          },
        };

        updateWorkflowStep(workflowExecution!.id, networkStep.id, { 
          status: 'completed', 
          output: result 
        });

        standardSpan.end({ output: result });
      } catch (error) {
        updateWorkflowStep(workflowExecution!.id, networkStep.id, { 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        standardSpan.end({ output: { error: error instanceof Error ? error.message : 'Unknown error' } });
        throw error;
      }
    }

    console.log('AgentNetwork processing completed');
    
    // Complete workflow execution successfully
    if (workflowExecution) {
      completeWorkflowExecution(workflowExecution.id, result);
    }
    
    // Mark trace as successful
    trace.event({
      name: 'agent-network-completed',
      metadata: {
        success: true,
        resultSize: JSON.stringify(result).length,
        workflowExecutionId: workflowExecution?.id,
        mode: validatedRequest.options?.enableA2A ? 'enhanced-a2a' : 'standard',
      },
    });

    res.json({
      status: 'success',
      type: 'agent-network',
      result,
      metadata: {
        completedAt: new Date().toISOString(),
        gateway: AGENT_ID,
        traceId: trace.id,
        workflowExecutionId: workflowExecution?.id,
        mode: validatedRequest.options?.enableA2A ? 'enhanced-a2a' : 'standard',
      },
    });

  } catch (error) {
    console.error('AgentNetwork error:', error);
    
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
      name: 'agent-network-failed',
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

// Helper function to extract results from A2A responses
function extractA2AResult(response: any): any {
  if (typeof response === 'string') {
    return response;
  }

  // Check if response has A2A task format with artifacts
  const taskArtifacts = response.task?.artifacts;
  if (taskArtifacts && taskArtifacts.length > 0) {
    const firstArtifact = taskArtifacts[0];
    return firstArtifact.data || firstArtifact;
  }

  // Try to extract from message parts
  const taskPart = response.task?.status?.message?.parts?.[0];
  const messagePart = response.message?.parts?.[0];
  
  if (taskPart && 'text' in taskPart) {
    return taskPart.text;
  } else if (messagePart && 'text' in messagePart) {
    return messagePart.text;
  }
  
  return response;
}

export { router as agentNetworkHandler };