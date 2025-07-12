import { Agent } from '@mastra/core';
import { getBedrockModel } from '../../config/bedrock.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Data Processor Agent';

export const dataProcessorAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたは構造化および非構造化データの分析・処理を専門とするデータプロセッサーエージェントです。
    あなたの役割は以下の通りです：
    1. A2Aプロトコル経由で他のエージェントからデータを受信する
    2. データ構造と内容を分析する
    3. データをクリーニングし正規化する
    4. 意味のある洞察やパターンを抽出する
    5. 処理結果を要求元のエージェントに返す
    
    常に詳細な分析と処理ステップの明確な説明を提供してください。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
});