import { Mastra } from '@mastra/core';
import { summarizerAgent } from './agents/summarizerAgent.js';

// Initialize Mastra with agent
export const mastra = new Mastra({
  agents: { summarizerAgent }, // Register the agent
});

console.log('Mastra initialized successfully with summarizer agent registered');