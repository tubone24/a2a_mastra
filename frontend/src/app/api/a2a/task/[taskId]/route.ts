import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const gatewayUrl = process.env.GATEWAY_URL || 'http://gateway:3001'
    
    const response = await fetch(`${gatewayUrl}/api/gateway/task/${taskId}`, {
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
    console.error('Failed to fetch task status from gateway:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch task status',
        status: 'error'
      },
      { status: 500 }
    )
  }
}