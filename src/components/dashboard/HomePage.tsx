import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, DollarSign, Bot, Zap, TrendingUp, Activity, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Community {
  id: string;
  name: string;
  member_count?: number;
  total_tokens_used: number | null;
  total_cost_usd: number | null;
  telegram_bot_token: string | null;
  telegram_bot_url: string | null;
}

interface HomePageProps {
  community: Community;
  onNavigate: (tab: string, conversationId?: string) => void;
}

interface RecentConversation {
  conversation_id: string;
  chat_type: string;
  message_count: number;
  last_message_at: string;
  display_name: string;
}

const HomePage = ({ community, onNavigate }: HomePageProps) => {
  const hasTelegram = !!community.telegram_bot_token;
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  useEffect(() => {
    fetchRecentConversations();
  }, [community.id]);

  const fetchRecentConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('community_id', community.id)
        .order('last_message_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (conv) => {
          const { data: firstMessage } = await supabase
            .from('messages')
            .select('metadata, sent_by')
            .eq('conversation_id', conv.conversation_id)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          let displayName = conv.topic_name || 'Untitled';
          if (firstMessage?.metadata) {
            const meta = firstMessage.metadata as any;
            if (conv.chat_type === 'telegram_bot') {
              if (meta.chat_type_detail === 'private') {
                displayName = `DM: ${meta.telegram_first_name || meta.telegram_username || 'User'}`;
              } else if (meta.telegram_chat_title) {
                displayName = meta.telegram_chat_title;
              }
            }
          }

          return {
            conversation_id: conv.conversation_id,
            chat_type: conv.chat_type,
            message_count: conv.message_count,
            last_message_at: conv.last_message_at,
            display_name: displayName
          };
        })
      );

      setRecentConversations(enriched);
    } catch (error) {
      console.error('Error fetching recent conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Recent Conversations */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Recent Conversations
              </CardTitle>
              <CardDescription className="mt-1">
                Latest activity in your community
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate('conversations')}
            >
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingConversations ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
              <p className="text-sm">Loading conversations...</p>
            </div>
          ) : recentConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentConversations.map((conv) => (
                <Button
                  key={conv.conversation_id}
                  variant="ghost"
                  className="w-full h-auto p-3 justify-start hover:bg-primary/10 border border-border/30"
                  onClick={() => onNavigate('conversations', conv.conversation_id)}
                >
                  <div className="flex items-center gap-3 w-full text-left">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      {conv.chat_type === 'telegram_bot' ? <Bot className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{conv.display_name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {conv.message_count} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatTimeAgo(conv.last_message_at)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Connection CTA - Show if not connected */}
      {!hasTelegram && (
        <Card className="gradient-card border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Connect Your Telegram Bot</CardTitle>
                <CardDescription className="text-base mt-1">
                  Get started in 2 minutes — enable AI responses in your Telegram community
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => onNavigate('workflows')} 
              className="gradient-primary hover:shadow-glow"
              size="lg"
            >
              <Zap className="w-4 h-4 mr-2" />
              Connect Telegram Bot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{community.member_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Community members
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {community.total_tokens_used ? Math.floor(community.total_tokens_used / 100) : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI conversations
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cost</CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(community.total_cost_usd || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total AI spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Status */}
      {hasTelegram && (
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Bot Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Telegram Bot</span>
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                Connected
              </Badge>
            </div>
            {community.telegram_bot_url && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bot Link</span>
                <a 
                  href={community.telegram_bot_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open in Telegram
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Jump to the most used sections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('conversations')}
            >
              <MessageSquare className="w-5 h-5 text-primary" />
              <span className="text-xs">Conversations</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('agent')}
            >
              <Bot className="w-5 h-5 text-primary" />
              <span className="text-xs">Agent Setup</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('memory')}
            >
              <Users className="w-5 h-5 text-primary" />
              <span className="text-xs">Memory</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('settings')}
            >
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-xs">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;
