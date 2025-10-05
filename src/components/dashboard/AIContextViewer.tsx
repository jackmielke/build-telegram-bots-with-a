import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, User, ChevronDown, Database, MessageSquare, Brain, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIContextViewerProps {
  messageId: string;
  conversationId: string;
  communityId: string;
}

interface ContextData {
  systemPrompt: string;
  memories: Array<{ id: string; content: string; tags: string[] }>;
  conversationHistory: Array<{ role: string; content: string; sent_by: string }>;
  modelConfig: {
    model: string;
    temperature?: number;
    max_tokens?: number;
  };
  timestamp: string;
}

export const AIContextViewer = ({ messageId, conversationId, communityId }: AIContextViewerProps) => {
  const [context, setContext] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    reconstructContext();
  }, [messageId]);

  const reconstructContext = async () => {
    try {
      setLoading(true);

      // Get the AI message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (msgError) throw msgError;

      const metadata = message.metadata as any;
      const memoryIds = metadata?.ai_context?.memory_ids || [];
      const contextMessageCount = metadata?.ai_context?.context_message_count || 7;

      // Fetch community settings (for system prompt)
      const { data: community, error: commError } = await supabase
        .from('communities')
        .select('agent_instructions, agent_model, agent_temperature, agent_max_tokens, agent_name')
        .eq('id', communityId)
        .single();

      if (commError) throw commError;

      // Fetch the actual memories that were used (by IDs)
      let memories: any[] = [];
      if (memoryIds.length > 0) {
        const { data: memData } = await supabase
          .from('memories')
          .select('id, content, tags')
          .in('id', memoryIds)
          .order('created_at', { ascending: false });
        
        memories = memData || [];
      }

      // Fetch the conversation history (messages before this AI response)
      const { data: historyData } = await supabase
        .from('messages')
        .select(`
          content,
          sent_by,
          users:sender_id(name)
        `)
        .eq('conversation_id', conversationId)
        .lt('created_at', message.created_at)
        .order('created_at', { ascending: false })
        .limit(contextMessageCount);

      // Build conversation history in OpenAI format
      const conversationHistory = (historyData || []).reverse().map(msg => ({
        role: msg.sent_by === 'ai' ? 'assistant' : 'user',
        content: msg.content,
        sent_by: msg.sent_by || 'unknown'
      }));

      // Build system prompt (exactly as it would be sent to AI)
      let systemPrompt = `You are ${community.agent_name || 'a helpful AI assistant'}.

${community.agent_instructions || 'Help users with their questions.'}`;

      if (memories.length > 0) {
        systemPrompt += `\n\n## Community Knowledge Base\n\n`;
        systemPrompt += memories.map(m => `- ${m.content}`).join('\n');
      }

      setContext({
        systemPrompt,
        memories,
        conversationHistory,
        modelConfig: {
          model: metadata?.model_used || community.agent_model,
          temperature: community.agent_temperature,
          max_tokens: community.agent_max_tokens
        },
        timestamp: message.created_at
      });

    } catch (error) {
      console.error('Error reconstructing context:', error);
      toast({
        title: "Error",
        description: "Failed to reconstruct AI context",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const redactSecrets = (text: string) => {
    if (!text) return text;
    return text
      .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***REDACTED***')
      .replace(/Bearer [a-zA-Z0-9_-]+/g, 'Bearer ***REDACTED***')
      .replace(/[0-9]{10,}:[A-Za-z0-9_-]{35}/g, '***REDACTED***');
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading context...</div>;
  }

  if (!context) {
    return <div className="text-center py-8 text-muted-foreground">No context available</div>;
  }

  // Build the exact payload that would be sent to the AI
  const exactPayload = {
    model: context.modelConfig.model,
    messages: [
      { role: 'system', content: context.systemPrompt },
      ...context.conversationHistory
    ],
    ...(context.modelConfig.temperature && { temperature: context.modelConfig.temperature }),
    ...(context.modelConfig.max_tokens && { max_tokens: context.modelConfig.max_tokens })
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-primary">
            Live Context Mirror
          </Badge>
          <span className="text-xs text-muted-foreground">
            Exact context at {new Date(context.timestamp).toLocaleString()}
          </span>
        </div>
        <Badge variant="outline">
          <Settings className="w-3 h-3 mr-1" />
          {context.modelConfig.model}
        </Badge>
      </div>

      {/* Full Payload Preview */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Full API Payload (JSON)</span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ScrollArea className="h-[300px]">
            <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
              {JSON.stringify(exactPayload, null, 2)}
            </pre>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* System Prompt */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">System Instructions</span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="bg-muted p-4 rounded-lg">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {redactSecrets(context.systemPrompt)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Memories */}
      {context.memories.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Memories ({context.memories.length})</span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              {context.memories.map((memory, idx) => (
                <Card key={memory.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                      <div className="flex-1">
                        <p className="text-sm">{memory.content}</p>
                        {memory.tags && memory.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {memory.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Conversation History */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">
              Conversation History ({context.conversationHistory.length} messages)
            </span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2">
            {context.conversationHistory.map((msg, idx) => (
              <div key={idx} className="flex gap-2">
                {msg.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={msg.role === 'assistant' ? 'default' : 'outline'} className="text-xs">
                      {msg.role}
                    </Badge>
                  </div>
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      msg.role === 'assistant'
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted border border-border'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans">
                      {msg.content}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Model Config */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Model Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Model</p>
              <p className="font-mono">{context.modelConfig.model}</p>
            </div>
            {context.modelConfig.temperature !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Temperature</p>
                <p className="font-mono">{context.modelConfig.temperature}</p>
              </div>
            )}
            {context.modelConfig.max_tokens && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Max Tokens</p>
                <p className="font-mono">{context.modelConfig.max_tokens}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
