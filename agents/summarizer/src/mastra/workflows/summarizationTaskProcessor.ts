import { z } from 'zod';
import { summarizerAgent } from '../agents/summarizerAgent.js';
import { Langfuse } from 'langfuse';

const AGENT_ID = process.env.AGENT_ID || 'summarizer-agent-01';
const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';

// Task schema for summarization
export const summarizeTaskSchema = z.object({
  type: z.enum(['summarize', 'executive-summary', 'brief', 'research-synthesis', 'comprehensive']),
  data: z.any(),
  context: z.record(z.any()).optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
  options: z.object({
    reportType: z.enum(['brief', 'comprehensive', 'detailed']).optional(),
    includeRecommendations: z.boolean().optional(),
    includeSources: z.boolean().optional(),
  }).optional(),
});

// Initialize Langfuse client for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// Helper function to process summarization tasks
export async function processSummarizationTask(task: any, taskId: string, parentTraceId?: string): Promise<any> {
  // Create Langfuse trace for this summarization task
  const trace = langfuse.trace({
    id: parentTraceId || undefined,
    name: 'summarization-task',
    metadata: {
      agent: AGENT_NAME,
      agentId: AGENT_ID,
      taskId: taskId,
      taskType: task?.type || 'unknown',
    },
    tags: ['summarizer', 'summarization-task'],
  });

  const validatedTask = summarizeTaskSchema.parse(task);
  const audienceType = validatedTask.audienceType || 'general';
  
  // Log task validation
  trace.event({
    name: 'task-validated',
    metadata: {
      type: validatedTask.type,
      audienceType: audienceType,
      dataSize: JSON.stringify(validatedTask.data).length,
      hasContext: !!validatedTask.context,
    },
  });
  
  let prompt = '';
  let summaryResult: any;
  
  switch (validatedTask.type) {
    case 'summarize':
      prompt = `
        以下のデータと分析の包括的な要約を作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を提供してください：
        1. 主要な発見事項の明確な概要
        2. 特定された重要な洞察とパターン
        3. 重要な統計やメトリクス
        4. 発見事項の潜在的な影響
        5. 推奨される次のステップやアクション
        
        対象オーディエンス: ${audienceType}
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        ${audienceType}オーディエンスに適した明確で構造化された形式で要約をフォーマットしてください。
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'executive-summary':
      prompt = `
        以下のデータと分析のエグゼクティブサマリーを作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を提供してください：
        1. 高レベルな概要（２－３文）
        2. 主要なビジネスへの影響
        3. 重要なメトリクスやＫＰＩ
        4. 戦略的推奨事項
        5. リスク要因や考慮事項
        
        簡潔でビジネスに焦点を当てた内容にしてください。最大２００語。
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'brief':
      prompt = `
        以下のデータと分析の簡潔な要約を作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下を提供してください：
        1. 一文での概要
        2. 上位３つの主要な発見事項
        3. 主要な推奨事項
        
        極めて簡潔にまとめてください。最大１００語。
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'research-synthesis':
      const reportType = validatedTask.options?.reportType || 'comprehensive';
      const includeRecommendations = validatedTask.options?.includeRecommendations !== false;
      const includeSources = validatedTask.options?.includeSources !== false;
      
      const searchResults = validatedTask.data.searchResults || {};
      const analysisResults = validatedTask.data.analysisResults || {};
      const topic = validatedTask.data.topic || 'Unknown Topic';
      
      prompt = `
        以下の研究データを包括的な研究レポートに統合してください：
        
        研究トピック: ${topic}
        
        検索結果データ:
        ${JSON.stringify(searchResults, null, 2)}
        
        分析結果データ:
        ${JSON.stringify(analysisResults, null, 2)}
        
        レポートタイプ: ${reportType}
        推奨事項含む: ${includeRecommendations ? 'はい' : 'いいえ'}
        ソース含む: ${includeSources ? 'はい' : 'いいえ'}
        対象オーディエンス: ${audienceType}
        
        以下の構造で包括的な研究レポートを作成してください：
        
        1. エグゼクティブサマリー
           - 研究の目的と範囲
           - 主要な発見事項（3-5点）
           - 重要な結論
        
        2. 主要な発見事項
           - 検索結果から特定された主要なトレンド
           - 分析で明らかになったパターンと洞察
           - 重要な統計やデータポイント
        
        3. 詳細な分析
           - データの信頼性と質の評価
           - 傾向分析と相関関係
           - 異常値や注目すべき事象
        
        ${includeRecommendations ? `4. 推奨事項と含意
           - 戦略的推奨事項
           - 実装のための次のステップ
           - 潜在的なリスクと機会` : ''}
        
        ${includeSources ? `5. 情報ソース
           - 主要な情報源の概要
           - データの信頼性評価` : ''}
        
        6. 制限事項と今後の研究
           - 現在の研究の制限
           - さらなる調査が必要な領域
        
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        ${audienceType}オーディエンス向けに適切な詳細レベルと専門用語を使用してください。
        回答は必ず日本語で行ってください。
      `;
      break;
      
    case 'comprehensive':
      prompt = `
        以下のデータと分析の包括的で詳細な要約を作成してください：
        ${JSON.stringify(validatedTask.data, null, 2)}
        
        以下の構造で非常に詳細な包括的レポートを作成してください：
        
        1. エグゼクティブサマリー
           - プロジェクトの概要と目的
           - 主要な発見事項（5-7点）
           - 重要な結論と含意
        
        2. 詳細な分析結果
           - データの品質と範囲の評価
           - 特定されたパターンと傾向の詳細分析
           - 統計的発見と数値データの解釈
           - 異常値や注目すべき事象の詳細
        
        3. 深い洞察と含意
           - データから導かれる戦略的洞察
           - ビジネスや技術への潜在的影響
           - 長期的な傾向と予測
           - リスク要因と機会の詳細分析
        
        4. 実行可能な推奨事項
           - 短期的な改善提案
           - 中長期的な戦略的推奨事項
           - 実装のためのロードマップ
           - 成功指標と測定方法
        
        5. 制限事項と今後の研究
           - 現在の分析の制限点
           - データギャップの特定
           - さらなる調査が必要な領域
           - 推奨される追加データ収集
        
        対象オーディエンス: ${audienceType}
        コンテキスト: ${validatedTask.context ? JSON.stringify(validatedTask.context) : '提供されていません'}
        
        ${audienceType}オーディエンスに適した専門性レベルで、非常に詳細で実用的な包括的レポートを作成してください。
        回答は必ず日本語で行ってください。
      `;
      break;
      
    default:
      throw new Error(`Unknown task type: ${validatedTask.type}`);
  }
  
  // Use Mastra Agent to create the summary with Langfuse tracing
  console.log('Calling summarizerAgent.generate() with prompt length:', prompt.length);
  
  const generation = trace.generation({
    name: 'summarization-llm-call',
    model: 'bedrock-claude',
    input: [{ role: "user", content: prompt }],
    metadata: {
      promptLength: prompt.length,
      summaryType: validatedTask.type,
      audienceType: audienceType,
    },
  });
  
  try {
    const result: any = await summarizerAgent.generate([
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
    
    summaryResult = {
      status: 'completed',
      processedBy: AGENT_ID,
      summary: result.text,
      metadata: {
        completedAt: new Date().toISOString(),
        summaryType: validatedTask.type,
        audienceType,
        originalDataSize: JSON.stringify(validatedTask.data).length,
        summaryLength: result.text.length,
        traceId: trace.id,
      },
    };
    
    // Log successful completion
    trace.event({
      name: 'summarization-completed',
      metadata: {
        summaryLength: result.text.length,
        success: true,
        audienceType: audienceType,
      },
    });
    
    return summaryResult;
    
  } catch (error) {
    generation.end({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    
    trace.event({
      name: 'summarization-failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      },
    });
    
    throw error;
  }
}

export { langfuse };