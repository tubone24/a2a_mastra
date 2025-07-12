import { z } from 'zod';
import { dataProcessorAgent } from '../agents/dataProcessorAgent.js';
import { Langfuse } from 'langfuse';

const AGENT_ID = process.env.AGENT_ID || 'data-processor-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

// Task schema for data processing
export const processTaskSchema = z.object({
  type: z.enum(['process', 'analyze', 'research-analysis']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  options: z.object({
    analyzePatterns: z.boolean().optional(),
    extractInsights: z.boolean().optional(),
    depth: z.enum(['basic', 'comprehensive', 'expert']).optional(),
  }).optional(),
});

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

export async function processTask(task: any, taskId: string, parentTraceId?: string) {
  // Create Langfuse trace for this processing task
  const trace = langfuse.trace({
    id: parentTraceId || undefined,
    name: 'data-processing-task',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      taskId: taskId,
      taskType: task?.type || 'unknown',
    },
    tags: ['data-processor', 'processing-task'],
  });

  const validatedTask = processTaskSchema.parse(task);
  
  // Log task validation
  trace.event({
    name: 'task-validated',
    metadata: {
      type: validatedTask.type,
      dataSize: JSON.stringify(validatedTask.data).length,
      hasContext: !!validatedTask.context,
    },
  });
  
  let prompt = '';
  let processedResult;
  
  switch (validatedTask.type) {
    case 'process':
      prompt = `
        以下のデータを処理・分析してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を実行してください：
        1. データ構造とフォーマットを特定する
        2. 不整合をクリーニングし正規化する
        3. 主要なパターンや洞察を抽出する
        4. 発見事項の要約を提供する
        5. 処理済みデータを構造化された形式で返す
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'analyze':
      prompt = `
        以下のデータに対して詳細な分析を実行してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を実行してください：
        1. トレンド、パターン、異常値を特定する
        2. 該当する統計値を計算する（該当する場合）
        3. 洞察と推奨事項を提供する
        4. 潜在的なデータ品質の問題を強調する
        5. さらなる処理のための次のステップを提案する
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'research-analysis':
      const depth = validatedTask.options?.depth || 'comprehensive';
      const shouldAnalyzePatterns = validatedTask.options?.analyzePatterns !== false;
      const shouldExtractInsights = validatedTask.options?.extractInsights !== false;
      
      prompt = `
        以下は研究目的のデータセットです。詳細な研究分析を実行してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        分析レベル: ${depth}
        パターン分析: ${shouldAnalyzePatterns ? '実行する' : 'スキップ'}
        洞察抽出: ${shouldExtractInsights ? '実行する' : 'スキップ'}
        
        以下を実行してください：
        1. データソースと信頼性の評価
        2. 構造化された分析フレームワークの適用
        ${shouldAnalyzePatterns ? '3. 深いパターン分析と相関関係の特定' : ''}
        ${shouldExtractInsights ? '4. 戦略的洞察と示唆の抽出' : ''}
        5. 研究仮説や質問に対する証拠の評価
        6. 制限事項と潜在的バイアスの特定
        7. さらなる研究の方向性の提案
        8. 実用的な含意と提案の提供
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        分析結果は以下の構造で返してください：
        - データ概要
        - 主要な発見事項
        - パターンと傾向
        - 洞察と含意
        - 制限事項
        - 提案事項
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    default:
      throw new Error(`Unknown task type: ${validatedTask.type}`);
  }
  
  // Use Mastra Agent to process the data with Langfuse tracing
  console.log('Calling dataProcessorAgent.generate() with prompt length:', prompt.length);
  
  const generation = trace.generation({
    name: 'data-processing-llm-call',
    model: 'bedrock-claude',
    input: [{ role: "user", content: prompt }],
    metadata: {
      promptLength: prompt.length,
      processingType: validatedTask.type,
    },
  });
  
  try {
    const result = await dataProcessorAgent.generate([
      { role: "user", content: prompt }
    ]);
    console.log('Agent response received, length:', result.text.length);
    
    generation.end({
      output: result.text,
      metadata: {
        responseLength: result.text.length,
        usage: result.usage || {},
      },
    });
    
    processedResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      result: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        processingType: validatedTask.type,
        originalDataSize: JSON.stringify(validatedTask.data).length,
        traceId: trace.id,
      },
    };
    
    // Log successful completion
    trace.event({
      name: 'processing-completed',
      metadata: {
        resultSize: result.text.length,
        success: true,
      },
    });
    
  } catch (error) {
    generation.end({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    
    trace.event({
      name: 'processing-failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      },
    });
    
    throw error;
  }
  
  return processedResult;
}

export { langfuse };