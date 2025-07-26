import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { mastra } from './mastra/index.js';
import { requestHandler, langfuse } from './routes/requestHandler.js';
import { a2aAgentsHandler } from './routes/a2aAgentsHandler.js';
import { a2aRoutes } from './routes/a2aRoutes.js';
import { workflowRoutes } from './routes/workflowRoutes.js';
import { agentNetworkHandler } from './routes/agentNetworkHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// 静的ファイルサービング（フロントエンド用）
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3001;
const AGENT_ID = process.env.AGENT_ID || 'gateway-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// Mount routes
app.use('/api/request', requestHandler);
app.use('/api/gateway/agents', a2aAgentsHandler);
app.use('/api/gateway', a2aRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/network', agentNetworkHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    agent: AGENT_NAME,
    agentId: AGENT_ID 
  });
});

// Legacy agent info endpoint for backward compatibility
app.get('/api/agent', (req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    type: 'gateway',
    capabilities: ['routing', 'orchestration'],
    endpoint: `http://gateway:${PORT}`,
    status: 'online',
  });
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
  console.log(`Gateway endpoints available at http://localhost:${PORT}/api/gateway/`);
  console.log(`AgentNetwork endpoint available at http://localhost:${PORT}/api/network/`);
  console.log(`Langfuse tracing enabled`);
});