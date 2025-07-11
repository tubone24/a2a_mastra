export interface TaskRequest {
  id: string;
  type: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search';
  payload: {
    data: any;
    context?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    source: string;
  };
}

export interface TaskResponse {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  metadata?: {
    completedAt?: string;
    processedBy: string;
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  type: 'gateway' | 'processor' | 'summarizer' | 'web-search';
  capabilities: string[];
  endpoint: string;
  status: 'online' | 'offline';
}

export interface A2AMessage {
  from: string;
  to: string;
  content: string | TaskRequest;
  timestamp: string;
}

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  agentId: string;
  agentName: string;
  operation: string;
  input: any;
  output?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  traceId?: string;
}

export interface WorkflowExecution {
  id: string;
  requestId: string;
  type: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  steps: WorkflowStep[];
  metadata: {
    initiatedBy: string;
    startedAt: string;
    completedAt?: string;
    totalDuration?: number;
    dataSize?: number;
    audienceType?: string;
  };
  result?: any;
  error?: string;
  langfuseTraceId?: string;
}

export interface FlowHistory {
  executions: WorkflowExecution[];
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
}