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

// Tool schemas
export const braveWebSearchSchema = z.object({
  query: z.string().describe('The search query to execute'),
  count: z.number().optional().default(10).describe('Number of results to return (max 20)'),
  offset: z.number().optional().default(0).describe('Offset for pagination'),
  country: z.string().optional().default('US').describe('Country code for search results'),
  language: z.string().optional().default('en').describe('Language code for search results'),
  safesearch: z.enum(['strict', 'moderate', 'off']).optional().default('moderate').describe('Safe search setting'),
  freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional().describe('Freshness filter (past day, week, month, year)'),
  text_decorations: z.boolean().optional().default(false).describe('Include text decorations in results'),
});

export const braveNewsSearchSchema = z.object({
  query: z.string().describe('The news search query to execute'),
  count: z.number().optional().default(10).describe('Number of news results to return (max 20)'),
  offset: z.number().optional().default(0).describe('Offset for pagination'),
  country: z.string().optional().default('US').describe('Country code for news results'),
  language: z.string().optional().default('en').describe('Language code for news results'),
  freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional().describe('Freshness filter for news'),
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
  
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY environment variable is required');
  }

  const params = new URLSearchParams({
    q: input.query,
    count: input.count.toString(),
    offset: input.offset.toString(),
    country: input.country,
    safesearch: input.safesearch,
    text_decorations: input.text_decorations.toString(),
    result_filter: 'web',
  });

  if (input.language) {
    params.append('search_lang', input.language);
  }

  if (input.freshness) {
    params.append('freshness', input.freshness);
  }

  const response = await axios.get(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
      'Accept': 'application/json',
    },
    timeout: 10000,
  });

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

  const params = new URLSearchParams({
    q: input.query,
    count: input.count.toString(),
    offset: input.offset.toString(),
    country: input.country,
    search_lang: input.language,
  });

  if (input.freshness) {
    params.append('freshness', input.freshness);
  }

  const response = await axios.get(`https://api.search.brave.com/res/v1/news/search?${params}`, {
    headers: {
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
      'Accept': 'application/json',
    },
    timeout: 10000,
  });

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
}

// MCP Tool definitions
export const braveWebSearchTool = {
  id: 'brave_web_search',
  name: 'brave_web_search',
  description: 'Search the web using Brave Search API for current information',
  inputSchema: braveWebSearchSchema,
  execute: async (input: BraveWebSearchInput) => {
    try {
      const result = await performBraveWebSearch(input);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
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
    try {
      const result = await performBraveNewsSearch(input);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};