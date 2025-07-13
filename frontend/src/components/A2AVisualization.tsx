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
  taskProgress?: {progress: number, phase: string} | null
  onStepUpdate?: (step: A2AStep) => void
}

export function A2AVisualization({ isActive, taskType, workflowExecutionId, taskId, taskProgress, onStepUpdate }: A2AVisualizationProps) {
  const [steps, setSteps] = useState<A2AStep[]>([])
  const [selectedStep, setSelectedStep] = useState<A2AStep | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [realWorkflowData, setRealWorkflowData] = useState<WorkflowExecution | null>(null)
  const [taskData, setTaskData] = useState<Record<string, unknown> | null>(null)

  // Deep Researchタスクデータを取得する関数
  const fetchTaskData = async (taskId: string) => {
    console.log('🔍 Fetching Deep Research task data for task ID:', taskId)
    try {
      const response = await fetch(`/api/a2a/task/${taskId}`)
      console.log('📡 Task API response status:', response.status)
      if (response.ok) {
        const taskData = await response.json()
        console.log('✅ Task data received:', taskData)
        
        // 新しいA2A形式のレスポンスを処理
        if (taskData.task) {
          // 進捗とフェーズ情報を抽出
          let extractedProgress, extractedPhase;
          
          // artifactsから進捗情報を抽出
          const workflowArtifact = taskData.task.artifacts?.find((artifact: {type: string, metadata?: {progress?: number, currentPhase?: string}}) => artifact.type === 'workflow-result');
          if (workflowArtifact?.metadata) {
            extractedProgress = workflowArtifact.metadata.progress;
            extractedPhase = workflowArtifact.metadata.currentPhase;
          }
          
          // メッセージから進捗情報を抽出 (フォールバック)
          if ((extractedProgress === undefined || extractedPhase === undefined) && taskData.task.status?.message?.parts?.[0]?.text) {
            const messageText = taskData.task.status.message.parts[0].text;
            const progressMatch = messageText.match(/(\d+)%/);
            
            // 日本語と英語のフェーズ名に対応
            const phaseMatch = messageText.match(/(search|analyze|synthesize|Web検索|データ分析|結果統合)/);
            
            if (progressMatch && extractedProgress === undefined) {
              extractedProgress = parseInt(progressMatch[1]);
            }
            if (phaseMatch && extractedPhase === undefined) {
              const phase = phaseMatch[1];
              // 日本語フェーズ名を英語にマップ
              const phaseMap: Record<string, string> = {
                'Web検索フェーズ': 'search',
                'Web検索': 'search',
                'データ分析フェーズ': 'analyze', 
                'データ分析': 'analyze',
                '結果統合フェーズ': 'synthesize',
                '結果統合': 'synthesize'
              };
              extractedPhase = phaseMap[phase] || phase;
            }
          }
          
          const processedTaskData = {
            id: taskData.task.id,
            status: {
              state: taskData.task.status.state,
              timestamp: taskData.task.status.timestamp,
              message: taskData.task.status.message?.parts?.[0]?.text || 'Processing...'
            },
            artifacts: taskData.task.artifacts || [],
            // 結果を抽出
            result: taskData.task.artifacts && taskData.task.artifacts.length > 0 ? 
              taskData.task.artifacts.find((artifact: {type: string, data?: unknown}) => artifact.type === 'workflow-result')?.data :
              null,
            // 進捗情報を抽出
            progress: extractedProgress,
            currentPhase: extractedPhase
          }
          
          console.log('📊 Processed task data:', processedTaskData)
          console.log('🔍 Debug - status.state:', processedTaskData.status.state)
          console.log('🔍 Debug - progress:', processedTaskData.progress)
          console.log('🔍 Debug - currentPhase:', processedTaskData.currentPhase)
          setTaskData(processedTaskData)
          return processedTaskData
        } else {
          // 従来形式のフォールバック
          setTaskData(taskData)
          return taskData
        }
      } else {
        console.log('❌ Task API returned error status:', response.status)
      }
    } catch (error) {
      console.error('❌ Failed to fetch task data:', error)
    }
    return null
  }

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
    console.log('🚀 A2AVisualization useEffect triggered', { isActive, taskType, workflowExecutionId, taskId })
    
    // Deep Researchの場合は異なる表示ロジックを使用
    if (taskType === 'deep-research' && taskId) {
      console.log('🔬 Deep Research mode - using task polling visualization')
      
      // Deep Researchのフェーズに基づくステップ表示
      const generateDeepResearchSteps = (progress: number, phase: string, taskData?: Record<string, unknown>) => {
        const phases = ['search', 'analyze', 'synthesize']
        const phaseNames = {
          'search': 'Web検索フェーズ',
          'analyze': 'データ分析フェーズ', 
          'synthesize': '結果統合フェーズ'
        }
        
        // タスクが完了している場合は進捗とフェーズを更新
        let actualProgress = progress
        let actualPhase = phase
        
        if (taskData && taskData.status) {
          const status = taskData.status as {state: string}
          if (status.state === 'completed') {
            actualProgress = 100
            actualPhase = 'completed'
          } else if (taskData.progress !== undefined) {
            actualProgress = taskData.progress as number
          }
          if (taskData.currentPhase) {
            actualPhase = taskData.currentPhase as string
          }
        }
        
        return phases.map((p, index) => {
          let status: 'pending' | 'active' | 'completed'
          // より正確な進捗ベースのステータス判定
          if (actualPhase === 'completed' || actualProgress === 100) {
            status = 'completed'
          } else if (actualPhase === p) {
            status = 'active'
          } else {
            // 進捗率ベースでステータスを判定
            const phaseThresholds = [33, 66, 95] // search, analyze, synthesize
            if (actualProgress > phaseThresholds[index]) {
              status = 'completed'
            } else if (actualProgress > (index > 0 ? phaseThresholds[index - 1] : 0)) {
              status = 'active'
            } else {
              status = 'pending'
            }
          }
          
          return {
            id: `deep-research-${p}`,
            agent: p === 'search' ? 'web-search' as const : 
                   p === 'analyze' ? 'data-processor' as const : 
                   'summarizer' as const,
            action: p === 'search' ? 'searching' as const :
                   p === 'analyze' ? 'processing' as const :
                   'summarizing' as const,
            status,
            message: `${phaseNames[p as keyof typeof phaseNames]} ${status === 'active' ? `(${actualProgress}%)` : status === 'completed' ? '完了' : '待機中'}`,
            timestamp: Date.now() - (3 - index) * 1000,
            details: taskData && status === 'completed' ? {
              request: `${p} phase request`,
              response: taskData.result ? JSON.stringify(taskData.result, null, 2) : `${p} completed`,
              method: 'POST',
              endpoint: '/api/a2a/task',
              duration: 2000
            } : undefined
          }
        })
      }
      
      // 進捗情報を決定 - taskDataから取得するかtaskProgressから取得
      let currentProgress = taskProgress?.progress || 0
      let currentPhase = taskProgress?.phase || 'search'
      
      if (taskData && taskData.status) {
        const status = taskData.status as {state: string}
        if (status.state === 'completed') {
          currentProgress = 100
          currentPhase = 'completed'
        } else {
          if (taskData.progress !== undefined) {
            currentProgress = taskData.progress as number
          }
          if (taskData.currentPhase) {
            currentPhase = taskData.currentPhase as string
          }
        }
      }
      
      const steps = generateDeepResearchSteps(currentProgress, currentPhase, taskData || undefined)
      setSteps(steps)
      
      // タスクデータを定期的に取得
      if (isActive) {
        const interval = setInterval(async () => {
          const data = await fetchTaskData(taskId)
          // タスクが完了した場合はポーリング停止
          if (data && (
            (data.status && (data.status as {state: string}).state === 'completed') ||
            (data.progress !== undefined && data.progress === 100) ||
            (data.currentPhase === 'completed')
          )) {
            console.log('🛑 Task completed - stopping polling')
            clearInterval(interval)
            // isActiveをfalseに設定して完了状態に移行
            return true // この戻り値でポーリング停止を通知
          }
          return false
        }, 5000)
        
        return () => clearInterval(interval)
      }
      
      return
    }
    
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

  }, [isActive, taskType, workflowExecutionId, taskId, taskProgress, taskData, onStepUpdate])

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
        <CardTitle className="text-sm">
          {taskType === 'deep-research' ? 'Deep Research 実行状況' : 'A2A通信フロー'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isActive && !taskId && (
          <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground py-4">
              {taskType === 'deep-research' ? 
                'Deep Research実行時に進捗状況が表示されます' : 
                'タスク実行時にA2A通信フローが表示されます'
              }
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
        
        {((isActive || realWorkflowData) && taskType && taskType !== 'deep-research') && (
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

        {/* Deep Research用の進捗表示 */}
        {taskType === 'deep-research' && (isActive || taskId) && (
          <div className="mt-4 space-y-3">
            {/* 実際のタスクデータから進捗状況を判定 */}
            {(() => {
              const actualProgress = taskData?.progress !== undefined ? taskData.progress as number : (taskProgress?.progress || 0)
              const actualPhase = taskData?.currentPhase || taskProgress?.phase || 'search'
              
              // デバッグ情報をログ出力
              console.log('🔍 Complete check - actualProgress:', actualProgress)
              console.log('🔍 Complete check - actualPhase:', actualPhase)
              console.log('🔍 Complete check - taskData:', taskData)
              console.log('🔍 Complete check - taskData.status:', taskData?.status)
              
              // より確実な完了判定ロジック
              const taskStatus = taskData?.status as {state: string} | undefined
              const statusCompleted = taskStatus?.state === 'completed'
              const progressCompleted = actualProgress === 100
              const phaseCompleted = actualPhase === 'completed'
              
              console.log('🔍 Complete check - taskStatus.state:', taskStatus?.state)
              console.log('🔍 Complete check - statusCompleted:', statusCompleted)
              console.log('🔍 Complete check - progressCompleted:', progressCompleted)
              console.log('🔍 Complete check - phaseCompleted:', phaseCompleted)
              
              // Deep Researchタスクが完了しているかを複数の条件で確認
              const isCompleted = statusCompleted || progressCompleted || phaseCompleted
              console.log('🔍 Complete check - isCompleted:', isCompleted)
              
              if (isCompleted) {
                return (
                  <div className="p-3 bg-green-50 rounded-md">
                    <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Deep Research完了! (100%)</span>
                    </div>
                    <div className="text-xs text-green-600">
                      全ての調査フェーズが完了しました
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                      <div className="bg-green-600 h-2 rounded-full w-full"></div>
                    </div>
                  </div>
                )
              } else {
                return (
                  <div className="p-3 bg-blue-50 rounded-md">
                    <div className="flex items-center gap-2 text-sm text-blue-700 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="font-medium">Deep Research実行中... ({actualProgress}%)</span>
                    </div>
                    <div className="text-xs text-blue-600">
                      現在のフェーズ: {actualPhase === 'search' ? 'Web検索' : 
                                    actualPhase === 'analyze' ? 'データ分析' :
                                    actualPhase === 'synthesize' ? '結果統合' : 
                                    actualPhase === 'completed' ? '完了' : String(actualPhase)}
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${actualProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )
              }
            })()}
            
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="font-medium">🔍 Deep Research詳細:</div>
                <div>• マルチエージェント協調による深い調査</div>
                <div>• Web検索 → データ分析 → 結果統合の3段階</div>
                <div>• 非同期タスク処理によるリアルタイム進捗表示</div>
                {taskId && (
                  <div className="text-blue-600 font-medium">• タスクID: {taskId}</div>
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