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
  type: z.enum(['process', 'summarize', 'analyze', 'web-search', 'news-search', 'scholarly-search', 'deep-research']),
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
      processing: string | object
      summary: string | object
    }
    final_result?: object
  } | string | object
  metadata: {
    completedAt: string
    gateway: string
    traceId?: string
    workflowExecutionId?: string
  }
}

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'demo' | 'discovery' | 'communication'>('demo')
  const [taskProgress, setTaskProgress] = useState<{progress: number, phase: string} | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'process',
      data: '',
      context: '',
      audienceType: 'general',
    },
  })

  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 60; // 最大10分間（10秒間隔）
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await fetch(`/api/a2a/task/${taskId}`);
        if (res.ok) {
          const taskData = await res.json();
          console.log('📊 Polling taskData received:', taskData);
          
          // 新しいA2A形式に対応
          let status, progress, currentPhase, result;
          
          if (taskData.task) {
            // 新しいA2A形式
            status = taskData.task.status?.state;
            
            // artifactsから進捗情報を抽出
            const workflowArtifact = taskData.task.artifacts?.find((artifact: { type: string; metadata?: { progress?: number; currentPhase?: string }; data?: unknown }) => artifact.type === 'workflow-result');
            if (workflowArtifact?.metadata) {
              progress = workflowArtifact.metadata.progress;
              currentPhase = workflowArtifact.metadata.currentPhase;
            }
            result = workflowArtifact?.data;
          } else {
            // 従来形式のフォールバック
            status = taskData.status;
            progress = taskData.progress;
            currentPhase = taskData.currentPhase;
            result = taskData.result;
          }
          
          console.log('📊 Extracted status:', status, 'progress:', progress, 'phase:', currentPhase);
          
          // 進捗情報を更新 - 新旧両形式に対応
          if (progress !== undefined || currentPhase !== undefined) {
            setTaskProgress({
              progress: progress !== undefined ? progress : (taskProgress?.progress || 0),
              phase: currentPhase || taskProgress?.phase || 'search'
            });
          } else if (status === 'working' && taskData.task?.status?.message?.parts?.[0]?.text) {
            // メッセージから進捗情報を抽出 (フォールバック)
            const messageText = taskData.task.status.message.parts[0].text;
            const progressMatch = messageText.match(/(\d+)%/);
            
            // 日本語と英語のフェーズ名に対応
            const phaseMatch = messageText.match(/(search|analyze|synthesize|Web検索|データ分析|結果統合)/);
            
            if (progressMatch || phaseMatch) {
              let mappedPhase = phaseMatch ? phaseMatch[1] : (taskProgress?.phase || 'search');
              
              // 日本語フェーズ名を英語にマップ
              const phaseMap: Record<string, string> = {
                'Web検索フェーズ': 'search',
                'Web検索': 'search',
                'データ分析フェーズ': 'analyze', 
                'データ分析': 'analyze',
                '結果統合フェーズ': 'synthesize',
                '結果統合': 'synthesize'
              };
              mappedPhase = phaseMap[mappedPhase] || mappedPhase;
              
              setTaskProgress({
                progress: progressMatch ? parseInt(progressMatch[1]) : (taskProgress?.progress || 0),
                phase: mappedPhase
              });
            }
          }

          if (status === 'completed') {
            console.log('✅ Task completed - updating response and stopping polling');
            // 完了時の応答形式を既存のAPIResponseに合わせる
            setResponse({
              status: 'success',
              type: 'deep-research',
              result: result,
              metadata: {
                completedAt: new Date().toISOString(),
                gateway: 'gateway-agent',
                traceId: taskData.task?.id || taskId,
                workflowExecutionId: taskData.task?.id || taskId,
              }
            });
            setLoading(false);
            setTaskProgress(null);
            setCurrentTaskId(null);
            return;
          } else if (status === 'failed') {
            setError(`Deep Research failed: ${taskData.task?.status?.message?.parts?.[0]?.text || 'Unknown error'}`);
            setLoading(false);
            setTaskProgress(null);
            setCurrentTaskId(null);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // 10秒後に再試行
        } else {
          setError('Deep Research timed out. The task may still be running.');
          setLoading(false);
          setTaskProgress(null);
          setCurrentTaskId(null);
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        } else {
          setError('Failed to poll task status');
          setLoading(false);
          setTaskProgress(null);
          setCurrentTaskId(null);
        }
      }
    };

    // 初回ポーリングを開始
    setTimeout(poll, 5000); // 5秒後に開始
  };

  const onSubmit = async (values: FormData) => {
    setLoading(true)
    setError(null)
    setResponse(null)
    setTaskProgress(null)
    setCurrentTaskId(null)

    try {
      // Deep Researchは新しいエンドポイントを使用
      const isDeepResearch = values.type === 'deep-research';
      const endpoint = isDeepResearch ? '/api/a2a/agents' : '/api/request';
      
      const requestBody = isDeepResearch ? {
        type: values.type,
        topic: values.data, // Deep Researchではtopicとして送信
        options: {
          depth: 'comprehensive',
          sources: ['web', 'news'],
          audienceType: values.audienceType || 'general',
        },
        context: values.context ? { description: values.context } : undefined,
        audienceType: values.audienceType,
      } : {
        type: values.type,
        data: values.type.includes('search') 
          ? values.data  // For search tasks, use data as query
          : (values.data.startsWith('{') ? JSON.parse(values.data) : values.data),
        query: values.type.includes('search') ? values.data : undefined,
        context: values.context ? { description: values.context } : undefined,
        audienceType: values.audienceType,
      };

      // タイムアウト付きのfetchを実装
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), isDeepResearch ? 600000 : 120000) // Deep Researchは10分

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      
      // Deep Researchの場合は非同期処理
      if (isDeepResearch && data.taskId) {
        // タスクIDを受信したので、ポーリングを開始
        setCurrentTaskId(data.taskId)
        pollTaskStatus(data.taskId)
      } else {
        setResponse(data)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('リクエストがタイムアウトしました。処理に時間がかかっています。')
      } else {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      }
    } finally {
      if (!form.getValues('type') || form.getValues('type') !== 'deep-research') {
        setLoading(false)
      }
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
      case 'deep-research':
        return <Bot className="h-4 w-4" />
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
      case 'deep-research':
        return '多段階の深い研究を実行します（非同期・長時間処理）'
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
                                    <SelectItem value="deep-research">
                                      <div className="flex items-center gap-2">
                                        <Bot className="h-4 w-4" />
                                        Deep Research
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
                                      form.watch('type') === 'deep-research'
                                        ? '例: AI in healthcare 2024, blockchain technology trends'
                                        : form.watch('type')?.includes('search') 
                                        ? '例: TypeScript 最新情報, 人工知能 市場動向'
                                        : '例: {"sales": [100, 150, 200], "products": ["A", "B", "C"]}'
                                    }
                                    className="min-h-[100px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {form.watch('type') === 'deep-research'
                                    ? '研究トピックを英語または日本語で入力してください'
                                    : form.watch('type')?.includes('search')
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

                          <Button type="submit" className="w-full" disabled={loading || Boolean(currentTaskId)}>
                            {loading || Boolean(currentTaskId) ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {form.getValues('type') === 'deep-research' && currentTaskId ? 'Deep Research実行中...' : '処理中...'}
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
                              {response.type === 'deep-research' ? 'Deep Research' : response.type}
                            </Badge>
                            <Badge variant="secondary">{response.status}</Badge>
                          </div>

                          <div className="rounded-md bg-slate-50 p-4">
                            <h4 className="mb-2 font-semibold">
                              {response.type === 'deep-research' ? 'Deep Research結果:' : '処理結果:'}
                            </h4>
                            {response.type === 'deep-research' && typeof response.result === 'object' ? (
                              <div className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-slate-700">エグゼクティブサマリー:</h5>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {(response.result as Record<string, unknown>)?.executiveSummary as string || 'サマリーが生成されませんでした'}
                                  </pre>
                                </div>
                                {Array.isArray((response.result as Record<string, unknown>)?.keyFindings) && (
                                  <div>
                                    <h5 className="font-medium text-slate-700">主要な発見:</h5>
                                    <div className="mt-1 text-sm text-slate-600">
                                      {((response.result as Record<string, unknown>).keyFindings as string[]).map((finding: string, index: number) => (
                                        <div key={index} className="py-1">• {finding}</div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {Array.isArray((response.result as Record<string, unknown>)?.recommendations) && (
                                  <div>
                                    <h5 className="font-medium text-slate-700">推奨事項:</h5>
                                    <div className="mt-1 text-sm text-slate-600">
                                      {((response.result as Record<string, unknown>).recommendations as string[]).map((rec: string, index: number) => (
                                        <div key={index} className="py-1">• {rec}</div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {typeof (response.result as Record<string, unknown>)?.fullReport === 'string' && (
                                  <div>
                                    <h5 className="font-medium text-slate-700">詳細レポート:</h5>
                                    <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-600 max-h-60 overflow-y-auto">
                                      {(response.result as Record<string, unknown>).fullReport as string}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ) : response.type === 'analyze' && typeof response.result === 'object' && response.result && 'workflow' in response.result ? (
                              <div className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-slate-700">データ処理結果:</h5>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {response.result.steps && typeof response.result.steps.processing === 'string'
                                      ? response.result.steps.processing
                                      : JSON.stringify(response.result.steps?.processing || '', null, 2)
                                    }
                                  </pre>
                                </div>
                                <div>
                                  <h5 className="font-medium text-slate-700">要約結果:</h5>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {response.result.steps && typeof response.result.steps.summary === 'string'
                                      ? response.result.steps.summary
                                      : JSON.stringify(response.result.steps?.summary || '', null, 2)
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

                      {!response && !error && !loading && !currentTaskId && (
                        <div className="flex h-32 items-center justify-center text-slate-500">
                          <p>リクエストを送信すると結果がここに表示されます</p>
                        </div>
                      )}

                      {(loading || currentTaskId) && (
                        <div className="flex h-32 items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                            <p className="mt-2 text-slate-500">
                              {taskProgress && currentTaskId ? (
                                <>
                                  Deep Research実行中... ({taskProgress.progress}%)
                                  <br />
                                  <span className="text-xs text-slate-400">
                                    フェーズ: {taskProgress.phase === 'search' ? 'Web検索' : 
                                               taskProgress.phase === 'analyze' ? 'データ分析' :
                                               taskProgress.phase === 'synthesize' ? '結果統合' : taskProgress.phase}
                                  </span>
                                </>
                              ) : currentTaskId ? (
                                'Deep Research開始中...'
                              ) : (
                                'エージェント間で処理中...'
                              )}
                            </p>
                            {taskProgress && (
                              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${taskProgress.progress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="lg:col-span-1">
                <A2AVisualization
                  isActive={loading || Boolean(currentTaskId)}
                  taskType={loading ? form.getValues('type') : (response ? response.type as 'process' | 'summarize' | 'analyze' | 'web-search' | 'news-search' | 'scholarly-search' | 'deep-research' : null)}
                  workflowExecutionId={response?.metadata?.workflowExecutionId}
                  taskId={currentTaskId || undefined}
                  taskProgress={taskProgress}
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