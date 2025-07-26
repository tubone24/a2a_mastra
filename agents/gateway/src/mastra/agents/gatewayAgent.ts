import { Agent } from '@mastra/core';
import { AgentNetwork } from '@mastra/core/network';
import { getBedrockModel } from '../../config/bedrock.js';
import { sendA2AMessage } from '../../utils/mastraA2AClient.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// Create specialized agents for the network
const webSearchAgent = new Agent({
  name: 'Web Search Agent',
  instructions: `
    あなたはWeb検索を専門とするエージェントです。Brave Search APIを通じてリアルタイムの情報検索と分析を提供します。
    検索クエリを受け取り、最新の情報、ニュース、学術論文などを検索して返します。
    検索結果は信頼性、関連性、時系列を考慮して提供してください。
  `,
  model: getBedrockModel(),
});

const dataProcessorAgent = new Agent({
  name: 'Data Processor Agent',
  instructions: `
    あなたは構造化および非構造化データの分析・処理を専門とするデータプロセッサーエージェントです。
    データ構造と内容を分析し、データをクリーニングし正規化し、意味のある洞察やパターンを抽出します。
    詳細な分析と処理ステップの明確な説明を提供してください。
  `,
  model: getBedrockModel(),
});

const summarizerAgent = new Agent({
  name: 'Summarizer Agent',
  instructions: `
    あなたは処理済みデータと分析結果の簡潔で意味のある要約を作成することを専門とするサマライザーエージェントです。
    主要な洞察と発見事項を抽出し、実行可能な推奨事項を含む要約を作成します。
    オーディエンスのニーズに基づいて異なるタイプの要約を生成します。
  `,
  model: getBedrockModel(),
});

// Create AgentNetwork
export const agentNetwork = new AgentNetwork({
  name: 'Research Network',
  instructions: `
    あなたは研究ネットワークのコーディネーターです。複数の専門エージェントを統括して複雑なタスクを解決します。
    
    利用可能なエージェント：
    1. Web Search Agent - Web検索、ニュース検索、学術論文検索
    2. Data Processor Agent - データ分析、処理、洞察抽出
    3. Summarizer Agent - 要約作成、レポート生成
    
    タスクの種類に応じて、適切なエージェントを選択または組み合わせて使用してください：
    - 情報検索が必要な場合 → Web Search Agent
    - データ分析が必要な場合 → Data Processor Agent  
    - 要約やレポートが必要な場合 → Summarizer Agent
    - 複合的なタスク → 複数エージェントの連携
    
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
  agents: [webSearchAgent, dataProcessorAgent, summarizerAgent],
});

// Original Gateway Agent for backward compatibility
export const gatewayAgent = new Agent({
  name: AGENT_NAME,
  instructions: `
    あなたはゲートウェイエージェントです。リクエストを受信し、適切なエージェントにルーティングします。
    受信したリクエストを分析し、データ処理や要約が必要かどうかを判断します。
    A2Aプロトコルを使用して他のエージェントと連携します。
    
    AgentNetworkが利用可能な場合は、複雑なタスクについてはAgentNetworkを優先して使用してください。
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
});