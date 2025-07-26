import { NextRequest, NextResponse } from 'next/server'

const GATEWAY_BASE_URL = process.env.GATEWAY_URL || 'http://gateway:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Frontend API: Received AgentNetwork request:', body)
    
    // GatewayのAgentNetworkエンドポイントに転送
    const response = await fetch(`${GATEWAY_BASE_URL}/api/network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': request.headers.get('x-user-id') || 'frontend-user',
      },
      body: JSON.stringify(body),
    })
    
    console.log('Gateway response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gateway error response:', errorText)
      
      let errorMessage = `Gateway error: ${response.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorMessage
      } catch {
        // JSONパースに失敗した場合はそのままテキストを使用
        errorMessage = errorText || errorMessage
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('Gateway response data:', JSON.stringify(data, null, 2))
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Frontend API error:', error)
    
    let errorMessage = 'Internal server error'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    // ネットワークエラーやタイムアウトの場合
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Gatewayへの接続に失敗しました。サーバーが起動していることを確認してください。'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AgentNetwork API endpoint',
    methods: ['POST'],
    description: 'AgentNetworkによる多エージェント協調処理'
  })
}