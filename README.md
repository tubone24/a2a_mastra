# Mastra A2A Demo

MastraのAgent-to-Agent (A2A)プロトコルを活用したデモアプリケーションです。Amazon BedrockのClaude Sonnetを使用して、複数のエージェントが協調してタスクを処理します。

## 概要

このプロジェクトは3つのエージェントから構成されています：

1. **Gateway Agent** - リクエストを受け取り、適切なエージェントにルーティングする
2. **Data Processor Agent** - データの処理と分析を行う
3. **Summarizer Agent** - 処理されたデータの要約を作成する

各エージェントはDockerコンテナとして実行され、A2Aプロトコルを使用して相互に通信します。

## アーキテクチャ

```
[User Request] 
     ↓
[Gateway Agent] (Port 3001)
     ↓ (A2A Protocol)
[Data Processor Agent] (Port 3002) ← → [Summarizer Agent] (Port 3003)
     ↓
[Response to User]
```

## 必要な環境

- Docker & Docker Compose
- AWS アカウント (Amazon Bedrock アクセス)
- Node.js 22+ (開発時)

## セットアップ

### 1. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成し、AWSクレデンシャルを設定してください：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```env
# AWS Credentials for Amazon Bedrock
AWS_ACCESS_KEY_ID=your-actual-access-key-id
AWS_SECRET_ACCESS_KEY=your-actual-secret-access-key
AWS_REGION=us-east-1

# Agent Ports
GATEWAY_PORT=3001
DATA_PROCESSOR_PORT=3002
SUMMARIZER_PORT=3003

# Bedrock Model Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
```

### 2. アプリケーションの起動

```bash
# すべてのエージェントをビルド・起動
npm run dev

# または個別に
docker-compose up --build
```

## 使用方法

### 基本的なAPIリクエスト

Gateway Agent（`http://localhost:3001`）にリクエストを送信します：

#### 1. データ処理

```bash
curl -X POST http://localhost:3001/api/request \
  -H "Content-Type: application/json" \
  -d '{
    "type": "process",
    "data": {
      "sales": [100, 150, 200, 175, 250],
      "products": ["A", "B", "C", "D", "E"]
    },
    "context": {
      "department": "sales",
      "period": "Q1 2024"
    }
  }'
```

#### 2. 要約作成

```bash
curl -X POST http://localhost:3001/api/request \
  -H "Content-Type: application/json" \
  -d '{
    "type": "summarize",
    "data": "大量のテキストデータやレポートをここに配置...",
    "context": {
      "source": "quarterly_report",
      "format": "executive"
    },
    "audienceType": "executive"
  }'
```

#### 3. 分析ワークフロー（処理 → 要約）

```bash
curl -X POST http://localhost:3001/api/request \
  -H "Content-Type: application/json" \
  -d '{
    "type": "analyze",
    "data": {
      "customer_data": [
        {"id": 1, "purchases": 5, "value": 500},
        {"id": 2, "purchases": 3, "value": 300},
        {"id": 3, "purchases": 8, "value": 800}
      ]
    },
    "context": {
      "analysis_type": "customer_behavior"
    },
    "audienceType": "executive"
  }'
```

### ヘルスチェック

各エージェントの状態を確認：

```bash
# Gateway Agent
curl http://localhost:3001/health

# Data Processor Agent
curl http://localhost:3002/health

# Summarizer Agent
curl http://localhost:3003/health
```

## A2A通信の仕組み

### エージェント間通信

1. **Gateway Agent**がユーザーリクエストを受信
2. **A2Aプロトコル**を使用して適切なエージェントにタスクを送信
3. **Data Processor**がデータを処理
4. **Summarizer**が結果を要約（分析ワークフローの場合）
5. **Gateway**が最終結果をユーザーに返す

### サポートされるタスクタイプ

#### Data Processor Agent
- `process` - データのクリーニングと処理
- `analyze` - 深い分析とパターン識別

#### Summarizer Agent
- `summarize` - 包括的な要約
- `executive-summary` - エグゼクティブサマリー
- `brief` - 簡潔な要約

#### 対象オーディエンス
- `technical` - 技術者向け
- `executive` - 経営陣向け
- `general` - 一般向け

## 開発

### ローカル開発

```bash
# 個別のエージェントを開発モードで起動
cd agents/gateway
npm run dev

cd agents/data-processor
npm run dev

cd agents/summarizer
npm run dev
```

### ログの確認

```bash
# すべてのエージェントのログを表示
docker-compose logs -f

# 特定のエージェントのログ
docker-compose logs -f gateway
docker-compose logs -f data-processor
docker-compose logs -f summarizer
```

### トラブルシューティング

1. **AWSクレデンシャルエラー**
   - `.env`ファイルのAWS設定を確認
   - BedrockへのアクセスRが有効になっているか確認

2. **エージェント間通信エラー**
   - すべてのコンテナが起動しているか確認
   - ネットワーク設定を確認（`docker-compose logs`）

3. **ポート競合**
   - `.env`ファイルでポート番号を変更可能

## 将来の拡張

このデモアプリケーションは以下のように拡張可能です：

1. **AWS ECSデプロイ**
   - 各エージェントを個別のECSサービスとしてデプロイ
   - Application Load Balancerを使用したルーティング

2. **追加エージェント**
   - 画像処理エージェント
   - 外部API統合エージェント
   - データベース操作エージェント

3. **監視・ログ**
   - CloudWatchによるメトリクス収集
   - 分散トレーシング

4. **セキュリティ**
   - エージェント間のTLS通信
   - IAMロールベースのアクセス制御

## ライセンス

MIT License