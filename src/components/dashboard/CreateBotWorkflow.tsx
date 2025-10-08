import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, ExternalLink, Loader2, Check, MessageSquare, Settings, Undo, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';

interface CreateBotWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateBotWorkflow = ({ open, onOpenChange }: CreateBotWorkflowProps) => {
  const [step, setStep] = useState<'guide' | 'token' | 'creating' | 'success' | 'configure'>('guide');
  const [botToken, setBotToken] = useState('');
  const [creating, setCreating] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful community assistant.');
  const [previousPrompt, setPreviousPrompt] = useState('');
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [respondInPrivate, setRespondInPrivate] = useState(true);
  const [respondInGroups, setRespondInGroups] = useState(false);
  const [respondInSupergroups, setRespondInSupergroups] = useState(false);
  const [botDetails, setBotDetails] = useState<{
    name: string;
    username: string;
    description: string;
    photoUrl: string | null;
    communityId: string;
  } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmitToken = async () => {
    if (!botToken.trim()) {
      toast({
        title: "Bot Token Required",
        description: "Please enter your Telegram bot token.",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    setStep('creating');

    try {
      // Test bot connection and get bot info
      const testResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      const testData = await testResponse.json();

      if (!testData.ok) {
        throw new Error('Invalid bot token');
      }

      // Fetch bot profile photo
      let photoUrl: string | null = null;
      try {
        const photosResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${testData.result.id}&limit=1`
        );
        const photosData = await photosResponse.json();
        
        if (photosData.ok && photosData.result.photos.length > 0) {
          const fileId = photosData.result.photos[0][0].file_id;
          const fileResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
          );
          const fileData = await fileResponse.json();
          
          if (fileData.ok) {
            photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
          }
        }
      } catch (error) {
        console.error('Error fetching bot photo:', error);
      }

      // Fetch bot description
      let botDescription = 'You are a helpful community assistant.';
      try {
        const descResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getMyDescription`
        );
        const descData = await descResponse.json();
        
        if (descData.ok && descData.result.description) {
          botDescription = descData.result.description;
        }
      } catch (error) {
        console.error('Error fetching bot description:', error);
      }

      const botUsername = testData.result.username;
      const botName = testData.result.first_name;
      const botUrl = `https://t.me/${botUsername}`;

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Not authenticated');
      }

      // Generate a simple universal_id (8 random alphanumeric chars)
      const generateUniversalId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Get or create internal user ID
      let { data: internalUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData.user.id)
        .maybeSingle();

      // If user doesn't exist in users table, create them
      if (!internalUser) {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert([{
            auth_user_id: userData.user.id,
            email: userData.user.email,
            name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'User',
            universal_id: generateUniversalId()
          }])
          .select('id')
          .single();

        if (userError) {
          console.error('Error creating user:', userError);
          throw new Error('Failed to create user profile');
        }

        internalUser = newUser;
      }

      // Create new community with bot name and profile photo
      const { data: newCommunity, error: communityError } = await supabase
        .from('communities')
        .insert([{
          name: botName,
          description: `Telegram bot community for @${botUsername}`,
          telegram_bot_token: botToken,
          telegram_bot_url: botUrl,
          agent_name: botName,
          agent_avatar_url: photoUrl,
          agent_instructions: botDescription,
          privacy_level: 'private',
          universal_id: generateUniversalId()
        }])
        .select()
        .single();

      if (communityError) throw communityError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: newCommunity.id,
          user_id: internalUser.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      // Set up webhook
      const webhookUrl = `https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-webhook?community_id=${newCommunity.id}`;
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        }
      );

      const webhookData = await webhookResponse.json();
      if (!webhookData.ok) {
        throw new Error('Failed to set webhook');
      }

      // Insert telegram_bots record
      const { error: botError } = await supabase
        .from('telegram_bots')
        .insert({
          user_id: internalUser.id,
          community_id: newCommunity.id,
          bot_token: botToken,
          bot_username: botUsername,
          bot_name: botName,
          is_active: true,
          webhook_url: webhookUrl
        });

      if (botError && botError.code !== '23505') {
        console.error('Error inserting telegram_bots record:', botError);
      }

      // Create default workflow with private chats enabled
      const workflowConfig = {
        search_chat_history: true,
        search_memory: true,
        save_memory: true,
        web_search: false,
        respond_in_groups: false,
        respond_in_private: true
      };

      // Create telegram_agent_tools workflow
      await supabase
        .from('community_workflows')
        .insert({
          community_id: newCommunity.id,
          workflow_type: 'telegram_agent_tools',
          configuration: workflowConfig,
          is_enabled: true
        });

      // Enable telegram_integration workflow
      await supabase
        .from('community_workflows')
        .upsert({
          community_id: newCommunity.id,
          workflow_type: 'telegram_integration',
          is_enabled: true,
          configuration: {
            chat_types: {
              private: true,
              group: false,
              supergroup: false
            }
          }
        }, {
          onConflict: 'community_id,workflow_type'
        });

      // Set bot details and show success screen
      setBotDetails({
        name: botName,
        username: botUsername,
        description: `Telegram bot community for @${botUsername}`,
        photoUrl,
        communityId: newCommunity.id
      });

      // Set the system prompt from bot description
      setSystemPrompt(botDescription);

      setStep('success');

      toast({
        title: "Bot Created!",
        description: `@${botUsername} is now connected and ready.`
      });

    } catch (error: any) {
      setStep('token');
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to create bot. Please check your token.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleImprovePrompt = async () => {
    if (!systemPrompt.trim()) {
      toast({
        title: "No prompt to improve",
        description: "Please enter a system prompt first.",
        variant: "destructive"
      });
      return;
    }

    setImprovingPrompt(true);
    setPreviousPrompt(systemPrompt);

    try {
      const { data, error } = await supabase.functions.invoke('improve-prompt', {
        body: { prompt: systemPrompt }
      });

      if (error) throw error;

      if (data?.improvedPrompt) {
        setSystemPrompt(data.improvedPrompt);
        toast({
          title: "Prompt Improved!",
          description: "Your system prompt has been enhanced."
        });
      }
    } catch (error: any) {
      toast({
        title: "Improvement Failed",
        description: error.message || "Failed to improve prompt.",
        variant: "destructive"
      });
    } finally {
      setImprovingPrompt(false);
    }
  };

  const handleUndoPrompt = () => {
    if (previousPrompt) {
      setSystemPrompt(previousPrompt);
      setPreviousPrompt('');
      toast({
        title: "Prompt Restored",
        description: "Reverted to previous version."
      });
    }
  };

  const handleClose = () => {
    if (!creating) {
      setStep('guide');
      setBotToken('');
      setBotDetails(null);
      setSystemPrompt('You are a helpful community assistant.');
      setPreviousPrompt('');
      setRespondInPrivate(true);
      setRespondInGroups(false);
      setRespondInSupergroups(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        {step === 'guide' && (
          <>
            <DialogHeader className="text-center space-y-3 pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <DialogTitle className="text-2xl">
                Create Your Telegram Bot
              </DialogTitle>
              <DialogDescription className="text-base">
                Create a bot with BotFather to get started
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-4">
                <a 
                  href="https://t.me/BotFather" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium text-lg"
                >
                  Open BotFather to create your bot
                  <ExternalLink className="w-5 h-5" />
                </a>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="w-4 h-4" />
                    Need help?
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 text-sm text-muted-foreground space-y-2 pl-6">
                    <p>
                      Send <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/newbot</code> to @BotFather and follow the prompts to set your bot's name and username.
                    </p>
                    <p>
                      You can also customize your bot's description and profile photo using <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/setdescription</code> and <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/setuserpic</code>.
                    </p>
                    <p>
                      Once created, BotFather will give you an API token - copy it for the next step.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="flex justify-center pt-2">
                <Button onClick={() => setStep('token')} size="lg" className="gradient-primary hover:shadow-glow">
                  I've Created My Bot
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'token' && (
          <>
            <DialogHeader className="text-center space-y-3 pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <DialogTitle className="text-2xl">
                Enter Your Bot Token
              </DialogTitle>
              <DialogDescription className="text-base">
                Paste the token you received from{' '}
                <a 
                  href="https://t.me/BotFather" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  BotFather
                </a>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="bot_token" className="text-sm font-medium">Bot Token</Label>
                <Input
                  id="bot_token"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="font-mono text-sm h-11"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The token should look like: <code className="font-mono bg-muted px-1 py-0.5 rounded">123456789:ABCdefGHI...</code>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('guide')}
                  className="flex-1"
                  size="lg"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmitToken}
                  disabled={creating || !botToken.trim()}
                  className="flex-1 gradient-primary"
                  size="lg"
                >
                  Create Bot
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'creating' && (
          <>
            <DialogHeader className="text-center space-y-3">
              <DialogTitle className="text-2xl flex items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                Creating Your Bot...
              </DialogTitle>
            </DialogHeader>

            <div className="py-12 text-center space-y-5">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
              </div>
              <p className="text-base text-muted-foreground">
                Setting up your bot and creating your community...
              </p>
            </div>
          </>
        )}

        {step === 'success' && botDetails && (
          <>
            <DialogHeader className="text-center space-y-3 pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <DialogTitle className="text-2xl">
                Bot Created Successfully!
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center space-y-4">
                {botDetails.photoUrl ? (
                  <img 
                    src={botDetails.photoUrl} 
                    alt={botDetails.name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-12 h-12 text-primary" />
                  </div>
                )}
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">{botDetails.name}</h3>
                  <p className="text-sm text-muted-foreground">@{botDetails.username}</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {botDetails.description}
                  </p>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Button 
                  onClick={() => setStep('configure')} 
                  size="lg" 
                  className="gradient-primary hover:shadow-glow"
                >
                  Configure Bot
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
        {step === 'configure' && botDetails && (
          <>
            <DialogHeader className="text-center space-y-3 pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Settings className="w-7 h-7 text-primary" />
              </div>
              <DialogTitle className="text-2xl">
                Configure Your Bot
              </DialogTitle>
              <DialogDescription className="text-base">
                Set up how your bot responds and behaves
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* DM Settings */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Message Settings</Label>
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Direct Messages</p>
                      </div>
                    </div>
                    <Switch
                      checked={respondInPrivate}
                      onCheckedChange={setRespondInPrivate}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Groups</p>
                      </div>
                    </div>
                    <Switch
                      checked={respondInGroups}
                      onCheckedChange={setRespondInGroups}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Supergroups</p>
                      </div>
                    </div>
                    <Switch
                      checked={respondInSupergroups}
                      onCheckedChange={setRespondInSupergroups}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose where your bot should respond to messages
                </p>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label htmlFor="system_prompt" className="text-base font-semibold">
                  System Prompt
                </Label>
                <Textarea
                  id="system_prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Define how your bot should behave..."
                  className="min-h-[120px]"
                  disabled={improvingPrompt}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleImprovePrompt}
                    disabled={improvingPrompt || !systemPrompt.trim()}
                  >
                    {improvingPrompt ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 mr-1.5" />
                        Improve Prompt
                      </>
                    )}
                  </Button>
                  {previousPrompt && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUndoPrompt}
                    >
                      <Undo className="w-3 h-3 mr-1.5" />
                      Undo
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground flex-1">
                    This prompt defines your bot's personality and behavior.
                  </p>
                </div>
              </div>

              {/* Memories Section */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Memory & Context</Label>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">
                    Your bot will automatically save important information from conversations to provide better, more contextual responses over time.
                  </p>
                  <p className="text-sm text-primary font-medium">
                    Memory saving is enabled by default
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('success')}
                  className="flex-1"
                  size="lg"
                >
                  Back
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      setCreating(true);
                      
                      // Update the community with the system prompt
                      const { error: communityError } = await supabase
                        .from('communities')
                        .update({
                          agent_instructions: systemPrompt
                        })
                        .eq('id', botDetails.communityId);

                      if (communityError) throw communityError;

                      // Update workflow configuration with message settings
                      const { error: workflowError } = await supabase
                        .from('community_workflows')
                        .update({
                          configuration: {
                            search_chat_history: true,
                            search_memory: true,
                            save_memory: true,
                            web_search: false,
                            respond_in_groups: respondInGroups,
                            respond_in_supergroups: respondInSupergroups,
                            respond_in_private: respondInPrivate
                          }
                        })
                        .eq('community_id', botDetails.communityId)
                        .eq('workflow_type', 'telegram_agent_tools');

                      if (workflowError) throw workflowError;

                      // Update telegram_integration workflow with chat type settings
                      const { error: integrationError } = await supabase
                        .from('community_workflows')
                        .upsert({
                          community_id: botDetails.communityId,
                          workflow_type: 'telegram_integration',
                          is_enabled: true,
                          configuration: {
                            chat_types: {
                              private: respondInPrivate,
                              group: respondInGroups,
                              supergroup: respondInSupergroups
                            }
                          }
                        }, {
                          onConflict: 'community_id,workflow_type'
                        });

                      if (integrationError) throw integrationError;

                      toast({
                        title: "Bot Configured!",
                        description: "Your bot is ready to use."
                      });

                      setTimeout(() => {
                        navigate(`/community/${botDetails.communityId}`);
                        onOpenChange(false);
                      }, 1000);
                    } catch (error: any) {
                      toast({
                        title: "Configuration Error",
                        description: error.message || "Failed to save configuration.",
                        variant: "destructive"
                      });
                    } finally {
                      setCreating(false);
                    }
                  }}
                  disabled={creating}
                  className="flex-1 gradient-primary"
                  size="lg"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save & Continue
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
