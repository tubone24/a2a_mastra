#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';

// Brave Search API types and schemas
interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  profile?: {
    score?: number;
  };
}

interface BraveWebResponse {
  web?: {
    results: BraveSearchResult[];
    total_count: number;
  };
}

interface BraveNewsResponse {
  news?: {
    results: BraveSearchResult[];
    total_count: number;
  };
}

// Input schemas
const braveWebSearchSchema = z.object({
  query: z.string().min(1).describe('The search query to execute'),
  count: z.number().min(1).max(20).optional().default(10).describe('Number of results to return (max 20)'),
});

const braveNewsSearchSchema = z.object({
  query: z.string().min(1).describe('The news search query to execute'),
  count: z.number().min(1).max(20).optional().default(10).describe('Number of news results to return (max 20)'),
});

// Search implementations
async function performBraveWebSearch(input: z.infer<typeof braveWebSearchSchema>) {
  const startTime = Date.now();
  
  console.error('=== Brave Web Search Called ===');
  console.error('Input:', JSON.stringify(input, null, 2));
  
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY environment variable is required');
  }

  if (!input.query || input.query.trim() === '') {
    throw new Error('Query parameter is required and cannot be empty');
  }

  const params: Record<string, string> = {
    q: input.query.trim()
  };

  if (input.count && input.count > 0 && input.count <= 20) {
    params.count = input.count.toString();
  }

  console.error('Request params:', params);
  
  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: params,
      headers: {
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip'
      },
      timeout: 15000,
    });

    console.error('Brave Search API response status:', response.status);
    
    const data: BraveWebResponse = response.data;
    const results = (data.web?.results || []).map((item: BraveSearchResult) => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.description || '',
      publishedDate: item.age || undefined,
      source: item.url ? new URL(item.url).hostname : undefined,
      relevanceScore: item.profile?.score || undefined,
    }));

    return {
      results,
      totalResults: data.web?.total_count || results.length,
      searchTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Brave Search API error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
    }
    throw error;
  }
}

async function performBraveNewsSearch(input: z.infer<typeof braveNewsSearchSchema>) {
  const startTime = Date.now();
  
  console.error('=== Brave News Search Called ===');
  console.error('Input:', JSON.stringify(input, null, 2));
  
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY environment variable is required');
  }

  if (!input.query || input.query.trim() === '') {
    throw new Error('Query parameter is required and cannot be empty');
  }

  const params: Record<string, string> = {
    q: input.query.trim()
  };

  if (input.count && input.count > 0 && input.count <= 20) {
    params.count = input.count.toString();
  }

  console.error('Request params:', params);
  
  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/news/search', {
      params: params,
      headers: {
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip'
      },
      timeout: 15000,
    });

    console.error('Brave News API response status:', response.status);
    
    const data: BraveNewsResponse = response.data;
    const results = (data.news?.results || []).map((item: BraveSearchResult) => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.description || '',
      publishedDate: item.age || undefined,
      source: item.url ? new URL(item.url).hostname : undefined,
      relevanceScore: item.profile?.score || undefined,
    }));

    return {
      results,
      totalResults: data.news?.total_count || results.length,
      searchTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Brave News API error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
    }
    throw error;
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'brave-search-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('=== MCP Server: ListTools called ===');
  return {
    tools: [
      {
        name: 'brave_web_search',
        description: 'Search the web using Brave Search API for current information',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to execute',
              minLength: 1,
            },
            count: {
              type: 'number',
              description: 'Number of results to return (max 20)',
              minimum: 1,
              maximum: 20,
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'brave_news_search',
        description: 'Search for news articles using Brave Search API',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The news search query to execute',
              minLength: 1,
            },
            count: {
              type: 'number',
              description: 'Number of news results to return (max 20)',
              minimum: 1,
              maximum: 20,
              default: 10,
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('=== MCP Server: CallTool called ===');
  console.error('Tool name:', request.params.name);
  console.error('Tool arguments:', JSON.stringify(request.params.arguments, null, 2));
  
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'brave_web_search': {
        const input = braveWebSearchSchema.parse(args);
        const result = await performBraveWebSearch(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'brave_news_search': {
        const input = braveNewsSearchSchema.parse(args);
        const result = await performBraveNewsSearch(input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error('Tool execution error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            success: false,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  console.error('Starting Brave Search MCP Server...');
  console.error('Available tools: brave_web_search, brave_news_search');
  console.error('Brave Search API Key present:', !!process.env.BRAVE_SEARCH_API_KEY);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Brave Search MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});