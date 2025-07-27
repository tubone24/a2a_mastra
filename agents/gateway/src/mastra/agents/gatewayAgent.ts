import { Agent } from '@mastra/core';
import { AgentNetwork } from '@mastra/core/network';
import { getBedrockModel } from '../../config/bedrock.js';

const AGENT_NAME = process.env.AGENT_NAME || 'Gateway Agent';

// A2A Agent references (these represent remote agents that we communicate with via A2A)
export interface A2AAgentInfo {
  id: string;
  name: string;
  type: string;
  endpoint: string;
}

export const externalAgents: A2AAgentInfo[] = [
  {
    id: 'web-search-agent-01',
    name: 'Web Search Agent',
    type: 'web-search',
    endpoint: 'http://web-search:3001'
  },
  {
    id: 'data-processor-agent-01', 
    name: 'Data Processor Agent',
    type: 'data-processor',
    endpoint: 'http://data-processor:3001'
  },
  {
    id: 'summarizer-agent-01',
    name: 'Summarizer Agent', 
    type: 'summarizer',
    endpoint: 'http://summarizer:3001'
  }
];

// Create AgentNetwork coordinator that uses A2A for actual agent communication
export const agentNetwork = new AgentNetwork({
  name: 'Research Network Coordinator',
  instructions: `
    あなたは研究ネットワークのコーディネーターです。外部の専門エージェントとA2A通信を使って協調して複雑なタスクを解決します。
    
    利用可能な外部エージェント（A2A通信経由）：
    1. Web Search Agent (web-search-agent-01) - Web検索、ニュース検索、学術論文検索
    2. Data Processor Agent (data-processor-agent-01) - データ分析、処理、洞察抽出  
    3. Summarizer Agent (summarizer-agent-01) - 要約作成、レポート生成
    
    あなたの役割：
    - タスクを分析し、最適な実行戦略を決定する
    - 必要なエージェントを特定し、実行順序を決める
    - 各エージェントへのタスク分解と指示作成
    - A2A通信での実際の実行は別途行われる
    
    回答は以下のJSON形式で提供してください：
    {
      "approach": "single-agent | sequential | parallel",
      "agents": [
        {
          "name": "web-search | data-processor | summarizer",
          "task": "具体的なタスク内容",
          "priority": 1,
          "dependencies": []
        }
      ],
      "reasoning": "アプローチの理由"
    }
    
    すべての応答は日本語で行ってください。
  `,
  model: getBedrockModel(),
  agents: [], // No local agents - we use A2A communication
});

// External agents info is exported above

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