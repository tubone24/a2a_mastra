'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, Database, FileText, Search, Activity, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentInfo {
  id: string
  name: string
  type: string
  description?: string
  capabilities: string[]
  endpoint: string
  status: 'online' | 'offline' | 'unknown'
  version?: string
  supportedProtocols?: string[]
  supportedTaskTypes?: string[]
  supportedAudienceTypes?: string[]
  supportedMessageTypes?: string[]
}

interface DiscoveryResult {
  gateway: {
    id: string
    name: string
    status: string
  }
  connectedAgents: AgentInfo[]
  totalAgents: number
}

export function AgentDiscovery() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'gateway':
        return <Bot className="h-5 w-5" />
      case 'processor':
        return <Database className="h-5 w-5" />
      case 'summarizer':
        return <FileText className="h-5 w-5" />
      case 'web-search':
        return <Search className="h-5 w-5" />
      default:
        return <Bot className="h-5 w-5" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const discoverAgents = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Get gateway info and connected agents
      const response = await fetch('/api/a2a/agents')
      
      if (!response.ok) {
        throw new Error(`Failed to discover agents: ${response.statusText}`)
      }
      
      const discoveryResult: DiscoveryResult = await response.json()
      
      // Add gateway to agents list
      const allAgents: AgentInfo[] = [
        {
          id: discoveryResult.gateway.id,
          name: discoveryResult.gateway.name,
          type: 'gateway',
          description: 'ゲートウェイエージェント - リクエストを受信し、適切なエージェントにルーティングします',
          capabilities: ['routing', 'orchestration', 'workflow-management'],
          endpoint: window.location.origin,
          status: discoveryResult.gateway.status as 'online' | 'offline' | 'unknown',
          supportedProtocols: ['A2A', 'HTTP'],
        },
        ...discoveryResult.connectedAgents
      ]
      
      setAgents(allAgents)
      setLastUpdated(new Date())
      
    } catch (err) {
      console.error('Agent discovery failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to discover agents')
      
      // Fallback: show gateway only
      setAgents([{
        id: 'gateway-agent-01',
        name: 'Gateway Agent',
        type: 'gateway',
        description: 'ゲートウェイエージェント',
        capabilities: ['routing'],
        endpoint: window.location.origin,
        status: 'unknown',
      }])
    } finally {
      setIsLoading(false)
    }
  }


  useEffect(() => {
    discoverAgents()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">エージェントディスカバリー</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={discoverAgents}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            更新
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground">
            最終更新: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {isLoading && agents.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>エージェントを検索中...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>{agents.length}個のエージェントが見つかりました</span>
            </div>
            
            {agents.map((agent) => (
              <Card key={agent.id} className="relative">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        agent.status === 'online' && "bg-green-100",
                        agent.status === 'offline' && "bg-red-100",
                        agent.status === 'unknown' && "bg-yellow-100"
                      )}>
                        {getAgentIcon(agent.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{agent.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {agent.type}
                          </Badge>
                          {agent.version && (
                            <Badge variant="outline" className="text-xs">
                              v{agent.version}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {agent.description || `${agent.type} agent`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {agent.id}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(agent.status)}
                      <span className="text-sm font-medium">
                        {agent.status === 'online' ? 'オンライン' : 
                         agent.status === 'offline' ? 'オフライン' : '不明'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-2">機能</h4>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map((capability) => (
                          <Badge key={capability} variant="outline" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {agent.supportedTaskTypes && agent.supportedTaskTypes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">対応タスク</h4>
                        <div className="flex flex-wrap gap-1">
                          {agent.supportedTaskTypes.map((taskType) => (
                            <Badge key={taskType} variant="secondary" className="text-xs">
                              {taskType}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {agent.supportedProtocols && agent.supportedProtocols.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">対応プロトコル</h4>
                        <div className="flex flex-wrap gap-1">
                          {agent.supportedProtocols.map((protocol) => (
                            <Badge 
                              key={protocol} 
                              variant={protocol === 'A2A' ? 'default' : 'outline'} 
                              className="text-xs"
                            >
                              {protocol}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Endpoint: {agent.endpoint}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {!isLoading && agents.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-xs text-blue-700 space-y-1">
              <div className="font-medium">💡 エージェント発見について:</div>
              <div>• Gateway Agentが/api/a2a/agentsエンドポイント経由でエージェントを検索</div>
              <div>• 各エージェントの能力、対応タスク、プロトコル情報を表示</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}