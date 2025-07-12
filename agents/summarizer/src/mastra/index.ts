import { Mastra } from '@mastra/core';
import { summarizerAgent } from './agents/summarizerAgent.js';

// Get agent configuration from environment
const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { 
    [AGENT_ID]: summarizerAgent 
  },
});

console.log(`Mastra initialized successfully with summarizer agent registered as ${AGENT_ID}`);