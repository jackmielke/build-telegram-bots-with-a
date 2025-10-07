import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, ExternalLink, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateBotWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateBotWorkflow = ({ open, onOpenChange }: CreateBotWorkflowProps) => {
  const [step, setStep] = useState<'guide' | 'token' | 'creating'>('guide');
  const [botToken, setBotToken] = useState('');
  const [creating, setCreating] = useState(false);
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

      const botUsername = testData.result.username;
      const botName = testData.result.first_name;
      const botUrl = `https://t.me/${botUsername}`;

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Not authenticated');
      }

      // Get internal user ID
      const { data: internalUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData.user.id)
        .single();

      if (!internalUser) {
        throw new Error('User not found');
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

      // Create new community with bot name
      const { data: newCommunity, error: communityError } = await supabase
        .from('communities')
        .insert([{
          name: botName,
          description: `Telegram bot community for @${botUsername}`,
          created_by: internalUser.id,
          telegram_bot_token: botToken,
          telegram_bot_url: botUrl,
          agent_name: botName,
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

      await supabase
        .from('community_workflows')
        .insert({
          community_id: newCommunity.id,
          workflow_type: 'telegram_agent_tools',
          configuration: workflowConfig,
          is_enabled: true
        });

      toast({
        title: "Bot Created!",
        description: `@${botUsername} is now connected and ready.`
      });

      // Redirect to the new community dashboard
      setTimeout(() => {
        navigate(`/community/${newCommunity.id}`);
        onOpenChange(false);
      }, 1500);

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

  const handleClose = () => {
    if (!creating) {
      setStep('guide');
      setBotToken('');
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
                Follow these steps to create a new bot with BotFather
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-semibold mb-1.5 text-base">Open BotFather on Telegram</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Message @BotFather to create your bot
                    </p>
                    <a 
                      href="https://t.me/BotFather" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                    >
                      Open BotFather
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-semibold mb-1.5 text-base">Create a new bot</p>
                    <p className="text-sm text-muted-foreground">
                      Send <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/newbot</code> and follow the prompts to set your bot's name and username
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-semibold mb-1.5 text-base">Customize your bot (optional)</p>
                    <p className="text-sm text-muted-foreground">
                      Use <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/setdescription</code> and <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">/setuserpic</code> to add a description and profile photo
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    4
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-semibold mb-1.5 text-base">Copy your bot token</p>
                    <p className="text-sm text-muted-foreground">
                      BotFather will give you an API token - copy it and paste it in the next step
                    </p>
                  </div>
                </div>
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
                Paste the token you received from BotFather
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
                  Create Bot Community
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
      </DialogContent>
    </Dialog>
  );
};
