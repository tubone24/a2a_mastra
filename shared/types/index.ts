export interface TaskRequest {
  id: string;
  type: 'process' | 'summarize' | 'analyze';
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
  type: 'gateway' | 'processor' | 'summarizer';
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