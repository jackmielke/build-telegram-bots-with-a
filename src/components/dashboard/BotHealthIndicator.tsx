import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Activity, AlertCircle, CheckCircle, Clock, MessageSquare, ChevronDown, RefreshCw, Unplug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BotHealthIndicatorProps {
  communityId: string;
}

interface BotHealth {
  isActive: boolean;
  lastActivity: string | null;
  messageCount24h: number;
  errorCount24h: number;
  avgResponseTime: number | null;
  webhookUrl: string | null;
  webhookError: string | null;
  webhookErrorDate: number | null;
  pendingUpdates: number;
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
    webhookUrl: null,
    webhookError: null,
    webhookErrorDate: null,
    pendingUpdates: 0,
    errors: []
  });
  const [loading, setLoading] = useState(true);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const { toast } = useToast();

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
        .select('is_active, last_activity_at, bot_token')
        .eq('community_id', communityId)
        .maybeSingle();

      // Get webhook info from Telegram
      let webhookInfo = null;
      if (botData?.bot_token) {
        try {
          const response = await fetch(`https://api.telegram.org/bot${botData.bot_token}/getWebhookInfo`);
          const data = await response.json();
          if (data.ok) {
            webhookInfo = data.result;
          }
        } catch (err) {
          console.error('Failed to fetch webhook info:', err);
        }
      }

      setHealth({
        isActive: (botData?.is_active ?? true) && (messages?.length || 0) > 0,
        lastActivity: messages?.[0]?.created_at || botData?.last_activity_at || null,
        messageCount24h: messages?.length || 0,
        errorCount24h: errorCount,
        avgResponseTime: null,
        webhookUrl: webhookInfo?.url || null,
        webhookError: webhookInfo?.last_error_message || null,
        webhookErrorDate: webhookInfo?.last_error_date || null,
        pendingUpdates: webhookInfo?.pending_update_count || 0,
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

    const hasErrors = health.errorCount24h > 0;
    const isIdle = health.messageCount24h === 0;
    const inactive = !health.isActive && !hasErrors && !isIdle;

    const render = (
      variant: 'default' | 'secondary' | 'destructive' | 'outline',
      icon: JSX.Element,
      label: string,
      tooltip?: string,
      clickable?: boolean
    ) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={`gap-1 ${clickable ? 'cursor-pointer' : ''}`}
            onClick={clickable ? () => setErrorsOpen(true) : undefined}
            aria-label={label}
            title={tooltip}
          >
            {icon}
            {label}
          </Badge>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    );

    if (hasErrors) {
      return render(
        'destructive',
        <AlertCircle className="w-3 h-3" />,
        'Issues Detected',
        `${health.errorCount24h} error${health.errorCount24h !== 1 ? 's' : ''} in the last 24 hours. Click to view details.`,
        true
      );
    }

    if (isIdle) {
      return render(
        'secondary',
        <Clock className="w-3 h-3" />,
        'Idle',
        'No messages from the bot in the last 24 hours.'
      );
    }

    if (inactive) {
      return render(
        'outline',
        <AlertCircle className="w-3 h-3" />,
        'Inactive',
        'Bot appears inactive. Check Telegram setup and workflows.'
      );
    }

    return render(
      'default',
      <CheckCircle className="w-3 h-3" />,
      'Healthy',
      'Bot is responding normally.'
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

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-manage', {
        body: { action: 'test_connection', communityId }
      });
      if (error) throw error;
      if (data?.ok) {
        const username = data?.me?.result?.username || data?.me?.result?.first_name || 'bot';
        toast({ title: 'Connection Successful', description: `Bot @${username} is responding.` });
      } else {
        throw new Error(data?.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Could not reach Telegram API",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const handleReconnectWebhook = async () => {
    setReconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-manage', {
        body: { action: 'reconnect_webhook', communityId }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to reconnect');
      toast({ title: 'Webhook Reconnected', description: 'The Telegram webhook has been reset successfully.' });
      fetchBotHealth();
    } catch (error) {
      console.error('Reconnect webhook error:', error);
      toast({
        title: "Reconnection Failed",
        description: error instanceof Error ? error.message : "Failed to reconnect webhook",
        variant: "destructive"
      });
    } finally {
      setReconnecting(false);
    }
  };

  const handleDisconnectBot = async () => {
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-manage', {
        body: { action: 'delete_webhook', communityId }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to disconnect');

      toast({
        title: "Bot Disconnected",
        description: "The Telegram bot has been disconnected. You can reconnect it from the community settings."
      });
      fetchBotHealth();
      setConfirmOpen(false);
    } catch (error) {
      console.error('Error disconnecting bot:', error);
      toast({
        title: "Disconnection Failed",
        description: error instanceof Error ? error.message : "Failed to disconnect bot",
        variant: "destructive"
      });
    } finally {
      setDisconnecting(false);
    }
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

        {/* Webhook Status */}
        {health.webhookError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-xs font-medium text-destructive">Webhook Error</p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {health.webhookError}
                </p>
                {health.webhookErrorDate && (
                  <p className="text-[10px] text-muted-foreground">
                    Last error: {new Date(health.webhookErrorDate * 1000).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={disconnecting}
              className="w-full"
            >
              <Unplug className="w-3 h-3 mr-2" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect Bot'}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Disconnecting will remove the webhook. You can reconnect from community settings to reset the connection.
            </p>
          </div>
        )}

        {health.pendingUpdates > 0 && (
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {health.pendingUpdates} pending update{health.pendingUpdates !== 1 ? 's' : ''} from Telegram
            </p>
          </div>
        )}
        {health.errorCount24h > 0 && (
          <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
            <CollapsibleTrigger className="w-full" aria-controls="bot-health-errors" aria-expanded={errorsOpen}>
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
            <CollapsibleContent id="bot-health-errors" className="mt-2 space-y-2">
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
        {/* Troubleshoot section */}
        <div className="pt-2 border-t border-border/40 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Troubleshoot</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex-1"
            >
              <RefreshCw className={`w-3 h-3 mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnectWebhook}
              disabled={reconnecting}
              className="flex-1"
            >
              <RefreshCw className={`w-3 h-3 mr-2 ${reconnecting ? 'animate-spin' : ''}`} />
              {reconnecting ? 'Reconnecting...' : 'Reconnect Webhook'}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={disconnecting}
            className="w-full bg-transparent border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
          >
            <Unplug className="w-3 h-3 mr-2" />
            {disconnecting ? 'Disconnecting...' : 'Disconnect Bot'}
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect bot?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the Telegram webhook and mark the bot as inactive. You can reconnect it later from Community Settings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnectBot} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Yes, disconnect'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default BotHealthIndicator;
