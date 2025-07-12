export interface AsyncTask {
  id: string;
  type: string;
  status: 'initiated' | 'working' | 'completed' | 'failed';
  progress: number;
  currentPhase: string;
  phases: string[];
  result?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  estimatedDuration?: string;
  metadata?: any;
  workflowExecutionId?: string;
  subTasks?: Map<string, AsyncTask>;
}

export const asyncTasks = new Map<string, AsyncTask>();
export let taskCounter = 0;