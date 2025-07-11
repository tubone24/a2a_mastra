'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Send, MessageSquare, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TestMessage {
  id: string
  timestamp: Date
  fromAgent: string
  toAgent: string
  message: string
  response?: unknown
  status: 'sending' | 'completed' | 'failed'
  duration?: number
}

const AGENT_OPTIONS = [
  { value: 'data-processor', label: 'Data Processor', endpoint: 'http://data-processor:3002' },
  { value: 'summarizer', label: 'Summarizer', endpoint: 'http://summarizer:3003' },
]

const SAMPLE_MESSAGES = {
  'data-processor': [
    '{ "type": "process", "data": [1, 2, 3, 4, 5], "context": { "source": "test" } }',
    '{ "type": "analyze", "data": { "sales": [100, 150, 200], "months": ["Jan", "Feb", "Mar"] } }',
  ],
  'summarizer': [
    '{ "type": "summarize", "data": "Large data analysis result...", "audienceType": "executive" }',
    '{ "type": "executive-summary", "data": "Complex business data...", "audienceType": "executive" }',
  ],
}

export function AgentCommunicationTest() {
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<TestMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendTestMessage = async () => {
    if (!selectedAgent || !message.trim()) return

    const testMessage: TestMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      fromAgent: 'gateway',
      toAgent: selectedAgent,
      message: message.trim(),
      status: 'sending'
    }

    setMessages(prev => [testMessage, ...prev])
    setIsLoading(true)

    const startTime = Date.now()

    try {
      // Send A2A message to selected agent via gateway
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedAgent === 'data-processor' ? 'process' : 'summarize',
          data: message,
          context: { source: 'agent-communication-test' }
        }),
      })

      const duration = Date.now() - startTime
      const result = await response.json()

      setMessages(prev => prev.map(msg => 
        msg.id === testMessage.id 
          ? { 
              ...msg, 
              status: response.ok ? 'completed' : 'failed',
              response: result,
              duration 
            }
          : msg
      ))

    } catch (error) {
      const duration = Date.now() - startTime
      
      setMessages(prev => prev.map(msg => 
        msg.id === testMessage.id 
          ? { 
              ...msg, 
              status: 'failed',
              response: { error: error instanceof Error ? error.message : 'Unknown error' },
              duration 
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const loadSampleMessage = (agentType: string, index: number) => {
    const samples = SAMPLE_MESSAGES[agentType as keyof typeof SAMPLE_MESSAGES]
    if (samples && samples[index]) {
      setMessage(samples[index])
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          エージェント間通信テスト
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">対象エージェント</label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="エージェントを選択" />
              </SelectTrigger>
              <SelectContent>
                {AGENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedAgent && (
            <div>
              <label className="text-sm font-medium mb-2 block">サンプルメッセージ</label>
              <div className="flex gap-2">
                {SAMPLE_MESSAGES[selectedAgent as keyof typeof SAMPLE_MESSAGES]?.map((_, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => loadSampleMessage(selectedAgent, index)}
                  >
                    サンプル {index + 1}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">メッセージ (JSON)</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="JSON形式でメッセージを入力してください..."
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <Button
          onClick={sendTestMessage}
          disabled={!selectedAgent || !message.trim() || isLoading}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          A2Aメッセージを送信
        </Button>

        {messages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">通信履歴</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((msg) => (
                <Card key={msg.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(msg.status)}
                        <span className="text-sm font-medium">
                          {msg.fromAgent} → {msg.toAgent}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          A2A
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {msg.duration && (
                          <span>{msg.duration}ms</span>
                        )}
                        <span>{msg.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">送信メッセージ:</span>
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                          {msg.message}
                        </pre>
                      </div>
                      
                      {msg.response !== undefined && (
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {msg.status === 'failed' ? 'エラー:' : 'レスポンス:'}
                          </span>
                          <pre className={cn(
                            "text-xs p-2 rounded mt-1 overflow-x-auto",
                            msg.status === 'failed' ? "bg-red-50" : "bg-green-50"
                          )}>
                            {typeof msg.response === 'string' ? msg.response : JSON.stringify(msg.response, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 bg-blue-50 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-2">A2A通信の流れ</h4>
          <div className="text-xs text-blue-700 space-y-1">
            <div>1. Gateway Agentがリクエストを受信</div>
            <div>2. A2A sendMessage()で対象エージェントにメッセージ送信</div>
            <div>3. 対象エージェントがタスクを処理</div>
            <div>4. A2A getTask()でタスク結果を取得</div>
            <div>5. Gateway Agentが結果をクライアントに返却</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}