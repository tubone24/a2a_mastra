'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Send, CheckCircle, AlertCircle, Bot, Database, FileText, Search, Network, ArrowRight, Users } from "lucide-react"

const agentNetworkFormSchema = z.object({
  query: z.string().min(1, "クエリを入力してください"),
  context: z.string().optional(),
  options: z.object({
    enableA2A: z.boolean(),
    depth: z.enum(['basic', 'comprehensive', 'expert']),
    audienceType: z.enum(['technical', 'executive', 'general']),
    maxAgents: z.number().min(1).max(5),
  }),
})

type AgentNetworkFormData = z.infer<typeof agentNetworkFormSchema>

interface AgentNetworkResponse {
  status: string
  type: string
  result: {
    approach: 'single-agent' | 'sequential' | 'parallel'
    plan: {
      approach: string
      agents: Array<{
        name: string
        task: string
        priority: number
        dependencies?: string[]
      }>
      reasoning: string
    }
    executionResults: Array<{
      agent: string
      result: string | Record<string, unknown>
    }>
    finalResult: string | Record<string, unknown> | Array<{
      agent: string
      result: string | Record<string, unknown>
    }>
    metadata: {
      agentsUsed: number
      executionMode: string
      reasoning: string
    }
  }
  metadata: {
    completedAt: string
    gateway: string
    traceId?: string
    workflowExecutionId?: string
    mode: string
  }
}

interface AgentNetworkVisualizationProps {
  isActive: boolean
  response: AgentNetworkResponse | null
}

