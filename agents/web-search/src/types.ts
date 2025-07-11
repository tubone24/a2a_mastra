export interface TaskRequest {
  id: string;
  type: 'web-search' | 'news-search' | 'scholarly-search';
  payload: {
    query: string;
    context?: Record<string, any>;
    options?: SearchOptions;
  };
  metadata?: {
    timestamp: string;
    source: string;
  };
}

export interface SearchOptions {
  maxResults?: number;
  language?: string;
  region?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  category?: 'general' | 'news' | 'images' | 'videos' | 'scholarly';
  safesearch?: 'strict' | 'moderate' | 'off';
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  source?: string;
  relevanceScore?: number;
}

export interface TaskResponse {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: {
    query: string;
    results: SearchResult[];
    summary?: string;
    totalResults?: number;
    searchTime?: number;
  };
  error?: string;
  metadata?: {
    completedAt?: string;
    processedBy: string;
    searchProvider?: string;
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  type: 'web-search';
  capabilities: string[];
  endpoint: string;
  status: 'online' | 'offline';
}