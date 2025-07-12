import { MCPClient } from '@mastra/mcp';

export async function initializeMCPClient() {
  try {
    const mcpClient = new MCPClient({
      servers: {
        'brave-search': {
          command: 'node',
          args: ['/app/standalone-mcp-server/dist/server.js'],
          env: {
            BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY || '',
          },
          timeout: 30000,
        },
      },
    });

    console.log('MCP Client initialized, getting tools...');

    // Get available tools from MCP server
    const tools = await mcpClient.getTools();
    console.log('Available MCP tools:', Object.keys(tools));
    
    // Debug: Show tool details
    for (const [toolName, tool] of Object.entries(tools)) {
      console.log(`Tool: ${toolName}`, { 
        description: (tool as any).description,
        inputSchema: (tool as any).inputSchema 
      });
    }

    return tools;
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    throw error;
  }
}