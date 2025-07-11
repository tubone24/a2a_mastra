import { z } from 'zod';
import axios from 'axios';

// Brave Search API response types
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

// Tool schemas based on official Brave Search API docs
export const braveWebSearchSchema = z.object({
  query: z.string().min(1).describe('The search query to execute'),
  count: z.number().min(1).max(20).optional().default(10).describe('Number of results to return (max 20)'),
});

export const braveNewsSearchSchema = z.object({
  query: z.string().min(1).describe('The news search query to execute'),
  count: z.number().min(1).max(20).optional().default(10).describe('Number of news results to return (max 20)'),
});

export type BraveWebSearchInput = z.infer<typeof braveWebSearchSchema>;
export type BraveNewsSearchInput = z.infer<typeof braveNewsSearchSchema>;

// Brave Web Search implementation
export async function performBraveWebSearch(input: BraveWebSearchInput): Promise<{
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    source?: string;
    relevanceScore?: number;
  }>;
  totalResults: number;
  searchTime: number;
}> {
  const startTime = Date.now();
  
  console.error('=== performBraveWebSearch CALLED ===');
  console.error('Function input:', JSON.stringify(input, null, 2));
  console.error('Input type:', typeof input);
  console.error('Input keys:', Object.keys(input || {}));
  console.error('Query value:', input?.query);
  console.error('Query type:', typeof input?.query);
  console.error('Query length:', input?.query?.length);
  console.error('=== END performBraveWebSearch DEBUG ===');
  
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY environment variable is required');
  }

  // Add debug logging
  console.log('Brave Web Search input:', JSON.stringify(input, null, 2));

  // Validate query is not empty (required by Brave Search API)
  if (!input.query || input.query.trim() === '') {
    console.error('EMPTY QUERY ERROR! Input received:', input);
    throw new Error('Query parameter is required and cannot be empty');
  }

  // Build request parameters exactly like the official example
  const params: Record<string, string> = {
    q: input.query.trim()
  };

  // Add optional parameters - use minimal set to avoid 422 errors
  if (input.count && input.count > 0 && input.count <= 20) {
    params.count = input.count.toString();
  }

  console.log('Brave Search API request params:', params);
  
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

    console.log('Brave Search API response status:', response.status);
    console.log('Brave Search API response data keys:', Object.keys(response.data));

    const data: BraveWebResponse = response.data;
    const results = (data.web?.results || []).map((item: BraveSearchResult) => ({
      title: item.title || '',
      error('Brave Search API error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      console.error('Request config:', {
        url: error.config?.url,
        params: error.config?.params,
        headers: error.config?.headers
      });
    }
    throw error;
  }
}

// Brave News Search implementation
export async function performBraveNewsSearch(input: BraveNewsSearchInput): Promise<{
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    source?: string;
    relevanceScore?: number;
  }>;
  totalResults: number;
  searchTime: number;
}> {
  const startTime = Date.now();
  
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY environment variable is required');
  }

  // Add debug logging
  console.log('Brave News Search input:', JSON.stringify(input, null, 2));

  // Validate query is not empty (required by Brave Search API)
  if (!input.query || input.query.trim() === '') {
    throw new Error('Query parameter is required and cannot be empty');
  }

  // Build request parameters exactly like the official example
  const params: Record<string, string> = {
    q: input.query.trim()
  };

  // Add optional parameters - use minimal set to avoid 422 errors
  if (input.count && input.count > 0 && input.count <= 20) {
    params.count = input.count.toString();
  }

  console.log('Brave News API request params:', params);
  
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

    console.log('Brave News API response status:', response.status);
    console.log('Brave News API response data keys:', Object.keys(response.data));

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
      console.error('Request config:', {
        url: error.config?.url,
        params: error.config?.params,
        headers: error.config?.headers
      });
    }
    throw error;
  }
}

// MCP Tool definitions
export const braveWebSearchTool = {
  id: 'brave_web_search',
  name: 'brave_web_search',
  description: 'Search the web using Brave Search API for current information',
  inputSchema: braveWebSearchSchema,
  execute: async function(input: any, ...args: any[]) {
    console.error('=== BRAVE WEB SEARCH TOOL EXECUTION START ===');
    console.error('Raw input received:', JSON.stringify(input, null, 2));
    console.error('Input type:', typeof input);
    console.error('Input keys:', Object.keys(input || {}));
    console.error('Query value:', input?.query);
    console.error('Query type:', typeof input?.query);
    console.error('Query length:', input?.query?.length);
    console.error('Count value:', input?.count);
    console.error('Arguments array:', arguments);
    console.error('Arguments length:', arguments.length);
    console.error('Additional args:', args);
    console.error('=== END DEBUG INFO ===');
    
    // Try to handle different input formats
    let processedInput: BraveWebSearchInput;
    
    if (typeof input === 'string') {
      console.error('Input is a string, trying to parse...');
      try {
        processedInput = JSON.parse(input);
      } catch {
        processedInput = { query: input, count: 10 };
      }
    } else if (input && typeof input === 'object') {
      processedInput = input as BraveWebSearchInput;
    } else {
      console.error('Invalid input format');
      return {
        success: false,
        error: 'Invalid input format',
      };
    }
    
    console.error('Processed input:', JSON.stringify(processedInput, null, 2));
    
    try {
      const result = await performBraveWebSearch(processedInput);
      console.error('Brave Web Search Tool SUCCESS');
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Brave Web Search Tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};

export const braveNewsSearchTool = {
  id: 'brave_news_search',
  name: 'brave_news_search',
  description: 'Search for news articles using Brave Search API',
  inputSchema: braveNewsSearchSchema,
  execute: async (input: BraveNewsSearchInput) => {
    console.log('=== BRAVE NEWS SEARCH TOOL EXECUTION ===');
    console.log('Raw input received:', JSON.stringify(input, null, 2));
    console.log('Input type:', typeof input);
    console.log('Input keys:', Object.keys(input || {}));
    console.log('Query value:', input?.query);
    console.log('Query type:', typeof input?.query);
    console.log('Query length:', input?.query?.length);
    console.log('=== END DEBUG INFO ===');
    
    try {
      const result = await performBraveNewsSearch(input);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Brave News Search Tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};