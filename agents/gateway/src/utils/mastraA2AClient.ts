import { MastraClient } from '@mastra/client-js';

const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';

// Initialize Mastra clients for each agent
const clients: Record<string, MastraClient> = {};

// Helper function to get or create Mastra client for an agent
function getAgentClient(agentId: string, baseUrl: string): MastraClient {
  if (!clients[agentId]) {
    clients[agentId] = new MastraClient({
      baseUrl,
      retries: 3,
      backoffMs: 300,
      maxBackoffMs: 5000,
    });
  }
  return clients[agentId];
}

// Get agent base URLs from environment
function getAgentBaseUrl(agentType: 'data-processor' | 'summarizer' | 'web-search'): string {
  switch (agentType) {
    case 'data-processor':
      return process.env.DATA_PROCESSOR_URL || 'http://data-processor:4111';
    case 'summarizer':
      return process.env.SUMMARIZER_URL || 'http://summarizer:4111';
    case 'web-search':
      return process.env.WEB_SEARCH_URL || 'http://web-search:4111';
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

// Get agent ID for each agent type
function getAgentId(agentType: 'data-processor' | 'summarizer' | 'web-search'): string {
  switch (agentType) {
    case 'data-processor':
      return process.env.DATA_PROCESSOR_AGENT_ID || 'data-processor-agent-01';
    case 'summarizer':
      return process.env.SUMMARIZER_AGENT_ID || 'summarizer-agent-01';
    case 'web-search':
      return process.env.WEB_SEARCH_AGENT_ID || 'web-search-agent-01';
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

// A2A helper function to send messages to other agents using Mastra Client
export async function sendA2AMessage(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any) {
  const baseUrl = getAgentBaseUrl(agentType);
  const targetAgentId = getAgentId(agentType);
  
  try {
    const client = getAgentClient(targetAgentId, baseUrl);
    const a2a = client.getA2A(targetAgentId);
    
    // Prepare message for agent using A2A protocol
    const messageId = crypto.randomUUID();
    const message = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Send A2A message using standard A2A protocol
    const response = await a2a.sendMessage({
      id: messageId,
      message: {
        role: "user",
        parts: [{
          type: "text",
          text: message
        }]
      }
    });
    
    console.log(`A2A response from ${agentType}:`, JSON.stringify(response, null, 2));
    
    // Return the complete A2A response to preserve artifacts and full data structure
    return response;
  } catch (error) {
    console.error(`Failed to send A2A message to ${agentType}:`, error);
    
    // Fallback to direct HTTP if Mastra client fails
    console.log(`Falling back to HTTP for ${agentType}...`);
    return await sendA2AMessageHTTP(agentType, content);
  }
}

// Fallback HTTP implementation for compatibility
async function sendA2AMessageHTTP(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any) {
  const baseUrl = getAgentBaseUrl(agentType);
  
  try {
    const messageId = crypto.randomUUID();
    
    const response = await fetch(`${baseUrl}/api/a2a/message`, {
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
      throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
    }
    
    const result: any = await response.json();
    console.log(`A2A HTTP response from ${agentType}:`, JSON.stringify(result, null, 2));
    
    // Handle new A2A format response
    if (result.task) {
      // Wait for task completion if it's in working state
      if (result.task.status?.state === "working") {
        console.log(`Waiting for ${agentType} task to complete...`);
        let taskId = result.task.id;
        
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const taskResponse = await fetch(`${baseUrl}/api/a2a/task/${taskId}`);
          if (taskResponse.ok) {
            const taskResult: any = await taskResponse.json();
            if (taskResult.task?.status?.state !== "working") {
              console.log(`Task completed for ${agentType}:`, JSON.stringify(taskResult, null, 2));
              // Return complete A2A response to preserve artifacts
              return taskResult;
            }
          } else {
            break;
          }
        }
      }
      
      // Return complete A2A response to preserve artifacts
      return result;
    }
    
    console.log(`Returning immediate result for ${agentType}:`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(`Failed to send A2A HTTP message to ${agentType}:`, error);
    throw new Error(`Failed to send A2A message to ${agentType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// A2A helper function to get agent card information
export async function getAgentCard(agentType: 'data-processor' | 'summarizer' | 'web-search') {
  const baseUrl = getAgentBaseUrl(agentType);
  const targetAgentId = getAgentId(agentType);
  
  try {
    // Try to get agent card through A2A protocol first
    const client = getAgentClient(targetAgentId, baseUrl);
    const a2a = client.getA2A(targetAgentId);
    
    return await a2a.getCard();
  } catch (error) {
    console.warn(`Failed to get agent card via A2A for ${agentType}, falling back to HTTP:`, error);
    
    // Fallback to direct HTTP for agent card discovery
    try {
      const response = await fetch(`${baseUrl}/api/a2a/agent`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (httpError) {
      console.warn(`Failed to get agent card for ${agentType}:`, httpError);
      return null;
    }
  }
}

// A2A helper function to send tasks to other agents
export async function sendA2ATask(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any): Promise<string> {
  const baseUrl = getAgentBaseUrl(agentType);
  const targetAgentId = getAgentId(agentType);
  
  try {
    const client = getAgentClient(targetAgentId, baseUrl);
    const a2a = client.getA2A(targetAgentId);
    
    // Convert task content to message format and create task using A2A protocol
    const message = typeof content === 'string' ? content : JSON.stringify(content);
    const taskId = `task-${Date.now()}`;
    
    // Create task using A2A protocol
    await a2a.sendMessage({
      id: crypto.randomUUID(),
      message: {
        role: "user",
        parts: [{
          type: "text",
          text: message
        }]
      }
    });
    
    console.log(`A2A task created for ${agentType}:`, taskId);
    return taskId;
  } catch (error) {
    console.error(`Failed to send A2A task to ${agentType}:`, error);
    
    // Fallback to HTTP implementation
    return await sendA2ATaskHTTP(agentType, content);
  }
}

// Fallback HTTP task implementation
async function sendA2ATaskHTTP(agentType: 'data-processor' | 'summarizer' | 'web-search', content: any): Promise<string> {
  const baseUrl = getAgentBaseUrl(agentType);
  
  try {
    const taskId = `task-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/a2a/task`, {
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
  } catch (error) {
    console.error(`Failed to send A2A HTTP task to ${agentType}:`, error);
    throw new Error(`Failed to send A2A task to ${agentType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// A2A helper function to poll task status
export async function pollTaskStatus(agentType: 'data-processor' | 'summarizer' | 'web-search', taskId: string): Promise<any> {
  const baseUrl = getAgentBaseUrl(agentType);
  
  try {
    // Use direct HTTP for task polling (legacy support)
    const response = await fetch(`${baseUrl}/api/a2a/task/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to poll task ${taskId} from ${agentType}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to poll task ${taskId} from ${agentType}:`, error);
    throw new Error(`Failed to poll task ${taskId} from ${agentType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}