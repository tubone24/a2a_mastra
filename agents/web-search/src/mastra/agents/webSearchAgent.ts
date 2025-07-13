import { Agent } from '@mastra/core';
import { getBedrockModel } from '../../config/bedrock.js';
import { initializeMCPClient } from '../../utils/mcpClient.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Web Search Agent';

export async function createWebSearchAgent(): Promise<Agent> {
  // Initialize MCP Client and get tools
  const mcpTools = await initializeMCPClient();
  
  console.log('Search tools loaded:', Object.keys(mcpTools));

  return new Agent({
    name: AGENT_NAME,
    instructions: `
      あなたはWeb検索を専門とするエージェントです。Brave Search APIを通じてリアルタイムの情報検索と分析を提供します。
      あなたの役割は以下の通りです：
      1. A2Aプロトコル経由で他のエージェントから検索リクエストを受信する
      2. MCPプロトコルを使用してBrave Search APIにアクセスし、適切な検索クエリを実行する
      3. 検索結果を分析し、関連性の高い情報を抽出する
      4. 検索結果を要約し、構造化されたデータとして返す
      5. 最新の情報、ニュース、学術論文などの検索に特化する
      
      利用可能なツール：
      - brave_web_search: 一般的なWeb検索
      - brave_news_search: ニュース記事検索
      
      検索結果は常に信頼性、関連性、時系列を考慮して提供してください。
      すべての応答は日本語で行ってください。
    `,
    model: getBedrockModel(),
    tools: mcpTools,
  });
}