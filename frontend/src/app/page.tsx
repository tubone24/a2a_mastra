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
import { Loader2, Send, CheckCircle, AlertCircle, Bot, Database, FileText, Search } from "lucide-react"
import { A2AVisualization } from "@/components/A2AVisualization"
import { AgentDiscovery } from "@/components/AgentDiscovery"
import { AgentCommunicationTest } from "@/components/AgentCommunicationTest"

const formSchema = z.object({
  type: z.enum(['process', 'summarize', 'analyze', 'web-search', 'news-search', 'scholarly-search']),
  data: z.string().min(1, "データまたは検索クエリを入力してください"),
  context: z.string().optional(),
  audienceType: z.enum(['technical', 'executive', 'general']).optional(),
})

type FormData = z.infer<typeof formSchema>

interface ApiResponse {
  status: string
  type: string
  result: {
    workflow?: string
    steps?: {
      processing: {
        result: string | object
      }
      summary: {
        summary: string | object
      }
    }
    final_result?: object
  } | string | object
  metadata: {
    completedAt: string
    gateway: string
  }
}

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'demo' | 'discovery' | 'communication'>('demo')

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'process',
      data: '',
      context: '',
      audienceType: 'general',
    },
  })

  const onSubmit = async (values: FormData) => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const requestBody = {
        type: values.type,
        data: values.type.includes('search') 
          ? values.data  // For search tasks, use data as query
          : (values.data.startsWith('{') ? JSON.parse(values.data) : values.data),
        query: values.type.includes('search') ? values.data : undefined,
        context: values.context ? { description: values.context } : undefined,
        audienceType: values.audienceType,
      } as {
        type: string
        data: string | object
        query?: string
        context?: { description: string }
        audienceType?: string
      }

      const res = await fetch('/api/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'process':
        return <Database className="h-4 w-4" />
      case 'summarize':
        return <FileText className="h-4 w-4" />
      case 'analyze':
        return <Bot className="h-4 w-4" />
      case 'web-search':
      case 'news-search':
      case 'scholarly-search':
        return <Search className="h-4 w-4" />
      default:
        return <Bot className="h-4 w-4" />
    }
  }

  const getTaskDescription = (type: string) => {
    switch (type) {
      case 'process':
        return 'データの処理とクリーニングを行います'
      case 'summarize':
        return 'データの要約を作成します'
      case 'analyze':
        return 'データの分析と要約の両方を実行します'
      case 'web-search':
        return 'Webからリアルタイムの情報を検索します'
      case 'news-search':
        return '最新のニュース記事を検索します'
      case 'scholarly-search':
        return '学術論文や研究資料を検索します'
      default:
        return ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-slate-900">
            Mastra A2A Demo
          </h1>
          <p className="text-slate-600">
            Agent-to-Agent プロトコルを使用したマルチエージェント通信デモ
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Gateway Agent
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              Data Processor
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Summarizer
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              Web Search
            </Badge>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex space-x-1 rounded-lg bg-gray-100 p-1">
            <button
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'demo'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('demo')}
            >
              A2Aデモ
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'discovery'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('discovery')}
            >
              エージェント発見
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'communication'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('communication')}
            >
              通信テスト
            </button>
          </div>
        </div>

        {activeTab === 'demo' && (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        リクエスト送信
                      </CardTitle>
                      <CardDescription>
                        A2Aエージェントにタスクを送信して結果を確認できます
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>タスクタイプ</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="タスクタイプを選択" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="process">
                                      <div className="flex items-center gap-2">
                                        <Database className="h-4 w-4" />
                                        データ処理
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="summarize">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        要約作成
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="analyze">
                                      <div className="flex items-center gap-2">
                                        <Bot className="h-4 w-4" />
                                        分析ワークフロー
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="web-search">
                                      <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4" />
                                        Web検索
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="news-search">
                                      <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4" />
                                        ニュース検索
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="scholarly-search">
                                      <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4" />
                                        学術検索
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  {getTaskDescription(field.value)}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="data"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>データ</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder={
                                      form.watch('type')?.includes('search') 
                                        ? '例: TypeScript 最新情報, 人工知能 市場動向'
                                        : '例: {"sales": [100, 150, 200], "products": ["A", "B", "C"]}'
                                    }
                                    className="min-h-[100px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {form.watch('type')?.includes('search')
                                    ? '検索クエリを日本語または英語で入力してください'
                                    : 'JSON形式またはテキスト形式でデータを入力してください'
                                  }
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
                                  <Input placeholder="例: Q1 2024の売上データ" {...field} />
                                </FormControl>
                                <FormDescription>
                                  データの説明や背景情報を入力してください
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="audienceType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>対象オーディエンス</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="オーディエンスタイプを選択" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="general">一般向け</SelectItem>
                                    <SelectItem value="technical">技術者向け</SelectItem>
                                    <SelectItem value="executive">経営陣向け</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  結果の表示形式を決定します
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                処理中...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                送信
                              </>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        結果
                      </CardTitle>
                      <CardDescription>
                        エージェントからの応答がここに表示されます
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
                              {getTaskIcon(response.type)}
                              {response.type}
                            </Badge>
                            <Badge variant="secondary">{response.status}</Badge>
                          </div>

                          <div className="rounded-md bg-slate-50 p-4">
                            <h4 className="mb-2 font-semibold">処理結果:</h4>
                            {response.type === 'analyze' && typeof response.result === 'object' && response.result && 'workflow' in response.result ? (
                              <div className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-slate-700">データ処理結果:</h5>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {response.result.steps && typeof response.result.steps.processing.result === 'string'
                                      ? response.result.steps.processing.result
                                      : JSON.stringify(response.result.steps?.processing.result || '', null, 2)
                                    }
                                  </pre>
                                </div>
                                <div>
                                  <h5 className="font-medium text-slate-700">要約結果:</h5>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {response.result.steps && typeof response.result.steps.summary.summary === 'string'
                                      ? response.result.steps.summary.summary
                                      : JSON.stringify(response.result.steps?.summary.summary || '', null, 2)
                                    }
                                  </pre>
                                </div>
                              </div>
                            ) : response.type.includes('search') && typeof response.result === 'object' && response.result && 'result' in response.result ? (
                              <div className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-slate-700">検索クエリ:</h5>
                                  <p className="mt-1 text-sm text-slate-600">{(response.result as { result?: { query?: string } }).result?.query || 'N/A'}</p>
                                </div>
                                <div>
                                  <h5 className="font-medium text-slate-700">検索結果要約:</h5>
                                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {(response.result as { result?: { summary?: string } }).result?.summary || 'N/A'}
                                  </div>
                                </div>
                                {(response.result as { result?: { results?: Array<{ title: string; url: string; snippet: string; source?: string }> } }).result?.results && (
                                  <div>
                                    <h5 className="font-medium text-slate-700">検索結果 ({(response.result as { result: { results: Array<unknown> } }).result.results.length}件):</h5>
                                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                      {(response.result as { result: { results: Array<{ title: string; url: string; snippet: string; source?: string }> } }).result.results.slice(0, 5).map((item, index: number) => (
                                        <div key={index} className="border-l-2 border-blue-200 pl-3">
                                          <h6 className="font-medium text-blue-900 text-sm">{item.title}</h6>
                                          <p className="text-xs text-slate-600 mt-1">{item.snippet}</p>
                                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                            {item.source || item.url}
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap text-sm text-slate-600">
                                {typeof response.result === 'string'
                                  ? response.result
                                  : JSON.stringify(response.result, null, 2)
                                }
                              </pre>
                            )}
                          </div>

                          <div className="text-xs text-slate-500">
                            <p>完了時刻: {new Date(response.metadata.completedAt).toLocaleString('ja-JP')}</p>
                            <p>処理エージェント: {response.metadata.gateway}</p>
                          </div>
                        </div>
                      )}

                      {!response && !error && !loading && (
                        <div className="flex h-32 items-center justify-center text-slate-500">
                          <p>リクエストを送信すると結果がここに表示されます</p>
                        </div>
                      )}

                      {loading && (
                        <div className="flex h-32 items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                            <p className="mt-2 text-slate-500">エージェント間で処理中...</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="lg:col-span-1">
                <A2AVisualization
                  isActive={loading}
                  taskType={loading ? form.getValues('type') : null}
                />
              </div>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>サンプルデータ</CardTitle>
                <CardDescription>
                  以下のサンプルデータを使用してテストできます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <div className="rounded-md bg-slate-50 p-3">
                    <h4 className="mb-2 font-medium">売上データ</h4>
                    <pre className="text-xs text-slate-600">
{`{
  "sales": [100, 150, 200, 175, 250],
  "products": ["A", "B", "C", "D", "E"],
  "quarter": "Q1 2024"
}`}
                    </pre>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <h4 className="mb-2 font-medium">顧客データ</h4>
                    <pre className="text-xs text-slate-600">
{`{
  "customers": [
    {"id": 1, "purchases": 5, "value": 500},
    {"id": 2, "purchases": 3, "value": 300},
    {"id": 3, "purchases": 8, "value": 800}
  ]
}`}
                    </pre>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <h4 className="mb-2 font-medium">テキストデータ</h4>
                    <pre className="text-xs text-slate-600">
{`2024年第1四半期の業績は前年同期比で
20%の成長を記録しました。特に新製品
ラインの好調な売れ行きが貢献しており、
今後の展開が期待されます。`}
                    </pre>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <h4 className="mb-2 font-medium">Web検索クエリ</h4>
                    <pre className="text-xs text-slate-600">
{`TypeScript 5.0 新機能
人工知能 最新動向 2024
React Server Components 使い方`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'discovery' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <AgentDiscovery />
            <Card>
              <CardHeader>
                <CardTitle>A2Aプロトコル情報</CardTitle>
                <CardDescription>
                  実装されているA2A標準機能
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">エージェントカード取得 (getAgentCard)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">メッセージ送信 (sendMessage)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">タスク状態取得 (getTask)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">タスクキャンセル (cancelTask)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">エージェント発見</span>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-md">
                  <h4 className="font-medium text-blue-900 mb-2">標準エンドポイント</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div><code>/api/a2a/agent</code> - エージェント情報</div>
                    <div><code>/api/a2a/message</code> - メッセージング</div>
                    <div><code>/api/a2a/task</code> - タスク管理</div>
                    <div><code>/api/a2a/agents</code> - エージェント一覧</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'communication' && (
          <AgentCommunicationTest />
        )}
      </div>
    </div>
  )
}