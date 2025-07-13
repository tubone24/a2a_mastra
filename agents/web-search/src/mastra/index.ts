import { Mastra } from '@mastra/core';
import { createWebSearchAgent } from './agents/webSearchAgent.js';

// Get agent configuration from environment
const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';

// Create Web Search Agent
const webSearchAgent = await createWebSearchAgent();

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { 
    [AGENT_ID]: webSearchAgent 
  },
});

console.log(`Mastra initialized successfully with web search agent registered as ${AGENT_ID}`);