function AgentNetworkVisualization({ isActive, response }: AgentNetworkVisualizationProps) {
  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case 'web-search':
        return <Search className="h-4 w-4" />
      case 'data-processor':
        return <Database className="h-4 w-4" />
      case 'summarizer':
        return <FileText className="h-4 w-4" />
      default:
        return <Bot className="h-4 w-4" />
    }
  }

  const getAgentDisplayName = (agentName: string) => {
    switch (agentName) {
      case 'web-search':
        return 'Web Search Agent'
      case 'data-processor':
        return 'Data Processor Agent'
      case 'summarizer':
        return 'Summarizer Agent'
      default:
        return agentName
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Network className="h-4 w-4" />
          AgentNetwork 実行状況
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isActive && !response && (
          <div className="text-center text-sm text-muted-foreground py-4">
            AgentNetwork実行時に協調プロセスが表示されます
          </div>
        )}

        {isActive && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-md">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">AgentNetwork 実行中...</span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                タスクを分析し、最適なエージェント協調戦略を決定しています
              </div>
            </div>
          </div>
        )}

        {response && (
          <div className="space-y-4">
            {/* Plan Display */}
            <div className="p-3 bg-green-50 rounded-md">
              <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">実行完了</span>
                <Badge variant="outline" className="text-xs">
                  {response.result.approach}
                </Badge>
              </div>
              <div className="text-xs text-green-600">
                {response.result.metadata.reasoning}
              </div>
            </div>

            {/* Agent Execution Flow */}
            {response.result.plan.agents && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  エージェント実行フロー
                </h4>
                
                {response.result.approach === 'parallel' ? (
                  <div className="grid grid-cols-1 gap-2">
                    {response.result.plan.agents.map((agent, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex items-center gap-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            {getAgentIcon(agent.name)}
                            <span className="font-medium">{getAgentDisplayName(agent.name)}</span>
                          </div>
                        </div>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {response.result.plan.agents
                      .sort((a, b) => a.priority - b.priority)
                      .map((agent, index) => (
                        <div key={index}>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="flex items-center gap-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                {getAgentIcon(agent.name)}
                                <span className="font-medium">{getAgentDisplayName(agent.name)}</span>
                              </div>
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          </div>
                          
                          <div className="text-xs pl-6 pr-2 py-1 text-green-600">
                            {agent.task}
                          </div>
                          
                          {index < response.result.plan.agents.length - 1 && (
                            <div className="flex justify-center py-1">
                              <ArrowRight className="h-4 w-4 text-green-400" />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Results Summary */}
            {response.result.executionResults && response.result.executionResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">実行結果サマリー</h4>
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-medium text-gray-700">使用エージェント数:</span>
                      <div>{response.result.metadata.agentsUsed}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">実行モード:</span>
                      <div>{response.result.metadata.executionMode}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Info */}
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="font-medium">🤖 AgentNetwork機能:</div>
                <div>• AIが最適なエージェント協調戦略を自動決定</div>
                <div>• タスクの複雑さに応じて順次実行または並列実行を選択</div>
                <div>• A2A通信による実際のエージェント連携を実行</div>
                <div className="text-blue-600 font-medium">
                  • モード: {response.metadata.mode}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AgentNetworkInterface() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<AgentNetworkResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<AgentNetworkFormData>({
    resolver: zodResolver(agentNetworkFormSchema),
    defaultValues: {
      query: '',
      context: '',
      options: {
        enableA2A: true,
        depth: 'comprehensive',
        audienceType: 'general',
        maxAgents: 3,
      },
    },
  })

  const onSubmit = async (values: AgentNetworkFormData) => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5分

      // context が空文字列の場合は undefined に変換
      const requestData = {
        ...values,
        context: values.context && values.context.trim() ? { description: values.context } : undefined
      }

      const res = await fetch('/api/network', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }

      const data: AgentNetworkResponse = await res.json()
      setResponse(data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('リクエストがタイムアウトしました。処理に時間がかかっています。')
      } else {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              AgentNetwork クエリ送信
            </CardTitle>
            <CardDescription>
              AgentNetworkがタスクを分析し、最適なエージェント協調戦略を決定します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>クエリ</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="例: AIの最新動向について調査して、技術的な詳細と市場への影響をまとめて"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        複雑なタスクや研究クエリを入力してください。AgentNetworkが最適な処理方法を決定します。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>コンテキスト（オプション）</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 企業向け技術調査、2024年の市場動向" {...field} />
                      </FormControl>
                      <FormDescription>
                        追加の背景情報や要求事項を入力してください
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="options.depth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>調査深度</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="深度を選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic">基本</SelectItem>
                            <SelectItem value="comprehensive">包括的</SelectItem>
                            <SelectItem value="expert">専門的</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="options.audienceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>対象オーディエンス</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="オーディエンスを選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="general">一般向け</SelectItem>
                            <SelectItem value="technical">技術者向け</SelectItem>
                            <SelectItem value="executive">経営陣向け</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="options.enableA2A"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enhanced A2A Mode</FormLabel>
                        <FormDescription>
                          AgentNetworkで計画を立て、A2A通信で実際のエージェントを実行
                        </FormDescription>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AgentNetwork実行中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      AgentNetworkを実行
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Results Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              実行結果
            </CardTitle>
            <CardDescription>
              AgentNetworkによる協調実行の結果がここに表示されます
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {response && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Network className="h-3 w-3" />
                    AgentNetwork
                  </Badge>
                  <Badge variant="secondary">{response.status}</Badge>
                  <Badge variant="outline">{response.result.approach}</Badge>
                </div>

                {/* Final Result Display */}
                <div className="rounded-md bg-slate-50 p-4">
                  <h4 className="mb-2 font-semibold">最終結果:</h4>
                  <div className="space-y-3">
                    {response.result.finalResult && typeof response.result.finalResult === 'object' ? (
                      <pre className="whitespace-pre-wrap text-sm text-slate-600 max-h-60 overflow-y-auto">
                        {JSON.stringify(response.result.finalResult, null, 2)}
                      </pre>
                    ) : response.result.finalResult ? (
                      <pre className="whitespace-pre-wrap text-sm text-slate-600">
                        {String(response.result.finalResult)}
                      </pre>
                    ) : (
                      <div className="text-sm text-slate-500">結果を処理中...</div>
                    )}
                  </div>
                </div>

                {/* Execution Plan */}
                {response.result.plan && (
                  <div className="rounded-md bg-blue-50 p-4">
                    <h4 className="mb-2 font-semibold text-blue-900">実行計画:</h4>
                    <div className="space-y-2 text-sm text-blue-800">
                      <div><strong>アプローチ:</strong> {response.result.plan.approach}</div>
                      <div><strong>理由:</strong> {response.result.plan.reasoning}</div>
                      {response.result.plan.agents && (
                        <div>
                          <strong>使用エージェント:</strong>
                          <ul className="ml-4 mt-1 space-y-1">
                            {response.result.plan.agents.map((agent, index) => (
                              <li key={index} className="flex items-center gap-2">
                                {getAgentIcon(agent.name)}
                                <span>{getAgentDisplayName(agent.name)}: {agent.task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  <p>完了時刻: {new Date(response.metadata.completedAt).toLocaleString('ja-JP')}</p>
                  <p>実行モード: {response.metadata.mode}</p>
                  {response.metadata.traceId && (
                    <p>トレースID: {response.metadata.traceId}</p>
                  )}
                </div>
              </div>
            )}

            {!response && !error && !loading && (
              <div className="flex h-32 items-center justify-center text-slate-500">
                <p>AgentNetworkクエリを送信すると結果がここに表示されます</p>
              </div>
            )}

            {loading && (
              <div className="flex h-32 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                  <p className="mt-2 text-slate-500">AgentNetworkが最適な戦略を決定中...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <AgentNetworkVisualization
          isActive={loading}
          response={response}
        />
      </div>
    </div>
  )
}

function getAgentIcon(agentName: string) {
  switch (agentName) {
    case 'web-search':
      return <Search className="h-3 w-3" />
    case 'data-processor':
      return <Database className="h-3 w-3" />
    case 'summarizer':
      return <FileText className="h-3 w-3" />
    default:
      return <Bot className="h-3 w-3" />
  }
}

function getAgentDisplayName(agentName: string) {
  switch (agentName) {
    case 'web-search':
      return 'Web Search Agent'
    case 'data-processor':
      return 'Data Processor Agent'
    case 'summarizer':
      return 'Summarizer Agent'
    default:
      return agentName
  }
}