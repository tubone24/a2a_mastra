import { WorkflowExecution, WorkflowStep } from '../../types.js';

// Re-export types for other modules
export type { WorkflowExecution, WorkflowStep };

// Workflow execution storage (in production, this would be a database)
export const workflowExecutions = new Map<string, WorkflowExecution>();
let executionCounter = 0;

export function createWorkflowExecution(
  requestId: string,
  type: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search' | 'deep-research',
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

export function addWorkflowStep(
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

export function updateWorkflowStep(
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

export function completeWorkflowExecution(
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