import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, ExternalLink, Loader2 } from 'lucide-react';

interface TelegramBotDialogProps {
  communityId: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TelegramBotDialog = ({ 
  communityId, 
  onSuccess, 
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange 
}: TelegramBotDialogProps) => {
  const [localOpen, setLocalOpen] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : localOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setLocalOpen;

  const handleConnect = async () => {
    if (!botToken.trim()) {
      toast({
        title: "Bot Token Required",
        description: "Please enter your Telegram bot token.",
        variant: "destructive"
      });
      return;
    }

    setConnecting(true);
    try {
      // Test bot connection
      const testResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`
      );
      const testData = await testResponse.json();

      if (!testData.ok) {
        throw new Error('Invalid bot token');
      }

      const botUsername = testData.result.username;
      const botUrl = `https://t.me/${botUsername}`;

      // Update community with bot token
      const { error: updateError } = await supabase
        .from('communities')
        .update({
          telegram_bot_token: botToken,
          telegram_bot_url: botUrl
        })
        .eq('id', communityId);

      if (updateError) throw updateError;

      // Set up webhook
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`;
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
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { error: insertError } = await supabase
          .from('telegram_bots')
          .insert({
            user_id: userData.user.id,
            community_id: communityId,
            bot_token: botToken,
            bot_username: botUsername,
            is_active: true
          });

        if (insertError && insertError.code !== '23505') { // Ignore duplicate key error
          console.error('Error inserting telegram_bots record:', insertError);
        }
      }

      toast({
        title: "Bot Connected!",
        description: `@${botUsername} is now connected and active.`
      });

      setBotToken('');
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect bot. Please check your token.",
        variant: "destructive"
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Connect Telegram Bot
          </DialogTitle>
          <DialogDescription>
            Enter your bot token to connect your Telegram bot
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bot_token">Bot Token</Label>
            <Input
              id="bot_token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Get your bot token from{' '}
              <a 
                href="https://t.me/BotFather" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                @BotFather
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Quick Setup Guide:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Message @BotFather on Telegram</li>
              <li>Send /newbot and follow the prompts</li>
              <li>Copy the token you receive</li>
              <li>Paste it above and click Connect</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connecting || !botToken.trim()}
            className="flex-1 gradient-primary"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Bot'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
