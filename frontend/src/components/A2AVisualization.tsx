'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Database, FileText, Search, ArrowDown, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
// import { WorkflowExecution, WorkflowStep } from "@shared/types"

// 一時的に型定義をローカルに定義
interface WorkflowStep {
  id: string;
  stepNumber: number;
  agentId: string;
  agentName: string;
  operation: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  traceId?: string;
}

interface WorkflowExecution {
  id: string;
  requestId: string;
  type: 'process' | 'summarize' | 'analyze';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  steps: WorkflowStep[];
  metadata: {
    initiatedBy: string;
    startedAt: string;
    completedAt?: string;
    totalDuration?: number;
    dataSize?: number;
    audienceType?: string;
  };
  result?: unknown;
  error?: string;
  langfuseTraceId?: string;
}

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
  taskType: 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search' | 'deep-research' | null
  workflowExecutionId?: string
  taskId?: string
  onStepUpdate?: (step: A2AStep) => void
}

export function A2AVisualization({ isActive, taskType, workflowExecutionId, onStepUpdate }: A2AVisualizationProps) {
  const [steps, setSteps] = useState<A2AStep[]>([])
  const [selectedStep, setSelectedStep] = useState<A2AStep | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [realWorkflowData, setRealWorkflowData] = useState<WorkflowExecution | null>(null)

  // 実際のワークフローデータを取得する関数
  const fetchWorkflowData = async (executionId: string) => {
    console.log('🔍 Fetching workflow data for execution ID:', executionId)
    try {
      const response = await fetch(`http://localhost:3001/api/workflows/${executionId}`)
      console.log('📡 Workflow API response status:', response.status)
      if (response.ok) {
        const workflowData: WorkflowExecution = await response.json()
        console.log('✅ Workflow data received:', workflowData)
        console.log('📊 Number of steps:', workflowData.steps.length)
        setRealWorkflowData(workflowData)
        return workflowData
      } else {
        console.log('❌ Workflow API returned error status:', response.status)
      }
    } catch (error) {
      console.error('❌ Failed to fetch workflow data:', error)
    }
    return null
  }

  // WorkflowStepをA2AStepに変換する関数
  const convertWorkflowStepToA2AStep = (workflowStep: WorkflowStep): A2AStep => {
    // エージェント名からA2AStepのagent型にマッピング
    const getAgentType = (agentName: string): 'gateway' | 'data-processor' | 'summarizer' | 'web-search' => {
      if (agentName.includes('gateway')) return 'gateway'
      if (agentName.includes('data-processor')) return 'data-processor'
      if (agentName.includes('summarizer')) return 'summarizer'
      if (agentName.includes('web-search')) return 'web-search'
      return 'gateway' // デフォルト
    }

    // 操作からアクション型にマッピング
    const getActionType = (operation: string): 'routing' | 'processing' | 'summarizing' | 'searching' | 'responding' => {
      if (operation.includes('routing') || operation.includes('route')) return 'routing'
      if (operation.includes('process') || operation.includes('analyzing')) return 'processing'
      if (operation.includes('summariz')) return 'summarizing'
      if (operation.includes('search')) return 'searching'
      return 'responding' // デフォルト
    }

    return {
      id: workflowStep.id,
      agent: getAgentType(workflowStep.agentName),
      action: getActionType(workflowStep.operation),
      status: workflowStep.status === 'in_progress' ? 'active' : 
              workflowStep.status === 'completed' ? 'completed' : 
              workflowStep.status === 'failed' ? 'completed' : 'pending',
      message: `${workflowStep.operation} - ${workflowStep.agentName}`,
      timestamp: new Date(workflowStep.startedAt).getTime(),
      details: {
        request: workflowStep.input,
        response: workflowStep.output,
        endpoint: '/api/a2a/message',
        method: 'POST',
        duration: workflowStep.duration || 0
      }
    }
  }

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


  useEffect(() => {
    console.log('🚀 A2AVisualization useEffect triggered', { isActive, taskType, workflowExecutionId })
    
    // workflowExecutionIdがある場合は常に表示（完了後も表示し続ける）
    if (!isActive && !workflowExecutionId) {
      console.log('❌ Early return: inactive and no workflowExecutionId')
      setSteps([])
      setRealWorkflowData(null)
      return
    }

    // 実際のworkflowExecutionIdが提供されている場合のみ処理
    if (workflowExecutionId) {
      console.log('🔄 Fetching real workflow data')
      
      const loadWorkflowData = async () => {
        try {
          const workflowData = await fetchWorkflowData(workflowExecutionId)
          if (workflowData && workflowData.steps.length > 0) {
            console.log('✅ Converting real workflow steps to A2A steps')
            // 実際のワークフローステップを使用
            const realSteps = workflowData.steps.map(convertWorkflowStepToA2AStep)
            console.log('📋 Real steps converted:', realSteps)
            setSteps(realSteps)
            
            // ワークフローが完了していない場合は、定期的に更新
            if (workflowData.status === 'in_progress' || workflowData.status === 'pending') {
              console.log('⏳ Workflow in progress, will poll for updates')
              return true // ポーリング続行
            } else {
              console.log('✅ Workflow completed')
              return false // ポーリング停止
            }
          } else {
            console.log('⚠️ No workflow data or steps found')
            setSteps([])
            return false
          }
        } catch (error) {
          console.log('❌ Error fetching workflow data:', error)
          setSteps([])
          return false
        }
      }

      // 初回データ取得
      loadWorkflowData().then((shouldContinuePolling) => {
        if (shouldContinuePolling) {
          // ワークフローが完了していない場合、2秒ごとにポーリング
          const pollInterval = setInterval(async () => {
            const continuePolling = await loadWorkflowData()
            if (!continuePolling) {
              clearInterval(pollInterval)
            }
          }, 2000)

          // クリーンアップ用に返す
          return () => clearInterval(pollInterval)
        }
      })

    } else if (isActive && taskType) {
      console.log('📝 Showing loading state while waiting for workflowExecutionId')
      // workflowExecutionIdがまだない場合は、ローディング中を示すプレースホルダー
      setSteps([{
        id: 'loading',
        agent: 'gateway',
        action: 'routing',
        status: 'active',
        message: 'A2A通信を開始しています...',
        timestamp: Date.now()
      }])
    } else {
      console.log('📝 No active task')
      setSteps([])
    }

  }, [isActive, taskType, workflowExecutionId, onStepUpdate])

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
        
        {(isActive || realWorkflowData) && taskType && (
          <div className="mt-4 space-y-3">
            {!realWorkflowData || realWorkflowData.status === 'in_progress' || realWorkflowData.status === 'pending' ? (
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
                    {taskType === 'deep-research' && 'Deep Research実行中...'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 rounded-md">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">
                    {taskType === 'process' && 'データ処理完了'}
                    {taskType === 'summarize' && '要約作成完了'}
                    {taskType === 'analyze' && '分析ワークフロー完了'}
                    {taskType === 'web-search' && 'Web検索完了'}
                    {taskType === 'news-search' && 'ニュース検索完了'}
                    {taskType === 'scholarly-search' && '学術検索完了'}
                    {taskType === 'deep-research' && 'Deep Research完了'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="font-medium">📄 ステップ詳細を見るには:</div>
                <div>• 完了したステップ（緑色）をクリック</div>
                <div>• リクエスト・レスポンスの詳細を確認</div>
                <div>• A2Aプロトコルの通信内容を体験</div>
                {realWorkflowData && (
                  <div className="text-purple-600 font-medium">• 実際の実行履歴データを表示中</div>
                )}
                {!realWorkflowData && workflowExecutionId && (
                  <div className="text-orange-600">• ワークフローデータの取得を試行中</div>
                )}
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
                
                {/* Real Workflow Info */}
                {realWorkflowData && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">🔄 実際のワークフロー情報</h4>
                    <div className="bg-purple-50 p-4 rounded-md text-xs space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium text-purple-700">ワークフローID:</span>
                          <div className="text-purple-600">{realWorkflowData.id}</div>
                        </div>
                        <div>
                          <span className="font-medium text-purple-700">実行タイプ:</span>
                          <div className="text-purple-600">{realWorkflowData.type}</div>
                        </div>
                        <div>
                          <span className="font-medium text-purple-700">開始時刻:</span>
                          <div className="text-purple-600">{new Date(realWorkflowData.metadata.startedAt).toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-purple-700">実行時間:</span>
                          <div className="text-purple-600">{realWorkflowData.metadata.totalDuration ? `${realWorkflowData.metadata.totalDuration}ms` : '実行中'}</div>
                        </div>
                      </div>
                      {realWorkflowData.langfuseTraceId && (
                        <div>
                          <span className="font-medium text-purple-700">Langfuse Trace ID:</span>
                          <div className="text-purple-600 font-mono text-xs">{realWorkflowData.langfuseTraceId}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* A2A Protocol Info */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">🔗 A2Aプロトコル詳細</h4>
                  <div className="bg-yellow-50 p-4 rounded-md text-xs space-y-1">
                    <div>• JSON-RPC 2.0ベースのメッセージング</div>
                    <div>• 非同期タスク処理とステータス追跡</div>
                    <div>• エージェント間の直接通信</div>
                    <div>• 標準化されたメッセージフォーマット</div>
                    {realWorkflowData && <div>• このデータは実際の実行履歴から取得されました</div>}
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