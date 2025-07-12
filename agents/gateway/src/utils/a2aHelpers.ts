import { taskCounter } from '../mastra/workflows/asyncTaskManager.js';

const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';

// A2A helper function to send asynchronous tasks to other agents
export async function sendA2ATask(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any): Promise<string> {
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
  
  const taskId = `sub-task-${taskCounter + 1}-${Date.now()}`;
  
  const response = await fetch(`${endpoint}/api/a2a/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId,
      from: AGENT_ID,
      ...content,
      timestamp: new Date().toISOString(),
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send task to ${agentType}: ${response.statusText}`);
  }
  
  const result: any = await response.json();
  return result.id || taskId;
}

// A2A helper function to poll task status
export async function pollTaskStatus(agentType: 'data-processor' | 'summarizer' | 'web-search', taskId: string): Promise<any> {
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
  
  const response = await fetch(`${endpoint}/api/a2a/task/${taskId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to poll task ${taskId} from ${agentType}: ${response.statusText}`);
  }
  
  return await response.json();
}

// A2A helper function to send messages to other agents using standard HTTP
export async function sendA2AMessage(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any) {
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
export async function getAgentCard(agentType: 'data-processor' | 'summarizer' | 'web-search') {
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