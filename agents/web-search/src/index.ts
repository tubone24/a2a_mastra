import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialize } from './mastra/index.js';
import { createA2ARoutes } from './routes/a2aRoutes.js';
import { apiRoutes } from './routes/apiRoutes.js';
import { langfuse } from './mastra/workflows/searchTaskProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3004;
const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Web Search Agent';

console.log('Langfuse client initialized:', {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ? 'SET' : 'NOT SET',
  secretKey: process.env.LANGFUSE_SECRET_KEY ? 'SET' : 'NOT SET',
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
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
async function startServer() {
  try {
    // Initialize MCP client and agent
    const { mastra, webSearchAgent, mcpTools } = await initialize();
    
    // Mount routes - pass webSearchAgent to a2aRoutes
    app.use('/api/a2a', createA2ARoutes(webSearchAgent));
    app.use('/api', apiRoutes);
    app.use('/', apiRoutes); // Mount at root for health check
    
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
    
    app.listen(PORT, () => {
      console.log(`${AGENT_NAME} (${AGENT_ID}) listening on port ${PORT}`);
      console.log(`A2A Protocol endpoints available at http://localhost:${PORT}/api/a2a/`);
      console.log(`Langfuse tracing enabled`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();