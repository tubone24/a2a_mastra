import { Agent } from '@mastra/core';
import { getBedrockModel } from '../../config/bedrock.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

export const gatewayAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたはゲートウェイエージェントです。リクエストを受信し、適切なエージェントにルーティングします。
    受信したリクエストを分析し、データ処理や要約が必要かどうかを判断します。
    A2Aプロトコルを使用して他のエージェントと連携します。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
});