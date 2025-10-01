import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Bot, User, Calendar, DollarSign, BarChart3, Download, Eye, ChevronDown, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  sent_by: string | null;
  chat_type: string;
  created_at: string;
  metadata: any;
  message_type: string;
  users?: {
    name: string;
    avatar_url: string;
  };
}

interface ConversationViewerProps {
  conversationId: string;
  communityId: string;
  onBack: () => void;
}

const ConversationViewer = ({ conversationId, communityId, onBack }: ConversationViewerProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationStats, setConversationStats] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const MESSAGES_PER_PAGE = 50;
  const { toast } = useToast();

  useEffect(() => {
    fetchConversation();
    fetchConversationStats();
    
    // Set up real-time subscription for new messages in this conversation
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, page]);

  const fetchConversation = async () => {
    try {
      const from = page * MESSAGES_PER_PAGE;
      const to = from + MESSAGES_PER_PAGE - 1;
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          users:sender_id (
            name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .eq('community_id', communityId)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (error) throw error;
      
      setHasMore(data && data.length === MESSAGES_PER_PAGE);
      setMessages(prev => page === 0 ? (data || []) : [...prev, ...(data || [])]);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationStats = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('community_id', communityId)
        .eq('metadata->>conversation_id', conversationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setConversationStats(data);
    } catch (error) {
      console.error('Error fetching conversation stats:', error);
    }
  };

  const exportConversation = () => {
    const conversationText = messages.map(msg => {
      const sender = msg.sent_by === 'ai' ? 'AI Assistant' : (msg.users?.name || 'User');
      const timestamp = new Date(msg.created_at).toLocaleString();
      return `[${timestamp}] ${sender}:\n${msg.content}\n`;
    }).join('\n');

    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Conversation exported successfully"
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const viewPrompt = async (messageId: string) => {
    try {
      // Fetch the specific message with all metadata
      const { data: message, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error) throw error;

      // Fetch the 7 messages that came BEFORE this AI response (sliding window context)
      const { data: contextMessages } = await supabase
        .from('messages')
        .select(`
          *,
          users:sender_id (
            name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .lt('created_at', message.created_at)
        .order('created_at', { ascending: false })
        .limit(7);

      // Fetch ALL community memories (not just the 10 sent to AI)
      const { data: allMemories } = await supabase
        .from('memories')
        .select('id, content, created_at, tags')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      // Fetch related ai_chat_session if available
      const metadata = message.metadata as any;
      const { data: session } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('community_id', communityId)
        .eq('metadata->>telegram_chat_id', metadata?.telegram_chat_id || '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch community settings for system prompt
      const { data: community } = await supabase
        .from('communities')
        .select('agent_instructions, agent_name, agent_model')
        .eq('id', communityId)
        .single();

      setSelectedPrompt({
        message,
        session,
        community,
        contextMessages: contextMessages?.reverse() || [], // Reverse to show chronological order
        allMemories: allMemories || []
      });
      setPromptDialogOpen(true);
    } catch (error) {
      console.error('Error fetching prompt details:', error);
      toast({
        title: "Error",
        description: "Failed to load prompt details",
        variant: "destructive"
      });
    }
  };

  const redactSecrets = (text: string) => {
    if (!text) return text;
    // Redact API keys, tokens, and other secrets
    return text
      .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***REDACTED***')
      .replace(/Bearer [a-zA-Z0-9_-]+/g, 'Bearer ***REDACTED***')
      .replace(/[0-9]{10,}:[A-Za-z0-9_-]{35}/g, '***REDACTED***'); // Telegram bot tokens
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Conversation Details
                </CardTitle>
                <CardDescription className="mt-1">
                  {messages.length} messages
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={exportConversation}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      {conversationStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Tokens Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {conversationStats.tokens_used?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Model: {conversationStats.model_used}
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(conversationStats.cost_usd || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total conversation cost
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {conversationStats.message_count || messages.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total messages exchanged
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle>Conversation Thread</CardTitle>
          <CardDescription>
            Full message history from this conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && page === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Loading messages...</div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              {hasMore && messages.length >= MESSAGES_PER_PAGE && (
                <div className="pb-4 text-center">
                  <Button 
                    onClick={loadMore} 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Load Earlier Messages'}
                  </Button>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((message) => {
                const isAI = message.sent_by === 'ai' || message.chat_type === 'ai';
                const userName = message.users?.name || 'User';
                const avatarUrl = message.users?.avatar_url;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      {isAI ? (
                        <>
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="w-4 h-4 text-primary" />
                          </AvatarFallback>
                        </>
                      ) : (
                        <>
                          <AvatarImage src={avatarUrl} alt={userName} />
                          <AvatarFallback className="bg-muted">
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>

                      <div className={`flex-1 ${isAI ? 'mr-12' : 'ml-12'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {isAI ? 'AI Assistant' : userName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {message.message_type}
                        </Badge>
                        {isAI && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewPrompt(message.id)}
                            className="h-6 px-2"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span className="text-xs">View Prompt</span>
                          </Button>
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-3 ${
                          isAI
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-muted border border-border'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Prompt Viewer Dialog */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI Prompt Context</DialogTitle>
            <DialogDescription>
              Full context sent to the AI model for this message
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {selectedPrompt && (
              <div className="space-y-4 pr-4">
                {/* System Prompt */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    System Instructions
                  </h3>
                  <div className="bg-muted p-3 rounded-lg font-mono text-xs whitespace-pre-wrap">
                    {redactSecrets(selectedPrompt.community?.agent_instructions || 'No system instructions set')}
                  </div>
                </div>

                {/* Community Memories - ALL MEMORIES */}
                {selectedPrompt.allMemories && selectedPrompt.allMemories.length > 0 && (
                  <Collapsible className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Community Memories ({selectedPrompt.allMemories.length} total)
                      </h3>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                          <ChevronDown className="h-4 w-4" />
                          <span className="sr-only">Toggle memories</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All community memories are sent to the AI. This shows all {selectedPrompt.allMemories.length} memories in the community.
                    </p>
                    <CollapsibleContent className="space-y-2">
                      <ScrollArea className="h-64 border rounded-lg bg-background">
                        <div className="p-3 space-y-3">
                          {selectedPrompt.allMemories.map((memory: any) => (
                            <div key={memory.id} className="border-b border-border/50 pb-2 last:border-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(memory.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {memory.tags && memory.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {memory.tags.map((tag: string) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{memory.content}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Model Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Model</p>
                    <Badge>{selectedPrompt.session?.model_used || selectedPrompt.community?.agent_model || 'Unknown'}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Agent Name</p>
                    <Badge variant="outline">{selectedPrompt.community?.agent_name || 'AI Assistant'}</Badge>
                  </div>
                </div>

                {/* Message Metadata */}
                {selectedPrompt.message?.metadata && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Message Metadata</h3>
                    <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(selectedPrompt.message.metadata, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Session Analytics */}
                {selectedPrompt.session && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Session Analytics</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted p-2 rounded">
                        <p className="text-xs text-muted-foreground">Tokens Used</p>
                        <p className="font-semibold">{selectedPrompt.session.tokens_used}</p>
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <p className="text-xs text-muted-foreground">Cost</p>
                        <p className="font-semibold">${selectedPrompt.session.cost_usd.toFixed(4)}</p>
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <p className="text-xs text-muted-foreground">Response Time</p>
                        <p className="font-semibold">
                          {selectedPrompt.session.metadata?.response_time_ms 
                            ? `${selectedPrompt.session.metadata.response_time_ms}ms`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conversation Context - THE 7 MESSAGES THE AI SAW */}
                {selectedPrompt.contextMessages && selectedPrompt.contextMessages.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Conversation Context ({selectedPrompt.contextMessages.length} messages)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      These are the previous messages the AI had access to when generating this response (sliding window of 7 messages)
                    </p>
                    <ScrollArea className="h-64 border rounded-lg">
                      <div className="p-3 space-y-3">
                        {selectedPrompt.contextMessages.map((msg: any) => {
                          const isAI = msg.sent_by === 'ai';
                          return (
                            <div key={msg.id} className={`flex gap-2 ${isAI ? 'justify-start' : 'justify-end'}`}>
                              {isAI && (
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                    AI
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={`flex-1 max-w-[80%] ${isAI ? '' : 'text-right'}`}>
                                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                                  <span>{isAI ? 'AI' : (msg.users?.name || msg.sent_by || 'User')}</span>
                                  <span>•</span>
                                  <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div className={`rounded-lg p-2 text-sm ${
                                  isAI ? 'bg-primary/10' : 'bg-muted'
                                }`}>
                                  {msg.content}
                                </div>
                              </div>
                              {!isAI && (
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={msg.users?.avatar_url} />
                                  <AvatarFallback className="text-xs">
                                    {(msg.users?.name || msg.sent_by || 'U')[0]}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Original Message */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">AI Response</h3>
                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedPrompt.message?.content}</p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversationViewer;
