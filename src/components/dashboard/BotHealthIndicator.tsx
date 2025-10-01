import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Activity, AlertCircle, CheckCircle, Clock, MessageSquare, ChevronDown } from 'lucide-react';

interface BotHealthIndicatorProps {
  communityId: string;
}

interface BotHealth {
  isActive: boolean;
  lastActivity: string | null;
  messageCount24h: number;
  errorCount24h: number;
  avgResponseTime: number | null;
  errors: Array<{
    timestamp: string;
    error: string;
  }>;
}

const BotHealthIndicator = ({ communityId }: BotHealthIndicatorProps) => {
  const [health, setHealth] = useState<BotHealth>({
    isActive: false,
    lastActivity: null,
    messageCount24h: 0,
    errorCount24h: 0,
    avgResponseTime: null,
    errors: []
  });
  const [loading, setLoading] = useState(true);
  const [errorsOpen, setErrorsOpen] = useState(false);

  useEffect(() => {
    fetchBotHealth();
    
    // Set up real-time subscription for bot activity
    const channel = supabase
      .channel('bot-health')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `community_id=eq.${communityId}`
        },
        () => {
          fetchBotHealth();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchBotHealth, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [communityId]);

  const fetchBotHealth = async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get message count and last activity
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('created_at, sent_by')
        .eq('community_id', communityId)
        .eq('sent_by', 'ai')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Get error count and details from chat sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('ai_chat_sessions')
        .select('metadata, created_at')
        .eq('community_id', communityId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const errors: Array<{ timestamp: string; error: string }> = [];
      sessions?.forEach(s => {
        const metadata = s.metadata as any;
        if (metadata?.error) {
          errors.push({
            timestamp: s.created_at,
            error: metadata.error
          });
        }
      });

      const errorCount = errors.length;

      // Get Telegram bot status if exists
      const { data: botData } = await supabase
        .from('telegram_bots')
        .select('is_active, last_activity_at')
        .eq('community_id', communityId)
        .single();

      setHealth({
        isActive: messages && messages.length > 0 && (botData?.is_active ?? true),
        lastActivity: messages?.[0]?.created_at || botData?.last_activity_at || null,
        messageCount24h: messages?.length || 0,
        errorCount24h: errorCount,
        avgResponseTime: null, // Could calculate from session metadata if tracked
        errors: errors
      });
    } catch (error) {
      console.error('Error fetching bot health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (loading) {
      return <Badge variant="outline">Checking...</Badge>;
    }
    
    if (!health.isActive || health.errorCount24h > 10) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Issues Detected
        </Badge>
      );
    }
    
    if (health.messageCount24h === 0) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Idle
        </Badge>
      );
    }
    
    return (
      <Badge variant="default" className="gap-1 bg-green-500">
        <CheckCircle className="w-3 h-3" />
        Healthy
      </Badge>
    );
  };

  const formatLastActivity = () => {
    if (!health.lastActivity) return 'No recent activity';
    
    const date = new Date(health.lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Bot Health Status
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time monitoring of bot activity
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Last Active</p>
            <p className="text-sm font-medium">{formatLastActivity()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Messages (24h)</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {health.messageCount24h}
            </p>
          </div>
        </div>
        {health.errorCount24h > 0 && (
          <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {health.errorCount24h} error{health.errorCount24h !== 1 ? 's' : ''} in the last 24 hours
                  </p>
                  <ChevronDown className={`w-3 h-3 text-destructive transition-transform ${errorsOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {health.errors.map((error, index) => (
                <div key={index} className="p-2 bg-muted rounded-lg text-xs">
                  <p className="text-muted-foreground mb-1">
                    {new Date(error.timestamp).toLocaleString()}
                  </p>
                  <p className="text-destructive font-mono text-[10px] break-all">
                    {error.error}
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

export default BotHealthIndicator;
