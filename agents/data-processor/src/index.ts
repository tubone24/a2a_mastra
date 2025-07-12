import express from 'express';
import dotenv from 'dotenv';
import { mastra } from './mastra/index.js';
import { a2aRoutes } from './routes/a2aRoutes.js';
import { apiRoutes } from './routes/apiRoutes.js';
import { langfuse } from './mastra/workflows/taskProcessor.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

console.log('Langfuse client initialized:', {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ? 'SET' : 'NOT SET',
  secretKey: process.env.LANGFUSE_SECRET_KEY ? 'SET' : 'NOT SET',
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
});

// Mount routes
app.use('/api/a2a', a2aRoutes);
app.use('/api', apiRoutes);

// Standard Mastra agent endpoint
app.post('/api/agents/:agentId/generate', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { messages, threadId, resourceId } = req.body;
    
    // Validate agent exists
    const agent = mastra.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: `Agent ${agentId} not found`,
        availableAgents: [AGENT_ID] // This agent only has one agent registered
      });
    }
    
    // Generate response - pass messages as first argument
    const response = await agent.generate(messages, {
      threadId,
      resourceId
    });
    
    res.json(response);
  } catch (error) {
    console.error(`Agent ${req.params.agentId} generation error:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await langfuse.shutdownAsync();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await langfuse.shutdownAsync();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
  console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
  console.log(`Langfuse tracing enabled`);
});