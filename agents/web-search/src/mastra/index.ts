import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core';
import { initializeMCPClient } from '../utils/mcpClient.js';
import { createWebSearchAgent } from './agents/webSearchAgent.js';

// Get agent configuration from environment
const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';

let mcpTools: any = {};
let webSearchAgent: Agent;
let mastra: Mastra;

// Initialize everything
export async function initialize() {
  try {
    // Initialize MCP Client and get tools
    mcpTools = await initializeMCPClient();
    
    console.log('Search tools loaded:', Object.keys(mcpTools));

    // Create Web Search Agent with MCP tools
    webSearchAgent = createWebSearchAgent(mcpTools);

    // Initialize Mastra with agent
    mastra = new Mastra({
      agents: { 
        [AGENT_ID]: webSearchAgent 
      },
    });

    console.log(`Mastra initialized successfully with web search agent registered as ${AGENT_ID}`);
    
    return { mastra, webSearchAgent, mcpTools };
  } catch (error) {
    console.error('Failed to initialize application:', error);
    throw error;
  }
}