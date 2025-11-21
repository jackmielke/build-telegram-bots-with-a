import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Wallet, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export const WalletConnectionDialog = () => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();

  const handleConnect = async (connector: any) => {
    connect({ connector }, {
      onSuccess: async (data) => {
        setSaving(true);
        try {
          // Get the current user
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) {
            toast.error('No authenticated user found');
            return;
          }

          // Find the user record by auth_user_id
          const { data: userRecord, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

          if (fetchError || !userRecord) {
            toast.error('User profile not found');
            return;
          }

          // Update the user's wallet information
          const { error: updateError } = await supabase
            .from('users')
            .update({
              wallet_address: data.accounts[0],
              wallet_provider: connector.name.toLowerCase(),
              wallet_connected_at: new Date().toISOString(),
            })
            .eq('id', userRecord.id);

          if (updateError) {
            toast.error('Failed to save wallet: ' + updateError.message);
            return;
          }

          toast.success(`Connected ${connector.name}!`);
          queryClient.invalidateQueries({ queryKey: ['user'] });
          setOpen(false);
        } catch (error) {
          console.error('Error saving wallet:', error);
          toast.error('Failed to save wallet connection');
        } finally {
          setSaving(false);
        }
      },
      onError: (error) => {
        toast.error(error.message);
      }
    });
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (userRecord) {
          await supabase
            .from('users')
            .update({
              wallet_address: null,
              wallet_provider: null,
              wallet_connected_at: null,
            })
            .eq('id', userRecord.id);
        }
      }

      disconnect();
      toast.success('Wallet disconnected');
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setOpen(false);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast.error('Failed to disconnect wallet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4" />
          {isConnected ? 'Manage Wallet' : 'Connect Wallet'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Your Wallet</DialogTitle>
          <DialogDescription>
            Connect your crypto wallet to enable P2P payments and token features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium">Connected</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                disabled={saving}
                className="w-full"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect Wallet
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {connectors.map((connector) => (
                <Button
                  key={connector.id}
                  onClick={() => handleConnect(connector)}
                  variant="outline"
                  disabled={isPending || saving}
                  className="w-full justify-start gap-3"
                >
                  {(isPending || saving) && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Wallet className="h-5 w-5" />
                  Connect {connector.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
