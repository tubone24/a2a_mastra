import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3001'
    
    const response = await fetch(`${gatewayUrl}/api/a2a/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Gateway response: ${response.status} ${response.statusText} - ${errorData.message || ''}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Failed to submit task to gateway:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to submit task',
        status: 'error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3001'
    
    const response = await fetch(`${gatewayUrl}/api/a2a/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Gateway response: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Failed to fetch agents from gateway:', error)
    
    // Return fallback response if gateway is not accessible
    return NextResponse.json({
      gateway: {
        id: 'gateway-agent-01',
        name: 'Gateway Agent',
        status: 'unknown'
      },
      connectedAgents: [
        {
          id: 'data-processor-agent-01',
          name: 'Data Processor Agent',
          type: 'processor',
          description: 'データプロセッサーエージェント - 構造化および非構造化データの分析・処理を専門とします',
          capabilities: ['data-processing', 'data-analysis', 'pattern-recognition'],
          endpoint: 'http://data-processor:3002',
          status: 'unknown',
          supportedProtocols: ['A2A'],
          supportedTaskTypes: ['process', 'analyze']
        },
        {
          id: 'summarizer-agent-01',
          name: 'Summarizer Agent',
          type: 'summarizer',
          description: 'サマライザーエージェント - 処理済みデータと分析結果の簡潔で意味のある要約を作成します',
          capabilities: ['text-summarization', 'executive-summary', 'insight-extraction'],
          endpoint: 'http://summarizer:3003',
          status: 'unknown',
          supportedProtocols: ['A2A'],
          supportedTaskTypes: ['summarize', 'executive-summary', 'brief'],
          supportedAudienceTypes: ['technical', 'executive', 'general']
        }
      ],
      totalAgents: 2,
      note: 'Fallback data - Gateway not accessible'
    })
  }
}