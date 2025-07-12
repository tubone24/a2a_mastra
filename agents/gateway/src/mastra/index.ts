import { Mastra } from '@mastra/core';
import { gatewayAgent } from './agents/gatewayAgent.js';

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { gatewayAgent }, // Register the agent
});

console.log('Mastra initialized successfully with gateway agent registered');