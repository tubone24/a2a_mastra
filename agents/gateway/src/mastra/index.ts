import { Mastra } from '@mastra/core';
import { gatewayAgent } from './agents/gatewayAgent.js';

// Get agent configuration from environment
const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { 
    [AGENT_ID]: gatewayAgent 
  },
});

console.log(`Mastra initialized successfully with gateway agent registered as ${AGENT_ID}`);