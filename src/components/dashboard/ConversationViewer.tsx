import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Bot, User, Calendar, DollarSign, BarChart3, Download } from 'lucide-react';
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
  const { toast } = useToast();

  useEffect(() => {
    fetchConversation();
    fetchConversationStats();
  }, [conversationId]);

  const fetchConversation = async () => {
    try {
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
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
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
          <ScrollArea className="h-[600px] pr-4">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ConversationViewer;
