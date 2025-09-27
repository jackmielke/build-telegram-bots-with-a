import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  Plus, 
  Send, 
  Bot, 
  Users, 
  Search,
  Settings,
  MessageSquare,
  Globe,
  Workflow
} from 'lucide-react';

interface Community {
  id: string;
  name: string;
  telegram_bot_token: string | null;
  telegram_bot_url: string | null;
}

interface TelegramBot {
  id: string;
  bot_name: string | null;
  bot_username: string;
  bot_token: string;
  is_active: boolean;
  webhook_url: string | null;
  last_activity_at: string | null;
  created_at: string;
}

interface WorkflowBuilderProps {
  community: Community;
  isAdmin: boolean;
}

const WorkflowBuilder = ({ community, isAdmin }: WorkflowBuilderProps) => {
  const [telegramBots, setTelegramBots] = useState<TelegramBot[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [botFormData, setBotFormData] = useState({
    bot_name: '',
    bot_username: '',
    bot_token: ''
  });
  const { toast } = useToast();

  // Define available workflow types
  const workflowTypes = [
    {
      type: 'telegram_integration',
      name: 'Telegram Integration',
      description: 'Enable AI responses in Telegram chats',
      icon: 'telegram'
    },
    {
      type: 'email_notifications',
      name: 'Email Notifications',
      description: 'Send AI-powered email updates',
      icon: 'scheduler'
    },
    {
      type: 'slack_integration',
      name: 'Slack Integration', 
      description: 'Connect AI agent to Slack channels',
      icon: 'memory'
    },
    {
      type: 'discord_integration',
      name: 'Discord Integration',
      description: 'Enable AI interactions in Discord',
      icon: 'search'
    },
    {
      type: 'webhook_integration',
      name: 'Webhook Integration',
      description: 'Connect with external APIs and services',
      icon: 'default'
    }
  ];

  useEffect(() => {
    fetchTelegramBots();
    fetchWorkflows();
  }, [community.id]);

  const fetchTelegramBots = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_bots')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTelegramBots(data || []);
    } catch (error: any) {
      console.error('Error fetching telegram bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('community_workflows')
        .select('*')
        .eq('community_id', community.id);

      if (error) throw error;

      // Merge with workflow types to get display info
      const workflowsWithInfo = workflowTypes.map(type => {
        const dbWorkflow = data?.find(w => w.workflow_type === type.type);
        return {
          ...type,
          id: dbWorkflow?.id || `${type.type}-${community.id}`,
          enabled: dbWorkflow?.is_enabled || false,
          configuration: dbWorkflow?.configuration || {}
        };
      });

      setWorkflows(workflowsWithInfo);
    } catch (error: any) {
      console.error('Error fetching workflows:', error);
    }
  };

  const toggleWorkflow = async (workflowType: string, currentEnabled: boolean) => {
    if (!isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('community_workflows')
        .upsert({
          community_id: community.id,
          workflow_type: workflowType,
          is_enabled: !currentEnabled
        }, {
          onConflict: 'community_id,workflow_type'
        });

      if (error) throw error;
      
      toast({
        title: currentEnabled ? "Workflow Disabled" : "Workflow Enabled",
        description: `${workflowTypes.find(w => w.type === workflowType)?.name} has been ${currentEnabled ? 'disabled' : 'enabled'}.`,
      });
      
      fetchWorkflows();
    } catch (error: any) {
      console.error('Error toggling workflow:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow status",
        variant: "destructive"
      });
    }
  };

  const handleCreateTelegramBot = async () => {
    if (!isAdmin) return;
    
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!userData) throw new Error('User not found');

      const { error } = await supabase
        .from('telegram_bots')
        .insert({
          community_id: community.id,
          user_id: userData.id,
          bot_name: botFormData.bot_name,
          bot_username: botFormData.bot_username,
          bot_token: botFormData.bot_token,
          is_active: true
        });

      if (error) throw error;
      
      toast({
        title: "Telegram Bot Created",
        description: "Your Telegram bot has been set up successfully.",
      });
      
      setBotFormData({ bot_name: '', bot_username: '', bot_token: '' });
      setShowCreateBot(false);
      fetchTelegramBots();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create Telegram bot",
        variant: "destructive"
      });
    }
  };

  const toggleBotStatus = async (botId: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('telegram_bots')
        .update({ is_active: !currentStatus })
        .eq('id', botId);

      if (error) throw error;
      
      toast({
        title: currentStatus ? "Bot Disabled" : "Bot Enabled",
        description: `Telegram bot has been ${currentStatus ? 'disabled' : 'enabled'}.`,
      });
      
      fetchTelegramBots();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update bot status",
        variant: "destructive"
      });
    }
  };

  const getWorkflowIcon = (type: string) => {
    switch (type) {
      case 'telegram':
        return <Send className="w-5 h-5" />;
      case 'scheduler':
        return <Bot className="w-5 h-5" />;
      case 'memory':
        return <MessageSquare className="w-5 h-5" />;
      case 'search':
        return <Search className="w-5 h-5" />;
      default:
        return <Workflow className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Overview */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-primary" />
            <span>Workflow Builder</span>
          </CardTitle>
          <CardDescription>
            Configure automated workflows and integrations for your AI agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="border-border/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {getWorkflowIcon(workflow.icon)}
                      </div>
                      <div>
                        <h4 className="font-medium">{workflow.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {workflow.description}
                        </p>
                      </div>
                    </div>
                    <Switch 
                      checked={workflow.enabled}
                      onCheckedChange={() => toggleWorkflow(workflow.type, workflow.enabled)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                    {workflow.enabled ? 'Active' : 'Inactive'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Telegram Integration */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Send className="w-5 h-5 text-primary" />
              <span>Telegram Bots</span>
            </div>
            {isAdmin && (
              <Dialog open={showCreateBot} onOpenChange={setShowCreateBot}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Telegram Bot</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bot_name">Bot Name</Label>
                      <Input
                        id="bot_name"
                        value={botFormData.bot_name}
                        onChange={(e) => setBotFormData({ ...botFormData, bot_name: e.target.value })}
                        placeholder="My Community Bot"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bot_username">Bot Username</Label>
                      <Input
                        id="bot_username"
                        value={botFormData.bot_username}
                        onChange={(e) => setBotFormData({ ...botFormData, bot_username: e.target.value })}
                        placeholder="@mycommunitybot"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bot_token">Bot Token</Label>
                      <Input
                        id="bot_token"
                        type="password"
                        value={botFormData.bot_token}
                        onChange={(e) => setBotFormData({ ...botFormData, bot_token: e.target.value })}
                        placeholder="Bot token from @BotFather"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowCreateBot(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTelegramBot}>
                        Create Bot
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
          <CardDescription>
            Manage Telegram bot integrations for your community
          </CardDescription>
        </CardHeader>
        <CardContent>
          {telegramBots.length === 0 ? (
            <div className="text-center py-8">
              <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Telegram bots</h3>
              <p className="text-muted-foreground mb-4">
                Create a Telegram bot to enable AI interactions on Telegram
              </p>
              {isAdmin && (
                <Button onClick={() => setShowCreateBot(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Bot
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {telegramBots.map((bot) => (
                <Card key={bot.id} className="border-border/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {bot.bot_name || bot.bot_username}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            @{bot.bot_username}
                          </p>
                          {bot.last_activity_at && (
                            <p className="text-xs text-muted-foreground">
                              Last active: {new Date(bot.last_activity_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={bot.is_active ? 'default' : 'outline'}>
                          {bot.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {isAdmin && (
                          <Switch 
                            checked={bot.is_active}
                            onCheckedChange={() => toggleBotStatus(bot.id, bot.is_active)}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coming Soon Features */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-primary" />
            <span>Coming Soon</span>
          </CardTitle>
          <CardDescription>
            Advanced workflow features in development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-border/30 bg-background/50">
              <h4 className="font-medium mb-2">Visual Workflow Editor</h4>
              <p className="text-sm text-muted-foreground">
                Drag-and-drop workflow builder with conditional logic
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-background/50">
              <h4 className="font-medium mb-2">Scheduled Messages</h4>
              <p className="text-sm text-muted-foreground">
                Send proactive AI messages based on triggers
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-background/50">
              <h4 className="font-medium mb-2">Webhook Integrations</h4>
              <p className="text-sm text-muted-foreground">
                Connect with external services and APIs
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-background/50">
              <h4 className="font-medium mb-2">Advanced Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Detailed workflow performance metrics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowBuilder;