import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, DollarSign, Bot, Zap, TrendingUp, Activity, Calendar, ArrowRight, Sparkles, Plus, ExternalLink, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TelegramBotDialog } from '@/components/TelegramBotDialog';
import BotOnboarding from '@/components/dashboard/BotOnboarding';
import { CreateBotWorkflow } from '@/components/dashboard/CreateBotWorkflow';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [showBotDialog, setShowBotDialog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [showCreateBotWorkflow, setShowCreateBotWorkflow] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [agentInstructions, setAgentInstructions] = useState<string>('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showMemories, setShowMemories] = useState(false);

  useEffect(() => {
    fetchRecentConversations();
    fetchMemories();
    fetchAgentInstructions();
    
    // Check if onboarding was completed
    const completed = localStorage.getItem(`onboarding_completed_${community.id}`);
    setOnboardingCompleted(!!completed);
    
    // Auto-open bot dialog if no telegram bot is connected
    if (!hasTelegram) {
      setShowBotDialog(true);
    }
  }, [community.id, hasTelegram]);

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

  const fetchMemories = async () => {
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setMemories(data || []);
    } catch (error) {
      console.error('Error fetching memories:', error);
    }
  };

  const fetchAgentInstructions = async () => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('agent_instructions')
        .eq('id', community.id)
        .single();

      if (error) throw error;
      setAgentInstructions(data?.agent_instructions || 'No instructions set yet.');
    } catch (error) {
      console.error('Error fetching agent instructions:', error);
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
      {/* New Bot Workflow */}
      <CreateBotWorkflow 
        open={showCreateBotWorkflow}
        onOpenChange={setShowCreateBotWorkflow}
      />

      {/* Telegram Bot Dialog - Auto-opens if no bot connected */}
      <TelegramBotDialog
        communityId={community.id}
        open={showBotDialog}
        onOpenChange={setShowBotDialog}
        onSuccess={() => {
          setShowBotDialog(false);
          setShowOnboarding(true); // Show onboarding after bot connection
        }}
      />

      {/* Bot Onboarding - Shows after bot is connected */}
      <BotOnboarding
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        communityId={community.id}
        communityName={community.name}
        onComplete={() => {
          localStorage.setItem(`onboarding_completed_${community.id}`, 'true');
          setOnboardingCompleted(true);
          setShowOnboarding(false);
          window.location.reload(); // Refresh to show updated state
        }}
      />

      {/* Hero CTA - New Bot - Show only if no bot connected */}
      {!hasTelegram && (
        <Card className="gradient-card border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Create a New Bot</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set up a Telegram bot in minutes with AI-powered responses
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowCreateBotWorkflow(true)}
                size="lg"
                className="gradient-primary hover:shadow-glow"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Bot
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="text-center py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 text-primary opacity-80" />
              <h4 className="font-semibold text-lg mb-2">Start Your First Conversation</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Connect with your bot on Telegram to begin chatting
              </p>
              {community.telegram_bot_url && (
                <Button 
                  asChild
                  className="gradient-primary hover:shadow-glow"
                >
                  <a 
                    href={community.telegram_bot_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chat with Bot
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              )}
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
              onClick={() => setShowBotDialog(true)} 
              className="gradient-primary hover:shadow-glow"
              size="lg"
            >
              <Zap className="w-4 h-4 mr-2" />
              Connect Telegram Bot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Onboarding CTA - Hidden for now */}
      {false && hasTelegram && !onboardingCompleted && (
        <Card className="gradient-card border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Complete Your Bot Setup</CardTitle>
                <CardDescription className="text-base mt-1">
                  Configure your AI agent's behavior, knowledge, and permissions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setShowOnboarding(true)} 
              className="gradient-primary hover:shadow-glow"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Setup
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

      {/* Agent Instructions & Memories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Instructions */}
        <Card className="gradient-card border-border/50">
          <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <CardTitle>System Instructions</CardTitle>
                  </div>
                  {showInstructions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CollapsibleTrigger>
              <CardDescription>
                Your AI agent's core behavior and personality
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {agentInstructions}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => onNavigate('agent')}
                >
                  Edit Instructions
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Memories */}
        <Card className="gradient-card border-border/50">
          <Collapsible open={showMemories} onOpenChange={setShowMemories}>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <CardTitle>Bot Memory</CardTitle>
                  </div>
                  {showMemories ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </CollapsibleTrigger>
              <CardDescription>
                Knowledge your bot has learned ({memories.length} items)
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {memories.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No memories yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {memories.slice(0, 5).map((memory) => (
                      <div key={memory.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="line-clamp-2">{memory.content}</p>
                        {memory.tags && memory.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {memory.tags.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => onNavigate('memory')}
                >
                  View All Memories
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

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
