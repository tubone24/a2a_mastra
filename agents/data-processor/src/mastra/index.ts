import { Mastra } from '@mastra/core';
import { dataProcessorAgent } from './agents/dataProcessorAgent.js';

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { dataProcessorAgent }, // Register the agent
});

console.log('Mastra initialized successfully with agent registered');