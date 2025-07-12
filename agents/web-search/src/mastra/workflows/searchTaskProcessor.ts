import { z } from 'zod';
import { Langfuse } from 'langfuse';

const AGENT_ID = process.env.AGENT_ID || 'web-search-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Web Search Agent';

// Task schema for web search
export const searchTaskSchema = z.object({
  type: z.enum(['web-search', 'news-search', 'scholarly-search', 'comprehensive-search']),
  query: z.string(),
  context: z.record(z.any()).optional(),
  options: z.object({
    maxResults: z.number().optional().default(10),
    language: z.string().optional().default('en'),
    region: z.string().optional().default('us'),
    timeRange: z.enum(['day', 'week', 'month', 'year', 'all']).optional().default('all'),
    category: z.enum(['general', 'news', 'images', 'videos', 'scholarly']).optional().default('general'),
    safesearch: z.enum(['strict', 'moderate', 'off']).optional().default('moderate'),
    sources: z.array(z.enum(['web', 'news', 'academic', 'reports'])).optional().default(['web']),
  }).optional(),
});

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// Helper function to process search tasks
export async function processSearchTask(task: any, taskId: string, webSearchAgent: any, parentTraceId?: string) {
  // Create Langfuse trace for this search task
  const trace = langfuse.trace({
    id: parentTraceId || undefined,
    name: 'web-search-task',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      taskId: taskId,
      taskType: task?.type || 'unknown',
    },
    tags: ['web-search', 'search-task'],
  });

  let validatedTask;
  try {
    validatedTask = searchTaskSchema.parse(task);
  } catch (error) {
    console.error('Task validation failed:', error);
    console.error('Received task:', JSON.stringify(task, null, 2));
    throw new Error(`Invalid task format: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
  }
  
  // Log task validation
  trace.event({
    name: 'task-validated',
    metadata: {
      type: validatedTask.type,
      query: validatedTask.query,
      hasContext: !!validatedTask.context,
      maxResults: validatedTask.options?.maxResults || 10,
    },
  });
  
  let searchResult;
  
  try {
    // Determine search strategy based on task type
    let enhancedQuery = validatedTask.query;
    const originalOptions = validatedTask.options || {};
    let searchOptions: any = { ...originalOptions };
    
    switch (validatedTask.type) {
      case 'news-search':
        enhancedQuery = `latest news ${validatedTask.query}`;
        searchOptions = {
          ...searchOptions,
          timeRange: 'week',
          category: 'news',
        };
        break;
        
      case 'scholarly-search':
        enhancedQuery = `academic research ${validatedTask.query}`;
        searchOptions = {
          ...searchOptions,
          category: 'scholarly',
        };
        break;
        
      case 'comprehensive-search':
        // For comprehensive search, we'll perform multiple searches
        // with different strategies and combine results
        enhancedQuery = validatedTask.query;
        const currentMaxResults = searchOptions.maxResults || 10;
        searchOptions = {
          ...searchOptions,
          maxResults: Math.max(currentMaxResults, 15),
        };
        break;
        
      default: // web-search
        // Keep original query for general web search
        break;
    }

    // Perform web search with Langfuse tracing
    console.log('Performing web search with query:', enhancedQuery);
    
    const generation = trace.generation({
      name: 'web-search-execution',
      model: 'web-search-api',
      input: {
        query: enhancedQuery,
        options: searchOptions,
      },
      metadata: {
        searchType: validatedTask.type,
        queryLength: enhancedQuery.length,
      },
    });
    
    try {
      // Use Mastra Agent with MCP tools to perform search
      console.log('Using Agent with MCP tools for search...');
      
      // Create search prompt for the agent - use the correct tool names from standalone MCP server
      const toolName = validatedTask.type === 'news-search' ? 'brave-search_brave_news_search' : 'brave-search_brave_web_search';
      
      const searchParams = {
        query: enhancedQuery,
        count: Math.min((searchOptions as any)?.maxResults || 10, 20)
      };

      console.log('Search parameters for tool:', searchParams);
      console.log('Tool name to be used:', toolName);

      const searchPrompt = `
        検索クエリ「${enhancedQuery}」について${validatedTask.type === 'news-search' ? 'ニュース検索' : 'Web検索'}を実行してください。

        必ず「${toolName}」ツールを使用して以下のパラメータで検索を実行してください：
        
        ツール名: ${toolName}
        パラメータ:
        {
          "query": "${enhancedQuery}",
          "count": ${searchParams.count}
        }

        重要: 必ずツールを呼び出してください。ツールを使用せずに想像で回答しないでください。

        ツール実行後、結果を基に以下を日本語で提供してください：
        1. 検索結果の要約（3-5文）
        2. 最も関連性の高い情報のハイライト
        3. 信頼性の評価
        4. 追加の検索が必要な場合の提案
      `;

      generation.end({
        input: searchPrompt,
        metadata: {
          searchType: validatedTask.type,
          queryLength: enhancedQuery.length,
        },
      });

      // Use agent to perform search and analysis
      console.log('Sending prompt to agent:', searchPrompt);
      console.log('Enhanced query:', enhancedQuery);
      console.log('Search options:', searchOptions);
      
      const result = await webSearchAgent.generate([
        { 
          role: "user", 
          content: searchPrompt
        }
      ]);

      console.log('Agent result:', result);
      console.log('Agent response text:', result.text);

      searchResult = {
        status: 'completed',
        processedBy: AGENT_ID,
        result: {
          query: enhancedQuery,
          summary: result.text,
          fullResponse: result,
        },
        metadata: {
          completedAt: new Date().toISOString(),
          searchType: validatedTask.type,
          traceId: trace.id,
          searchProvider: 'Brave Search (via MCP + Agent)',
          usage: result.usage || {},
        },
      };

      // Log successful completion
      trace.event({
        name: 'search-completed',
        metadata: {
          success: true,
          responseLength: result.text.length,
          usage: result.usage || {},
        },
      });

    } catch (error) {
      trace.event({
        name: 'search-failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        },
      });
      
      throw error;
    }

  } catch (error) {
    searchResult = {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      processedBy: AGENT_ID,
      metadata: {
        completedAt: new Date().toISOString(),
        searchType: validatedTask.type,
        traceId: trace.id,
      },
    };
  }
  
  return searchResult;
}

export { langfuse };