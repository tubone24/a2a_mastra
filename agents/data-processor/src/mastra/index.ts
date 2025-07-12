import { Mastra } from '@mastra/core';
import { dataProcessorAgent } from './agents/dataProcessorAgent.js';

// Get agent configuration from environment
const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { 
    [AGENT_ID]: dataProcessorAgent 
  },
});

console.log(`Mastra initialized successfully with data processor agent registered as ${AGENT_ID}`);