#!/usr/bin/env node

import { MCPServer } from '@mastra/mcp';
import { braveWebSearchTool, braveNewsSearchTool } from './tools/braveSearch.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create MCP server with Brave Search tools
const server = new MCPServer({
  name: 'brave-search-mcp-server',
  version: '1.0.0',
  tools: {
    brave_web_search: braveWebSearchTool,
    brave_news_search: braveNewsSearchTool,
  },
});

// Start the server
console.error('Starting Brave Search MCP server...');
server.startStdio().then(() => {
  console.error('Brave Search MCP server started successfully');
}).catch((error) => {
  console.error('Error running Brave Search MCP server:', error);
  process.exit(1);
});