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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import BotHealthIndicator from './BotHealthIndicator';
import { TelegramBotDialog } from '../TelegramBotDialog';
import {
  Zap, 
  Send, 
  Bot, 
  Search,
  MessageSquare,
  Workflow,
  TestTube,
  CheckCircle,
  XCircle,
  Loader,
  Save,
  Globe,
  Play,
  AlertCircle,
  ChevronDown,
  Info,
  Mail,
  Hash,
  Activity
} from 'lucide-react';

interface Community {
  id: string;
  name: string;
  telegram_bot_token: string | null;
  telegram_bot_url: string | null;
}

interface WorkflowBuilderProps {
  community: Community;
  isAdmin: boolean;
  onUpdate?: (updatedCommunity: Partial<Community>) => void;
}

const WorkflowBuilder = ({ community, isAdmin, onUpdate }: WorkflowBuilderProps) => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [botToken, setBotToken] = useState(community.telegram_bot_token || '');
  const [botInfo, setBotInfo] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [checkingWebhook, setCheckingWebhook] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const EDGE_FUNCTION_URL = 'https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-webhook';
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
    fetchWorkflows();
    if (community.telegram_bot_token) {
      testBotConnection(community.telegram_bot_token).then(result => {
        if (result.success) {
          setBotInfo(result.botInfo);
          checkWebhookStatus(community.telegram_bot_token);
        }
      });
    }
  }, [community.id, community.telegram_bot_token]);

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
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (workflowType: string, currentEnabled: boolean) => {
    if (!isAdmin) return;
    
    try {
      // Optimistically update UI
      setWorkflows(prev => prev.map(w => 
        w.type === workflowType ? { ...w, enabled: !currentEnabled } : w
      ));

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
      
      // Refresh to ensure consistency
      await fetchWorkflows();
    } catch (error: any) {
      console.error('Error toggling workflow:', error);
      // Revert optimistic update on error
      await fetchWorkflows();
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

  const toggleAgentTool = async (workflowType: string, toolName: string, currentEnabled: boolean) => {
    if (!isAdmin) return;
    
    try {
      // Get current workflow configuration
      const workflow = workflows.find(w => w.type === workflowType);
      const currentConfig = workflow?.configuration || {};
      const agentTools = currentConfig.agent_tools || {};
      
      // Update the specific tool
      const newAgentTools = {
        ...agentTools,
        [toolName]: !currentEnabled
      };

      const { error } = await supabase
        .from('community_workflows')
        .upsert({
          community_id: community.id,
          workflow_type: workflowType,
          is_enabled: workflow?.enabled || false,
          configuration: {
            ...currentConfig,
            agent_tools: newAgentTools
          }
        }, {
          onConflict: 'community_id,workflow_type'
        });

      if (error) throw error;
      
      toast({
        title: currentEnabled ? "Tool Disabled" : "Tool Enabled",
        description: `${toolName.replace('_', ' ')} has been ${currentEnabled ? 'disabled' : 'enabled'}.`,
      });
      
      fetchWorkflows();
    } catch (error: any) {
      console.error('Error toggling agent tool:', error);
      toast({
        title: "Error",
        description: "Failed to update agent tool setting",
        variant: "destructive"
      });
    }
  };

  // New function: Toggle all agent tools at once (master toggle)
  const toggleAgentMode = async (workflowType: string, enable: boolean) => {
    if (!isAdmin) return;
    
    try {
      const workflow = workflows.find(w => w.type === workflowType);
      const currentConfig = workflow?.configuration || {};
      
      // Set all agent tools to the same value
      const newAgentTools = {
        web_search: enable,
        search_memory: enable,
        search_chat_history: enable,
        save_memory: enable
      };

      const { error } = await supabase
        .from('community_workflows')
        .upsert({
          community_id: community.id,
          workflow_type: workflowType,
          is_enabled: workflow?.enabled || false,
          configuration: {
            ...currentConfig,
            agent_tools: newAgentTools
          }
        }, {
          onConflict: 'community_id,workflow_type'
        });

      if (error) throw error;
      
      toast({
        title: enable ? "Agent Mode Enabled" : "Agent Mode Disabled",
        description: enable 
          ? "Advanced AI agent with all tools enabled. The bot will use iterative reasoning and tool calls."
          : "Simple mode enabled. The bot will respond with basic context only.",
      });
      
      fetchWorkflows();
    } catch (error: any) {
      console.error('Error toggling agent mode:', error);
      toast({
        title: "Error",
        description: "Failed to update agent mode",
        variant: "destructive"
      });
    }
  };

  // Helper function to check if agent mode is active (any tool enabled)
  const isAgentModeActive = (workflow: any): boolean => {
    const tools = workflow.configuration?.agent_tools || {};
    return tools.web_search || tools.search_memory || tools.search_chat_history || tools.save_memory;
  };

  const toggleAutoIntroGeneration = async (workflowType: string, currentEnabled: boolean) => {
    if (!isAdmin) return;
    
    try {
      const workflow = workflows.find(w => w.type === workflowType);
      const currentConfig = workflow?.configuration || {};
      const autoIntroConfig = currentConfig.auto_intro_generation || {};
      
      const newAutoIntroConfig = {
        ...autoIntroConfig,
        enabled: !currentEnabled
      };

      const { error } = await supabase
        .from('community_workflows')
        .upsert({
          community_id: community.id,
          workflow_type: workflowType,
          is_enabled: workflow?.enabled || false,
          configuration: {
            ...currentConfig,
            auto_intro_generation: newAutoIntroConfig
          }
        }, {
          onConflict: 'community_id,workflow_type'
        });

      if (error) throw error;
      
      toast({
        title: currentEnabled ? "Auto-Intro Disabled" : "Auto-Intro Enabled",
        description: `Auto-intro generation has been ${currentEnabled ? 'disabled' : 'enabled'}.`,
      });
      
      fetchWorkflows();
    } catch (error: any) {
      console.error('Error toggling auto-intro:', error);
      toast({
        title: "Error",
        description: "Failed to update auto-intro setting",
        variant: "destructive"
      });
    }
  };

  const updateIntroThreadNames = async (workflowType: string, threadNames: string[]) => {
    if (!isAdmin) return;
    
    try {
      const workflow = workflows.find(w => w.type === workflowType);
      const currentConfig = workflow?.configuration || {};
      const autoIntroConfig = currentConfig.auto_intro_generation || {};
      
      const newAutoIntroConfig = {
        ...autoIntroConfig,
        thread_names: threadNames
      };

      const { error } = await supabase
        .from('community_workflows')
        .upsert({
          community_id: community.id,
          workflow_type: workflowType,
          is_enabled: workflow?.enabled || false,
          configuration: {
            ...currentConfig,
            auto_intro_generation: newAutoIntroConfig
          }
        }, {
          onConflict: 'community_id,workflow_type'
        });

      if (error) throw error;
      
      toast({
        title: "Thread Names Updated",
        description: "Auto-intro thread configuration saved.",
      });
      
      fetchWorkflows();
    } catch (error: any) {
      console.error('Error updating thread names:', error);
      toast({
        title: "Error",
        description: "Failed to update thread names",
        variant: "destructive"
      });
    }
  };

  // Test workflow functions
  const testTelegramWorkflow = async (input: string) => {
    const mockTelegramMessage = {
      community_id: community.id,
      message: {
        chat: { 
          type: 'private',
          id: 123456  // Required for webhook processing
        },
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
  const testBotConnection = async (token: string) => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
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
    }
  };

  const handleTestConnection = async () => {
    if (!botToken.trim()) return;
    
    setTestingConnection(true);
    const result = await testBotConnection(botToken);
    
    if (result.success) {
      setBotInfo(result.botInfo);
      toast({
        title: "✓ Connection Successful",
        description: `Bot @${result.botInfo.username} is ready to connect!`,
      });
    } else {
      toast({
        title: "Connection Failed",
        description: result.message,
        variant: "destructive"
      });
    }
    setTestingConnection(false);
  };

  const saveBotToken = async () => {
    if (!botToken.trim()) return;
    
    try {
      setSavingBot(true);
      
      // Test connection first if we haven't already
      let testResult = botInfo ? { success: true, botInfo } : await testBotConnection(botToken);
      
      if (!testResult.success) {
        toast({
          title: "Invalid Bot Token",
          description: 'botInfo' in testResult ? 'Connection failed' : testResult.message || 'Connection failed',
          variant: "destructive"
        });
        setSavingBot(false);
        return;
      }

      // Save to community
      const { error: updateError } = await supabase
        .from('communities')
        .update({ 
          telegram_bot_token: botToken,
          telegram_bot_url: `https://t.me/${testResult.botInfo.username}`
        })
        .eq('id', community.id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw updateError;
      }

      // Set up webhook
      await setupWebhook(botToken);

      // Update local state
      setBotInfo(testResult.botInfo);
      
      // Update parent component
      if (onUpdate) {
        onUpdate({
          telegram_bot_token: botToken,
          telegram_bot_url: `https://t.me/${testResult.botInfo.username}`
        });
      }
      
      toast({
        title: "🎉 Bot Connected!",
        description: `@${testResult.botInfo.username} is now connected and ready to respond.`
      });
    } catch (error: any) {
      console.error('Error saving bot token:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save bot token",
        variant: "destructive"
      });
    } finally {
      setSavingBot(false);
    }
  };

  const checkWebhookStatus = async (token: string) => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const data = await response.json();
      if (data.ok) {
        setWebhookInfo(data.result);
      }
    } catch (error) {
      console.error('Error checking webhook:', error);
    }
  };

  const handleCheckWebhook = async () => {
    if (!community.telegram_bot_token) return;
    setCheckingWebhook(true);
    await checkWebhookStatus(community.telegram_bot_token);
    setCheckingWebhook(false);
    toast({
      title: "Webhook Status Checked",
      description: webhookInfo?.url ? "Webhook is configured" : "Webhook not configured",
    });
  };

  const setupWebhook = async (token: string) => {
    try {
      const webhookUrl = `${EDGE_FUNCTION_URL}?community_id=${community.id}`;
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
          drop_pending_updates: false
        })
      });
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.description || 'Failed to set webhook');
      }
      await checkWebhookStatus(token);
      toast({
        title: "Webhook Configured",
        description: "Your bot can now receive messages from Telegram",
      });
    } catch (error) {
      console.error('Webhook setup error:', error);
      toast({
        title: "Webhook Error",
        description: "Failed to configure webhook",
        variant: "destructive"
      });
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

  // Get the telegram workflow
  const telegramWorkflow = workflows.find(w => w.type === 'telegram_integration');
  const otherWorkflows = workflows.filter(w => w.type !== 'telegram_integration');

  return (
    <>
      <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-primary" />
          <span>Workflows</span>
        </CardTitle>
        <CardDescription>
          Configure automated workflows and agent integrations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="telegram" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="telegram" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Telegram</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="slack" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span className="hidden sm:inline">Slack</span>
            </TabsTrigger>
            <TabsTrigger value="discord" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Discord</span>
            </TabsTrigger>
            <TabsTrigger value="webhook" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Webhook</span>
            </TabsTrigger>
          </TabsList>

          {/* TELEGRAM TAB */}
          <TabsContent value="telegram" className="space-y-4 mt-6">
            {/* Telegram Bot Configuration - Show if not configured */}
            {!botInfo && (
              <TelegramBotDialog 
                communityId={community.id}
                onSuccess={() => {
                  if (community.telegram_bot_token) {
                    testBotConnection(community.telegram_bot_token).then(result => {
                      if (result.success) {
                        setBotInfo(result.botInfo);
                        checkWebhookStatus(community.telegram_bot_token);
                      }
                    });
                  }
                  fetchWorkflows();
                }}
                trigger={
                  <Button variant="hero" size="lg" className="w-full">
                    <Send className="w-5 h-5 mr-2" />
                    Connect Telegram Bot
                  </Button>
                }
              />
            )}

            {/* Telegram Workflow Configuration */}
            {telegramWorkflow && (
              <Card className="border-border/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">Telegram Integration Settings</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure AI responses in Telegram chats
                      </p>
                    </div>
                    <Switch 
                      checked={telegramWorkflow.enabled}
                      onCheckedChange={() => toggleWorkflow(telegramWorkflow.type, telegramWorkflow.enabled)}
                      disabled={!isAdmin}
                    />
                  </div>

                  {telegramWorkflow.enabled && (
                    <div className="space-y-4 pt-4 border-t border-border/30">
                      {/* Chat Types */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3">Chat Types</p>
                        <div className="space-y-2">
                          {[
                            { type: 'private', label: 'Private Chats', desc: '1-on-1 conversations' },
                            { type: 'group', label: 'Groups', desc: 'Regular group chats' },
                            { type: 'supergroup', label: 'Supergroups', desc: 'Large groups with admin features' }
                          ].map((chatType) => {
                            const isEnabled = telegramWorkflow.configuration?.chat_types?.[chatType.type] || false;
                            return (
                              <div key={chatType.type} className="flex items-center justify-between p-2 rounded bg-background/50">
                                <div>
                                  <p className="text-sm font-medium">{chatType.label}</p>
                                  <p className="text-xs text-muted-foreground">{chatType.desc}</p>
                                </div>
                                <Switch 
                                  checked={isEnabled}
                                  onCheckedChange={() => toggleChatType(telegramWorkflow.type, chatType.type, isEnabled)}
                                  disabled={!isAdmin}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Agent Mode Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground">🤖 Agent Mode</p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">
                                    <strong>Agent Mode OFF:</strong> Simple responses using conversation context only.<br/>
                                    <strong>Agent Mode ON:</strong> Advanced AI with iterative reasoning and tool access (web search, memory, chat history).
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          {isAgentModeActive(telegramWorkflow) && (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          )}
                        </div>

                        {/* Master Agent Mode Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5 mb-3">
                          <div>
                            <p className="text-sm font-medium">Enable Agent Mode</p>
                            <p className="text-xs text-muted-foreground">
                              {isAgentModeActive(telegramWorkflow) 
                                ? "Advanced AI with tool access enabled" 
                                : "Currently using simple mode"}
                            </p>
                          </div>
                          <Switch 
                            checked={isAgentModeActive(telegramWorkflow)}
                            onCheckedChange={(checked) => toggleAgentMode(telegramWorkflow.type, checked)}
                            disabled={!isAdmin}
                          />
                        </div>

                        {/* Advanced Tool Configuration */}
                        {isAgentModeActive(telegramWorkflow) && (
                          <Collapsible open={showAdvancedTools} onOpenChange={setShowAdvancedTools}>
                            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-between p-2 rounded hover:bg-accent">
                              <span>Advanced Tool Settings</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedTools ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 mt-2">
                              <div className="flex items-center justify-between p-2 rounded bg-background/50">
                                <div>
                                  <p className="text-sm font-medium">🌐 Web Search</p>
                                  <p className="text-xs text-muted-foreground">Search web for real-time information</p>
                                </div>
                                <Switch 
                                  checked={telegramWorkflow.configuration?.agent_tools?.web_search || false}
                                  onCheckedChange={() => toggleAgentTool(telegramWorkflow.type, 'web_search', telegramWorkflow.configuration?.agent_tools?.web_search || false)}
                                  disabled={!isAdmin}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between p-2 rounded bg-background/50">
                                <div>
                                  <p className="text-sm font-medium">💾 Search Memory</p>
                                  <p className="text-xs text-muted-foreground">Search community knowledge base</p>
                                </div>
                                <Switch 
                                  checked={telegramWorkflow.configuration?.agent_tools?.search_memory || false}
                                  onCheckedChange={() => toggleAgentTool(telegramWorkflow.type, 'search_memory', telegramWorkflow.configuration?.agent_tools?.search_memory || false)}
                                  disabled={!isAdmin}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between p-2 rounded bg-background/50">
                                <div>
                                  <p className="text-sm font-medium">🔍 Search Chat History</p>
                                  <p className="text-xs text-muted-foreground">Search recent messages</p>
                                </div>
                                <Switch 
                                  checked={telegramWorkflow.configuration?.agent_tools?.search_chat_history || false}
                                  onCheckedChange={() => toggleAgentTool(telegramWorkflow.type, 'search_chat_history', telegramWorkflow.configuration?.agent_tools?.search_chat_history || false)}
                                  disabled={!isAdmin}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between p-2 rounded bg-background/50">
                                <div>
                                  <p className="text-sm font-medium">💿 Save Memory</p>
                                  <p className="text-xs text-muted-foreground">Allow AI to save important information</p>
                                </div>
                                <Switch 
                                  checked={telegramWorkflow.configuration?.agent_tools?.save_memory || false}
                                  onCheckedChange={() => toggleAgentTool(telegramWorkflow.type, 'save_memory', telegramWorkflow.configuration?.agent_tools?.save_memory || false)}
                                  disabled={!isAdmin}
                                />
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>

                      {/* Auto-Intro Generation */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-xs font-medium text-muted-foreground">Auto-Intro Generation</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  AI generates personalized intros when users post in specified intro channels
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 rounded bg-background/50">
                            <div>
                              <p className="text-sm font-medium">✨ Auto-Generate Intros</p>
                              <p className="text-xs text-muted-foreground">AI creates personalized intros in intro channels</p>
                            </div>
                            <Switch 
                              checked={telegramWorkflow.configuration?.auto_intro_generation?.enabled || false}
                              onCheckedChange={() => toggleAutoIntroGeneration(telegramWorkflow.type, telegramWorkflow.configuration?.auto_intro_generation?.enabled || false)}
                              disabled={!isAdmin}
                            />
                          </div>
                          
                          {telegramWorkflow.configuration?.auto_intro_generation?.enabled && (
                            <div className="p-2 rounded bg-background/50">
                              <Label htmlFor="thread-names" className="text-xs">
                                Intro Channel Names (comma-separated)
                              </Label>
                              <Input
                                id="thread-names"
                                defaultValue={(telegramWorkflow.configuration?.auto_intro_generation?.thread_names || ['intros', 'introductions']).join(', ')}
                                placeholder="intros, introductions, introduce yourself"
                                onBlur={(e) => {
                                  const names = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                  if (names.length > 0) {
                                    updateIntroThreadNames(telegramWorkflow.type, names);
                                  }
                                }}
                                className="mt-1 text-xs"
                              />
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Messages in supergroup channels with these names will trigger auto-intro generation
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HEALTH TAB */}
          <TabsContent value="health" className="space-y-4 mt-6">
            {/* Bot Health Indicator */}
            <BotHealthIndicator communityId={community.id} />
            
            {/* Telegram Bot Connected Status */}
            {botInfo && (
              <Card className="gradient-card border-green-500/30 bg-green-50/5">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span>Telegram Bot Connected</span>
                  </CardTitle>
                  <CardDescription>
                    Your bot is active and responding to messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-green-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <Bot className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-lg">{botInfo.first_name}</h4>
                          <Badge variant="default" className="bg-green-600 text-white">
                            @{botInfo.username}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Bot ID: {botInfo.id}
                        </p>
                        <a 
                          href={`https://t.me/${botInfo.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center mt-1"
                        >
                          Open in Telegram →
                        </a>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-600">
                      ✓ Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Show connection prompt if bot not configured */}
            {!botInfo && (
              <Card className="border-border/30">
                <CardContent className="p-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Bot Connected</AlertTitle>
                    <AlertDescription>
                      Connect a Telegram bot in the Telegram tab to view health status.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Webhook Status */}
            {botInfo && community.telegram_bot_token && (
              <Card className="border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Globe className="w-5 h-5 text-primary" />
                      <span>Webhook Status</span>
                    </div>
                    <Button
                      onClick={handleCheckWebhook}
                      variant="outline"
                      size="sm"
                      disabled={checkingWebhook}
                    >
                      {checkingWebhook ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        'Check Status'
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {webhookInfo ? (
                    <div className="space-y-3">
                      {webhookInfo.url ? (
                        <Alert className="border-green-500/30 bg-green-500/5">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <AlertTitle>Webhook Active</AlertTitle>
                          <AlertDescription className="space-y-2">
                            <p className="text-xs break-all">
                              <strong>URL:</strong> {webhookInfo.url}
                            </p>
                            {webhookInfo.pending_update_count > 0 && (
                              <p className="text-xs text-yellow-600">
                                <strong>Pending updates:</strong> {webhookInfo.pending_update_count}
                              </p>
                            )}
                            {webhookInfo.last_error_message && (
                              <p className="text-xs text-destructive">
                                <strong>Last error:</strong> {webhookInfo.last_error_message}
                              </p>
                            )}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Webhook Not Configured</AlertTitle>
                          <AlertDescription>
                            <p className="text-xs mb-2">
                              Your bot won't receive messages until the webhook is set up.
                            </p>
                            <Button
                              onClick={() => setupWebhook(community.telegram_bot_token!)}
                              variant="outline"
                              size="sm"
                            >
                              Configure Webhook Now
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Click "Check Status" to view webhook info</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* OTHER WORKFLOW TABS */}
          {otherWorkflows.map((workflow) => (
            <TabsContent key={workflow.type} value={workflow.type.replace('_integration', '')} className="space-y-4 mt-6">
              <Card className="border-border/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-lg bg-primary/10">
                        {getWorkflowIcon(workflow.icon)}
                      </div>
                      <div>
                        <h4 className="font-medium text-lg">{workflow.name}</h4>
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
                  
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                      {workflow.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                    
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
                      >
                        <TestTube className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                    )}
                  </div>

                  {!workflow.enabled && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Coming Soon</AlertTitle>
                      <AlertDescription>
                        This workflow integration is currently in development. Enable it to get notified when it's ready.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
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
    </>
  );
};

export default WorkflowBuilder;
