'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Database, FileText, Search, ArrowDown, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface A2AStep {
  id: string
  agent: 'gateway' | 'data-processor' | 'summarizer' | 'web-search'
  action: 'routing' | 'processing' | 'summarizing' | 'searching' | 'responding'
  status: 'pending' | 'active' | 'completed'
  message: string
  timestamp: number
  details?: {
    request?: unknown
    response?: unknown
    endpoint?: string
    method?: string
    duration?: number
  }
}

interface A2AVisualizationProps {
  isActive: boolean
  taskType: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search' | null
  onStepUpdate?: (step: A2AStep) => void
}

export function A2AVisualization({ isActive, taskType, onStepUpdate }: A2AVisualizationProps) {
  const [steps, setSteps] = useState<A2AStep[]>([])
  const [selectedStep, setSelectedStep] = useState<A2AStep | null>(null)
  const [showModal, setShowModal] = useState(false)

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case 'gateway':
        return <Bot className="h-4 w-4" />
      case 'data-processor':
        return <Database className="h-4 w-4" />
      case 'summarizer':
        return <FileText className="h-4 w-4" />
      case 'web-search':
        return <Search className="h-4 w-4" />
      default:
        return <Bot className="h-4 w-4" />
    }
  }

  const getAgentName = (agent: string) => {
    switch (agent) {
      case 'gateway':
        return 'Gateway Agent'
      case 'data-processor':
        return 'Data Processor'
      case 'summarizer':
        return 'Summarizer'
      case 'web-search':
        return 'Web Search Agent'
      default:
        return 'Unknown Agent'
    }
  }

  const getStepsForTaskType = (type: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search'): Omit<A2AStep, 'timestamp' | 'status'>[] => {
    const baseSteps = [
      {
        id: 'gateway-routing',
        agent: 'gateway' as const,
        action: 'routing' as const,
        message: 'A2A Clientでリクエストを受信し、適切なエージェントにルーティング中...'
      }
    ]

    switch (type) {
      case 'process':
        return [
          ...baseSteps,
          {
            id: 'data-processor-processing',
            agent: 'data-processor' as const,
            action: 'processing' as const,
            message: 'A2A sendMessage()でデータ処理タスクを実行中...'
          },
          {
            id: 'gateway-responding',
            agent: 'gateway' as const,
            action: 'responding' as const,
            message: 'A2A getTask()で処理結果を取得し、ユーザーに返却中...'
          }
        ]
      
      case 'summarize':
        return [
          ...baseSteps,
          {
            id: 'summarizer-summarizing',
            agent: 'summarizer' as const,
            action: 'summarizing' as const,
            message: 'A2A sendMessage()で要約作成タスクを実行中...'
          },
          {
            id: 'gateway-responding',
            agent: 'gateway' as const,
            action: 'responding' as const,
            message: 'A2A getTask()で要約結果を取得し、ユーザーに返却中...'
          }
        ]
      
      case 'analyze':
        return [
          ...baseSteps,
          {
            id: 'data-processor-processing',
            agent: 'data-processor' as const,
            action: 'processing' as const,
            message: 'A2A sendMessage()でデータ詳細分析を実行中...'
          },
          {
            id: 'gateway-forwarding',
            agent: 'gateway' as const,
            action: 'routing' as const,
            message: 'A2A getTask()で分析結果を取得し、Summarizerに転送中...'
          },
          {
            id: 'summarizer-summarizing',
            agent: 'summarizer' as const,
            action: 'summarizing' as const,
            message: 'A2A sendMessage()で分析結果の要約を作成中...'
          },
          {
            id: 'gateway-responding',
            agent: 'gateway' as const,
            action: 'responding' as const,
            message: 'A2A getTask()で最終結果を取得し、ユーザーに返却中...'
          }
        ]
      
      case 'web-search':
      case 'news-search':
      case 'scholarly-search':
        return [
          ...baseSteps,
          {
            id: 'web-search-searching',
            agent: 'web-search' as const,
            action: 'searching' as const,
            message: 'A2A sendMessage()でMCP経由のWeb検索を実行中...'
          },
          {
            id: 'gateway-responding',
            agent: 'gateway' as const,
            action: 'responding' as const,
            message: 'A2A getTask()で検索結果を取得し、ユーザーに返却中...'
          }
        ]
      
      default:
        return baseSteps
    }
  }

  useEffect(() => {
    if (!isActive || !taskType) {
      setSteps([])
      return
    }

    const stepTemplates = getStepsForTaskType(taskType)
    const initialSteps = stepTemplates.map((step, index) => ({
      ...step,
      timestamp: Date.now() + index * 1000,
      status: 'pending' as const
    }))

    setSteps(initialSteps)

    // Generate sample A2A communication details
    const generateStepDetails = (step: Omit<A2AStep, 'timestamp' | 'status'>, taskType: string) => {
      const baseDetails = {
        method: 'POST',
        duration: Math.floor(Math.random() * 1000) + 200
      }

      switch (step.id) {
        case 'gateway-routing':
          return {
            ...baseDetails,
            endpoint: '/api/request',
            request: {
              type: taskType,
              data: taskType === 'process' ? '[sample data]' : 'sample text data',
              context: { source: 'ui' }
            },
            response: {
              status: 'routing',
              targetAgent: taskType === 'process' ? 'data-processor' : 'summarizer',
              timestamp: new Date().toISOString()
            }
          }
        case 'data-processor-processing':
          return {
            ...baseDetails,
            endpoint: '/api/a2a/message',
            request: {
              id: crypto.randomUUID(),
              from: 'gateway-agent-01',
              message: {
                role: 'user',
                parts: [{ type: 'text', text: JSON.stringify({ type: 'process', data: '[sample data]' }) }]
              },
              timestamp: new Date().toISOString()
            },
            response: {
              id: crypto.randomUUID(),
              from: 'data-processor-agent-01',
              task: {
                id: crypto.randomUUID(),
                status: { state: 'completed', message: 'Data processing completed' },
                result: { status: 'completed', processedBy: 'data-processor-agent-01' }
              }
            }
          }
        case 'summarizer-summarizing':
          return {
            ...baseDetails,
            endpoint: '/api/a2a/message',
            request: {
              id: crypto.randomUUID(),
              from: 'gateway-agent-01',
              message: {
                role: 'user',
                parts: [{ type: 'text', text: JSON.stringify({ type: 'summarize', data: 'processed data...' }) }]
              },
              timestamp: new Date().toISOString()
            },
            response: {
              id: crypto.randomUUID(),
              from: 'summarizer-agent-01',
              task: {
                id: crypto.randomUUID(),
                status: { state: 'completed', message: 'Summarization completed' },
                result: { status: 'completed', summary: 'データ処理結果の要約...' }
              }
            }
          }
        case 'web-search-searching':
          return {
            ...baseDetails,
            endpoint: '/api/a2a/message',
            request: {
              id: crypto.randomUUID(),
              from: 'gateway-agent-01',
              message: {
                role: 'user',
                parts: [{ type: 'text', text: JSON.stringify({ type: taskType, query: 'sample search query' }) }]
              },
              timestamp: new Date().toISOString()
            },
            response: {
              id: crypto.randomUUID(),
              from: 'web-search-agent-01',
              task: {
                id: crypto.randomUUID(),
                status: { state: 'completed', message: 'Search completed' },
                result: { 
                  status: 'completed', 
                  result: {
                    query: 'sample search query',
                    results: [{ title: 'Sample Result', url: 'https://example.com', snippet: 'Sample content...' }],
                    summary: 'Web検索結果の要約...'
                  }
                }
              }
            }
          }
        default:
          return baseDetails
      }
    }

    // Simulate step progression
    const progressSteps = () => {
      let stepIndex = 0
      
      const interval = setInterval(() => {
        if (stepIndex < initialSteps.length) {
          setSteps(prev => prev.map((step, i) => {
            if (i === stepIndex) {
              const updatedStep = { ...step, status: 'active' as const }
              onStepUpdate?.(updatedStep)
              return updatedStep
            }
            if (i < stepIndex) {
              return { ...step, status: 'completed' as const }
            }
            return step
          }))

          // Complete current step after a delay
          setTimeout(() => {
            setSteps(prev => prev.map((step, i) => {
              if (i === stepIndex) {
                const details = generateStepDetails(initialSteps[i], taskType)
                return { 
                  ...step, 
                  status: 'completed' as const,
                  details
                }
              }
              return step
            }))
          }, Math.random() * 2000 + 1000) // 1-3 seconds

          stepIndex++
        } else {
          clearInterval(interval)
        }
      }, Math.random() * 1500 + 1500) // 1.5-3 seconds between steps

      return interval
    }

    const interval = progressSteps()
    return () => clearInterval(interval)
  }, [isActive, taskType, onStepUpdate])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />
      default:
        return <div className="h-3 w-3 rounded-full bg-gray-300" />
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-sm">A2A通信フロー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isActive && (
          <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground py-4">
              タスク実行時にA2A通信フローが表示されます
            </div>
          </div>
        )}
        
        {steps.map((step, index) => (
          <div key={step.id} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <button
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors hover:opacity-80",
                    step.status === 'active' && "bg-blue-50 text-blue-700",
                    step.status === 'completed' && "bg-green-50 text-green-700 cursor-pointer",
                    step.status === 'pending' && "bg-gray-50 text-gray-600"
                  )}
                  onClick={() => {
                    if (step.status === 'completed' && step.details) {
                      setSelectedStep(step)
                      setShowModal(true)
                    }
                  }}
                  disabled={step.status !== 'completed' || !step.details}
                >
                  {getAgentIcon(step.agent)}
                  <span className="font-medium">{getAgentName(step.agent)}</span>
                  {step.status === 'completed' && step.details && (
                    <span className="text-xs opacity-60">📄</span>
                  )}
                </button>
                {getStatusIcon(step.status)}
              </div>
            </div>
            
            <div className={cn(
              "text-xs pl-6 pr-2 py-1 rounded text-muted-foreground",
              step.status === 'active' && "text-blue-600 bg-blue-50",
              step.status === 'completed' && "text-green-600"
            )}>
              {step.message}
            </div>
            
            {index < steps.length - 1 && (
              <div className="flex justify-center">
                <ArrowDown className={cn(
                  "h-4 w-4 text-gray-300",
                  step.status === 'completed' && "text-green-400"
                )} />
              </div>
            )}
          </div>
        ))}
        
        {isActive && taskType && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-blue-50 rounded-md">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">
                  {taskType === 'process' && 'データ処理中...'}
                  {taskType === 'summarize' && '要約作成中...'}
                  {taskType === 'analyze' && '分析ワークフロー実行中...'}
                  {taskType === 'web-search' && 'Web検索実行中...'}
                  {taskType === 'news-search' && 'ニュース検索実行中...'}
                  {taskType === 'scholarly-search' && '学術検索実行中...'}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="font-medium">📄 ステップ詳細を見るには:</div>
                <div>• 完了したステップ（緑色）をクリック</div>
                <div>• リクエスト・レスポンスの詳細を確認</div>
                <div>• A2Aプロトコルの通信内容を体験</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Step Details Modal */}
      {showModal && selectedStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getAgentIcon(selectedStep.agent)}
                  <div>
                    <h3 className="text-lg font-semibold">{getAgentName(selectedStep.agent)}</h3>
                    <p className="text-sm text-gray-600">{selectedStep.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {/* Request Details */}
                {selectedStep.details?.request !== undefined && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      📤 リクエスト
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {selectedStep.details.method} {selectedStep.details.endpoint}
                      </span>
                    </h4>
                    <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-x-auto border">
                      {typeof selectedStep.details.request === 'string' 
                        ? selectedStep.details.request 
                        : JSON.stringify(selectedStep.details.request, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Response Details */}
                {selectedStep.details?.response !== undefined && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      📥 レスポンス
                      {selectedStep.details.duration && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {selectedStep.details.duration}ms
                        </span>
                      )}
                    </h4>
                    <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-x-auto border">
                      {typeof selectedStep.details.response === 'string' 
                        ? selectedStep.details.response 
                        : JSON.stringify(selectedStep.details.response, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Step Info */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 ステップ情報</h4>
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-700">エージェント:</span>
                        <div>{getAgentName(selectedStep.agent)}</div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">アクション:</span>
                        <div>{selectedStep.action}</div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">ステータス:</span>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(selectedStep.status)}
                          {selectedStep.status}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">時刻:</span>
                        <div>{new Date(selectedStep.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* A2A Protocol Info */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">🔗 A2Aプロトコル詳細</h4>
                  <div className="bg-yellow-50 p-4 rounded-md text-xs space-y-1">
                    <div>• JSON-RPC 2.0ベースのメッセージング</div>
                    <div>• 非同期タスク処理とステータス追跡</div>
                    <div>• エージェント間の直接通信</div>
                    <div>• 標準化されたメッセージフォーマット</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}