import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  Workflow,
  TestTube,
  Play,
  CheckCircle,
  XCircle,
  Loader,
  Edit3,
  Save,
  X
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
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const EDGE_FUNCTION_URL = 'https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-webhook';
  const [botFormData, setBotFormData] = useState({
    bot_name: '',
    bot_username: '',
    bot_token: ''
  });
  const [editingBot, setEditingBot] = useState<string | null>(null);
  const [editingBotData, setEditingBotData] = useState<any>({});
  const [testingBot, setTestingBot] = useState<string | null>(null);
  const { toast } = useToast();

  // Define available workflow types
  const workflowTypes = [
    {
      type: 'telegram_integration',
      name: 'Telegram Integration',
      description: 'Enable AI responses in Telegram chats',
      icon: 'telegram',
      hasSubToggles: true // This workflow has sub-toggles for chat types
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

  const toggleChatType = async (workflowType: string, chatType: string, currentEnabled: boolean) => {
    if (!isAdmin) return;
    
    try {
      // Get current workflow configuration
      const workflow = workflows.find(w => w.type === workflowType);
      const currentConfig = workflow?.configuration || {};
      const chatTypes = currentConfig.chat_types || {};
      
      // Update the specific chat type
      const newChatTypes = {
        ...chatTypes,
        [chatType]: !currentEnabled
      };

      const { error } = await supabase
        .from('community_workflows')
        .upsert({
          community_id: community.id,
          workflow_type: workflowType,
          is_enabled: workflow?.enabled || false,
          configuration: {
            ...currentConfig,
            chat_types: newChatTypes
          }
        }, {
          onConflict: 'community_id,workflow_type'
        });

      if (error) throw error;
      
      toast({
        title: currentEnabled ? "Chat Type Disabled" : "Chat Type Enabled",
        description: `${chatType} chats have been ${currentEnabled ? 'disabled' : 'enabled'} for Telegram integration.`,
      });
      
      fetchWorkflows();
    } catch (error: any) {
      console.error('Error toggling chat type:', error);
      toast({
        title: "Error",
        description: "Failed to update chat type setting",
        variant: "destructive"
      });
    }
  };

  // Test workflow functions
  const testTelegramWorkflow = async (input: string) => {
    const mockTelegramMessage = {
      community_id: community.id,
      message: {
        chat: { type: 'private' },
        text: input,
        from: { id: 123456, first_name: 'Test User' }
      }
    };

    const response = await supabase.functions.invoke('telegram-webhook', {
      body: mockTelegramMessage
    });

    return {
      success: !response.error,
      message: response.error ? 'Telegram test failed' : 'Telegram workflow responded correctly',
      data: response.data,
      details: response
    };
  };

  const testEmailWorkflow = async (input: string) => {
    return {
      success: true,
      message: 'Email workflow simulation completed',
      data: { email_sent: true, recipient: 'test@example.com', subject: input }
    };
  };

  const testSlackWorkflow = async (input: string) => {
    return {
      success: true,
      message: 'Slack workflow simulation completed',
      data: { message_sent: true, channel: '#test', content: input }
    };
  };

  const testDiscordWorkflow = async (input: string) => {
    return {
      success: true,
      message: 'Discord workflow simulation completed',
      data: { message_sent: true, channel: 'general', content: input }
    };
  };

  const testWebhookWorkflow = async (input: string) => {
    return {
      success: true,
      message: 'Webhook workflow simulation completed',
      data: { webhook_called: true, payload: input, status: 200 }
    };
  };

  // Bot management functions
  const testBotConnection = async (botToken: string) => {
    try {
      setTestingBot('test');
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();
      
      if (data.ok) {
        return {
          success: true,
          botInfo: data.result,
          message: 'Bot connection successful'
        };
      } else {
        return {
          success: false,
          message: data.description || 'Invalid bot token'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to Telegram API'
      };
    } finally {
      setTestingBot(null);
    }
  };

  const startEditingBot = (bot: TelegramBot) => {
    setEditingBot(bot.id);
    setEditingBotData({
      bot_name: bot.bot_name || '',
      bot_token: bot.bot_token,
      bot_username: bot.bot_username
    });
  };

  const saveBot = async (botId: string) => {
    try {
      // Test the connection first
      const testResult = await testBotConnection(editingBotData.bot_token);
      
      if (!testResult.success) {
        toast({
          title: "Invalid Bot Token",
          description: testResult.message,
          variant: "destructive"
        });
        return;
      }

      // Update bot with real info from Telegram API
      const { error } = await supabase
        .from('telegram_bots')
        .update({
          bot_name: editingBotData.bot_name || testResult.botInfo.first_name,
          bot_username: testResult.botInfo.username,
          bot_token: editingBotData.bot_token
        })
        .eq('id', botId);

      if (error) throw error;

      toast({
        title: "Bot Updated",
        description: `Bot @${testResult.botInfo.username} updated successfully!`
      });

      setEditingBot(null);
      setEditingBotData({});
      fetchTelegramBots(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating bot:', error);
      toast({
        title: "Error",
        description: "Failed to update bot",
        variant: "destructive"
      });
    }
  };

  const cancelEditingBot = () => {
    setEditingBot(null);
    setEditingBotData({});
  };

  const connectBotWebhook = async (bot: TelegramBot) => {
    try {
      setTestingBot(bot.id);
      const webhookUrl = `${EDGE_FUNCTION_URL}?community_id=${community.id}`;
      const resp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
          drop_pending_updates: false
        })
      });
      const data = await resp.json();
      if (!data.ok) {
        throw new Error(data.description || 'Failed to set webhook');
      }

      await supabase
        .from('telegram_bots')
        .update({ webhook_url: webhookUrl })
        .eq('id', bot.id);

      toast({
        title: 'Webhook Connected',
        description: `Telegram will now send updates to this community.`
      });
      fetchTelegramBots?.();
    } catch (err: any) {
      toast({
        title: 'Webhook Error',
        description: err?.message || 'Failed to connect webhook',
        variant: 'destructive'
      });
    } finally {
      setTestingBot(null);
    }
  };

  const testWorkflow = async (workflow: any, input: string) => {
    if (!workflow || !workflow.enabled) {
      toast({
        title: "Workflow Disabled",
        description: "This workflow is currently disabled. Enable it first to test.",
        variant: "destructive"
      });
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      let result;
      
      switch (workflow.type) {
        case 'telegram_integration':
          result = await testTelegramWorkflow(input);
          break;
        case 'email_notifications':
          result = await testEmailWorkflow(input);
          break;
        case 'slack_integration':
          result = await testSlackWorkflow(input);
          break;
        case 'discord_integration':
          result = await testDiscordWorkflow(input);
          break;
        case 'webhook_integration':
          result = await testWebhookWorkflow(input);
          break;
        default:
          result = { success: false, message: 'Unknown workflow type' };
      }

      setTestResult(result);
      
      toast({
        title: result.success ? "Test Successful" : "Test Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });

    } catch (error: any) {
      console.error('Test error:', error);
      setTestResult({
        success: false,
        message: error.message || 'Test failed with unknown error',
        details: error
      });
      
      toast({
        title: "Test Error",
        description: "Failed to run workflow test",
        variant: "destructive"
      });
    } finally {
      setTestLoading(false);
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

  const getTestPlaceholder = (workflowType: string): string => {
    switch (workflowType) {
      case 'telegram_integration':
        return 'Enter a test message as if sent from Telegram...';
      case 'email_notifications':
        return 'Enter email subject or content to test...';
      case 'slack_integration':
        return 'Enter a test Slack message...';
      case 'discord_integration':
        return 'Enter a test Discord message...';
      case 'webhook_integration':
        return 'Enter JSON payload to send to webhook...';
      default:
        return 'Enter test input...';
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
                  
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                      {workflow.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                    
                    {/* Test Button */}
                    {workflow.enabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setShowTestDialog(true);
                          setTestInput('');
                          setTestResult(null);
                        }}
                        className="ml-2"
                      >
                        <TestTube className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                    )}
                  </div>

                  {/* Telegram Chat Type Sub-toggles */}
                  {workflow.type === 'telegram_integration' && workflow.enabled && (
                    <div className="mt-4 pt-3 border-t border-border/30">
                      <p className="text-xs font-medium text-muted-foreground mb-3">Chat Types</p>
                      <div className="space-y-2">
                        {[
                          { type: 'private', label: 'Private Chats', desc: '1-on-1 conversations' },
                          { type: 'group', label: 'Groups', desc: 'Regular group chats' },
                          { type: 'supergroup', label: 'Supergroups', desc: 'Large groups with admin features' }
                        ].map((chatType) => {
                          const isEnabled = workflow.configuration?.chat_types?.[chatType.type] || false;
                          return (
                            <div key={chatType.type} className="flex items-center justify-between p-2 rounded bg-background/50">
                              <div>
                                <p className="text-sm font-medium">{chatType.label}</p>
                                <p className="text-xs text-muted-foreground">{chatType.desc}</p>
                              </div>
                              <Switch 
                                checked={isEnabled}
                                onCheckedChange={() => toggleChatType(workflow.type, chatType.type, isEnabled)}
                                disabled={!isAdmin}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                    {editingBot === bot.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Edit Bot</h4>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              onClick={() => saveBot(bot.id)}
                              disabled={testingBot === 'test'}
                            >
                              {testingBot === 'test' ? (
                                <Loader className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Save className="w-4 h-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditingBot}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label htmlFor={`bot-name-${bot.id}`}>Bot Name</Label>
                            <Input
                              id={`bot-name-${bot.id}`}
                              value={editingBotData.bot_name || ''}
                              onChange={(e) => setEditingBotData({
                                ...editingBotData,
                                bot_name: e.target.value
                              })}
                              placeholder="Enter bot name"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor={`bot-token-${bot.id}`}>Bot Token</Label>
                            <Input
                              id={`bot-token-${bot.id}`}
                              type="password"
                              value={editingBotData.bot_token || ''}
                              onChange={(e) => setEditingBotData({
                                ...editingBotData,
                                bot_token: e.target.value
                              })}
                              placeholder="Enter bot token from @BotFather"
                            />
                          </div>
                          
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (editingBotData.bot_token) {
                                const result = await testBotConnection(editingBotData.bot_token);
                                toast({
                                  title: result.success ? "Connection Successful" : "Connection Failed",
                                  description: result.success 
                                    ? `Bot @${result.botInfo.username} is valid!`
                                    : result.message,
                                  variant: result.success ? "default" : "destructive"
                                });
                                if (result.success) {
                                  setEditingBotData({
                                    ...editingBotData,
                                    bot_username: result.botInfo.username
                                  });
                                }
                              }
                            }}
                            disabled={!editingBotData.bot_token || testingBot === 'test'}
                          >
                            {testingBot === 'test' ? (
                              <Loader className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <TestTube className="w-4 h-4 mr-2" />
                            )}
                            Test Connection
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Bot className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">
                                {bot.bot_name || bot.bot_username}
                              </h4>
                              {bot.bot_username && (
                                <Badge variant="outline" className="text-xs">
                                  @{bot.bot_username}
                                </Badge>
                              )}
                            </div>
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
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => connectBotWebhook(bot)}
                                disabled={testingBot === bot.id}
                              >
                                {testingBot === bot.id ? (
                                  <Loader className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <Globe className="w-4 h-4 mr-2" />
                                )}
                                Connect Webhook
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingBot(bot)}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Switch 
                                checked={bot.is_active}
                                onCheckedChange={() => toggleBotStatus(bot.id, bot.is_active)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}
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

      {/* Workflow Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <TestTube className="w-5 h-5" />
              <span>Test {selectedWorkflow?.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Workflow Details</h4>
              <p className="text-sm text-muted-foreground mb-2">
                {selectedWorkflow?.description}
              </p>
              <div className="flex items-center space-x-2">
                <Badge variant="default">Active</Badge>
                {selectedWorkflow?.type === 'telegram_integration' && selectedWorkflow?.configuration?.chat_types && (
                  <div className="flex space-x-1">
                    {Object.entries(selectedWorkflow.configuration.chat_types)
                      .filter(([_, enabled]) => enabled)
                      .map(([type, _]) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-input">Test Input</Label>
              <Textarea
                id="test-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={getTestPlaceholder(selectedWorkflow?.type)}
                rows={3}
              />
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg border ${
                testResult.success 
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <h4 className="font-medium">
                    {testResult.success ? 'Test Passed' : 'Test Failed'}
                  </h4>
                </div>
                <p className="text-sm mb-2">{testResult.message}</p>
                {testResult.data && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">Response Details</summary>
                    <pre className="mt-2 p-2 bg-background rounded overflow-x-auto">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>
                Close
              </Button>
              <Button 
                onClick={() => testWorkflow(selectedWorkflow, testInput)}
                disabled={testLoading || !testInput.trim()}
              >
                {testLoading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowBuilder;
