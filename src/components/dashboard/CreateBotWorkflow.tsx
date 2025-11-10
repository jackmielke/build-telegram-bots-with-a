import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, ExternalLink, Loader2, Check, Info, Sparkles, Search, Database, Globe, ArrowRight, Coins } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { TokenLaunchDialog } from './TokenLaunchDialog';

interface CreateBotWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'setup' | 'creating' | 'success' | 'personality' | 'tools' | 'tokenize';

export const CreateBotWorkflow = ({ open, onOpenChange }: CreateBotWorkflowProps) => {
  const [step, setStep] = useState<Step>('setup');
  const [botToken, setBotToken] = useState('');
  const [creating, setCreating] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful community assistant.');
  const [previousPrompt, setPreviousPrompt] = useState('');
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  
  // Tool configuration
  const [searchMemoryEnabled, setSearchMemoryEnabled] = useState(true);
  const [addMemoryEnabled, setAddMemoryEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  
  // Tokenization
  const [showTokenLaunch, setShowTokenLaunch] = useState(false);
  const [wantsToken, setWantsToken] = useState<boolean | null>(null);
  
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
      setStep('setup');
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

  const handleSavePersonality = async () => {
    if (!botDetails) return;
    
    try {
      setCreating(true);
      
      const { error } = await supabase
        .from('communities')
        .update({
          agent_instructions: systemPrompt
        })
        .eq('id', botDetails.communityId);

      if (error) throw error;

      toast({
        title: "Personality Saved!",
        description: "Your bot's personality has been configured."
      });

      setStep('tools');
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save personality.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSaveTools = async () => {
    if (!botDetails) return;
    
    try {
      setCreating(true);
      
      const { error } = await supabase
        .from('community_workflows')
        .update({
          configuration: {
            search_chat_history: true,
            search_memory: searchMemoryEnabled,
            save_memory: addMemoryEnabled,
            web_search: webSearchEnabled,
            respond_in_groups: false,
            respond_in_private: true
          }
        })
        .eq('community_id', botDetails.communityId)
        .eq('workflow_type', 'telegram_agent_tools');

      if (error) throw error;

      toast({
        title: "Tools Configured!",
        description: "Your bot's capabilities have been set up."
      });

      setStep('tokenize');
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save tools configuration.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteSetup = () => {
    if (!botDetails) return;
    
    toast({
      title: "Setup Complete! 🎉",
      description: "Your bot is ready to use."
    });

    navigate(`/community/${botDetails.communityId}`);
    handleClose();
  };

  const handleClose = () => {
    if (!creating) {
      setStep('setup');
      setBotToken('');
      setBotDetails(null);
      setSystemPrompt('You are a helpful community assistant.');
      setPreviousPrompt('');
      setSearchMemoryEnabled(true);
      setAddMemoryEnabled(true);
      setWebSearchEnabled(false);
      setWantsToken(null);
      setShowTokenLaunch(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[550px]">
          {step === 'setup' && (
            <>
              <DialogHeader className="text-center space-y-3 pb-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <DialogTitle className="text-2xl">
                  Create Your Telegram Bot
                </DialogTitle>
                <DialogDescription className="text-base">
                  Create your bot with BotFather, then paste the token below
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="space-y-4">
                  <a 
                    href="https://t.me/BotFather" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    Open BotFather
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-4 h-4" />
                      Need help?
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 text-sm text-muted-foreground space-y-3 pl-6">
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">
                          ✨ Easiest way:
                        </p>
                        <p>
                          Click <strong>"Open"</strong> in the bottom left of the BotFather chat to launch the Mini App, then create your bot there. It's the simplest method!
                        </p>
                      </div>
                      
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm hover:text-foreground transition-colors">
                          <Info className="w-4 h-4" />
                          If that didn't work, try this:
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2 pl-6">
                          <p>
                            Send <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/newbot</code> to @BotFather and follow the prompts to set your bot's name and username.
                          </p>
                          <p>
                            Once created, BotFather will give you an API token - paste it below.
                          </p>
                        </CollapsibleContent>
                      </Collapsible>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

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

                <div className="flex justify-center pt-2">
                  <Button
                    onClick={handleSubmitToken}
                    disabled={creating || !botToken.trim()}
                    className="gradient-primary"
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
                <DialogDescription className="text-base">
                  Now let's set up your bot's personality
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="flex flex-col items-center space-y-4">
                  {botDetails.photoUrl ? (
                    <img 
                      src={botDetails.photoUrl} 
                      alt={botDetails.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-semibold">{botDetails.name}</h3>
                    <p className="text-sm text-muted-foreground">@{botDetails.username}</p>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <Button 
                    onClick={() => setStep('personality')} 
                    size="lg" 
                    className="gradient-primary"
                  >
                    Set Up Personality
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'personality' && botDetails && (
            <>
              <DialogHeader className="text-center space-y-3 pb-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <DialogTitle className="text-2xl">
                  Set Your Bot's Personality
                </DialogTitle>
                <DialogDescription className="text-base">
                  Define how your bot should think and respond
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="system_prompt" className="text-sm font-medium">
                    System Prompt
                  </Label>
                  <Textarea
                    id="system_prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Define how your bot should behave..."
                    className="min-h-[140px]"
                    disabled={improvingPrompt}
                  />
                  <div className="flex items-center gap-2 pt-1">
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
                          <Sparkles className="w-3 h-3 mr-1.5" />
                          Improve with AI
                        </>
                      )}
                    </Button>
                    {previousPrompt && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSystemPrompt(previousPrompt);
                          setPreviousPrompt('');
                        }}
                      >
                        Undo
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This defines your bot's personality, tone, and how it responds to users.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('success')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSavePersonality}
                    disabled={creating || !systemPrompt.trim()}
                    className="flex-1 gradient-primary"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Next: Tools
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'tools' && botDetails && (
            <>
              <DialogHeader className="text-center space-y-3 pb-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Database className="w-7 h-7 text-primary" />
                </div>
                <DialogTitle className="text-2xl">
                  Configure Bot Tools
                </DialogTitle>
                <DialogDescription className="text-base">
                  Choose what capabilities your bot should have
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Search className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Search Memory</p>
                        <p className="text-xs text-muted-foreground">
                          Search through saved conversations and information
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={searchMemoryEnabled}
                      onCheckedChange={setSearchMemoryEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Database className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Add Memory</p>
                        <p className="text-xs text-muted-foreground">
                          Save new information from conversations
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={addMemoryEnabled}
                      onCheckedChange={setAddMemoryEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Web Search</p>
                        <p className="text-xs text-muted-foreground">
                          Search the internet for current information
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={webSearchEnabled}
                      onCheckedChange={setWebSearchEnabled}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  You can add more tools and customize these settings later in the dashboard.
                </p>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('personality')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSaveTools}
                    disabled={creating}
                    className="flex-1 gradient-primary"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Next Step
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'tokenize' && botDetails && (
            <>
              <DialogHeader className="text-center space-y-3 pb-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="w-7 h-7 text-primary" />
                </div>
                <DialogTitle className="text-2xl">
                  Tokenize Your Bot?
                </DialogTitle>
                <DialogDescription className="text-base">
                  Launch a token for your bot community (optional)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <p className="text-sm">
                    <strong>What's this?</strong> You can create a token for your bot community on Base blockchain. This allows you to:
                  </p>
                  <ul className="text-sm space-y-1.5 list-disc list-inside text-muted-foreground">
                    <li>Build community ownership and engagement</li>
                    <li>Reward active members with tokens</li>
                    <li>Create token-gated features</li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2">
                    Don't worry - you can always do this later from the settings page.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCompleteSetup}
                    className="flex-1"
                    size="lg"
                  >
                    Skip for Now
                  </Button>
                  <Button
                    onClick={() => {
                      setWantsToken(true);
                      setShowTokenLaunch(true);
                    }}
                    className="flex-1 gradient-primary"
                    size="lg"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    Launch Token
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Token Launch Dialog */}
      {botDetails && (
        <TokenLaunchDialog
          open={showTokenLaunch}
          onOpenChange={(open) => {
            setShowTokenLaunch(open);
            if (!open && wantsToken) {
              // User completed or cancelled token launch
              handleCompleteSetup();
            }
          }}
          communityId={botDetails.communityId}
          communityName={botDetails.name}
          coverImageUrl={botDetails.photoUrl}
        />
      )}
    </>
  );
};
