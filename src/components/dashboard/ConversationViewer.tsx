import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Bot, User, Calendar, DollarSign, BarChart3, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AIContextViewer } from './AIContextViewer';

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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
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
          setMessages(prev => [payload.new as Message, ...prev]);
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
        .order('created_at', { ascending: false })
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

  const viewPrompt = (messageId: string) => {
    setSelectedMessageId(messageId);
    setPromptDialogOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <Card className="gradient-card border-border/50">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Back</span>
              </Button>
              <div className="min-w-0">
                <CardTitle className="text-base md:text-lg truncate">
                  Conversation Details
                </CardTitle>
                <CardDescription className="mt-1 text-xs md:text-sm">
                  {messages.length} messages
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={exportConversation} className="flex-shrink-0">
              <Download className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Export</span>
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
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Conversation Thread</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Full message history from this conversation
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading && page === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Loading messages...</div>
          ) : (
            <ScrollArea className="h-[600px] md:h-[700px] px-2 md:px-4">
              <div className="space-y-3 md:space-y-4">
                {messages.map((message) => {
                const isAI = message.sent_by === 'ai' || message.chat_type === 'ai';
                const userName = message.users?.name || 'User';
                const avatarUrl = message.users?.avatar_url;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 md:gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    <Avatar className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0">
                      {isAI ? (
                        <>
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                          </AvatarFallback>
                        </>
                      ) : (
                        <>
                          <AvatarImage src={avatarUrl} alt={userName} />
                          <AvatarFallback className="bg-muted">
                            <User className="w-3 h-3 md:w-4 md:h-4" />
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0 max-w-full">
                      <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                        <span className="text-xs md:text-sm font-medium">
                          {isAI ? 'AI Assistant' : userName}
                        </span>
                        <span className="text-[10px] md:text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-[10px] md:text-xs h-4 md:h-5">
                          {message.message_type}
                        </Badge>
                        {isAI && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewPrompt(message.id)}
                            className="h-5 md:h-6 px-1 md:px-2"
                          >
                            <Eye className="w-3 h-3" />
                            <span className="text-[10px] md:text-xs ml-1">Prompt</span>
                          </Button>
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-2.5 md:p-3 ${
                          isAI
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-muted border border-border'
                        }`}
                      >
                        <p className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
              {hasMore && messages.length >= MESSAGES_PER_PAGE && (
                <div className="pt-4 text-center">
                  <Button 
                    onClick={loadMore} 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                    className="w-full md:w-auto"
                  >
                    {loading ? 'Loading...' : 'Load Earlier Messages'}
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* AI Context Viewer Dialog */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI Context Mirror</DialogTitle>
            <DialogDescription>
              Exact reconstruction of what the AI saw when generating this response
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {selectedMessageId && (
              <AIContextViewer 
                messageId={selectedMessageId}
                conversationId={conversationId}
                communityId={communityId}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversationViewer;
