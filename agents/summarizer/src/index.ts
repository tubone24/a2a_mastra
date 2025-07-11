import express from 'express';
import dotenv from 'dotenv';
import { mastra } from './mastra/index.js';
import { a2aRoutes } from './routes/a2aRoutes.js';
import { apiRoutes } from './routes/apiRoutes.js';
import { langfuse } from './mastra/workflows/summarizationTaskProcessor.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';

// Mount routes
app.use('/api/a2a', a2aRoutes);
app.use('/api', apiRoutes);
app.use('/', apiRoutes); // Mount at root for health check

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