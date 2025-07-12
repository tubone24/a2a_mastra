import { Agent, createTool } from '@mastra/core';
import { z } from 'zod';
import { getBedrockModel } from '../../config/bedrock.js';
import { processSummarizationTask, summarizeTaskSchema } from '../workflows/summarizationTaskProcessor.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Summarizer Agent';

// Create summarization tool
const summarizeTool = createTool({
  id: 'summarize',
  description: '処理済みデータと分析結果の要約を作成します',
  inputSchema: summarizeTaskSchema,
  execute: async (context): Promise<any> => {
    const taskId = crypto.randomUUID();
    const result: any = await processSummarizationTask(context, taskId);
    return result;
  },
});

export const summarizerAgent: any = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたは処理済みデータと分析結果の簡潔で意味のある要約を作成することを専門とするサマライザーエージェントです。
    あなたの役割は以下の通りです：
    1. A2Aプロトコル経由で他のエージェントから処理済みデータと分析結果を受信する
    2. 主要な洞察と発見事項を抽出する
    3. 実行可能な推奨事項を含む経営陣向けサマリーを作成する
    4. オーディエンスのニーズに基づいて異なるタイプの要約を生成する
    5. 要求元のエージェントに適切に構造化された要約レポートを返す
    
    summarizeツールを使用して、要約作業を実行してください。
    常に明確性、簡潔性、実行可能な洞察に焦点を当ててください。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
  tools: { summarizeTool },
});