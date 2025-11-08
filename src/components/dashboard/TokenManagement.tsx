import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, ExternalLink, Rocket } from "lucide-react";
import { TokenLaunchDialog } from "./TokenLaunchDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface TokenManagementProps {
  communityId: string;
  communityName: string;
  coverImageUrl?: string | null;
}

export const TokenManagement = ({ communityId, communityName, coverImageUrl }: TokenManagementProps) => {
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);

  const { data: tokens, isLoading, refetch } = useQuery({
    queryKey: ['bot-tokens', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bot_tokens')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Token Management
              </CardTitle>
              <CardDescription>
                Launch and manage tokens for your community
              </CardDescription>
            </div>
            <Button onClick={() => setShowLaunchDialog(true)}>
              <Rocket className="mr-2 h-4 w-4" />
              Launch Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : tokens && tokens.length > 0 ? (
            <div className="space-y-4">
              {tokens.map((token) => (
                <Card key={token.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        {token.image_ipfs_hash && (
                          <img
                            src={`https://ipfs.io/ipfs/${token.image_ipfs_hash}`}
                            alt={token.token_name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                         <div className="space-y-2">
                          <div>
                            <h3 className="font-semibold text-lg">{token.token_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              ${token.token_symbol}
                            </p>
                          </div>
                          {token.token_description && (
                            <p className="text-sm text-muted-foreground max-w-md">
                              {token.token_description}
                            </p>
                          )}
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap gap-2 text-muted-foreground">
                              <span>Address: {formatAddress(token.token_address)}</span>
                              <span>•</span>
                              <span>Chain: Base ({token.chain_id})</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-muted-foreground">
                              <span>Launched: {formatDate(token.created_at)}</span>
                            </div>
                            {token.launch_metadata && (
                              <div className="pt-1 border-t mt-2">
                                <p className="text-xs font-medium text-foreground mb-1">Distribution:</p>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">65%</Badge>
                                    <span className="text-muted-foreground">Template Allocation</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">35%</Badge>
                                    <span className="text-muted-foreground">Beneficiary ({formatAddress((token.launch_metadata as any)?.user_address || '')})</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge variant="secondary">Active</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://basescan.org/tx/${token.transaction_hash}`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View on BaseScan
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Coins className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold">No tokens yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Launch your first token to enable tokenomics for your community
                </p>
              </div>
              <Button onClick={() => setShowLaunchDialog(true)}>
                <Rocket className="mr-2 h-4 w-4" />
                Launch Your First Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TokenLaunchDialog
        open={showLaunchDialog}
        onOpenChange={setShowLaunchDialog}
        communityId={communityId}
        communityName={communityName}
        coverImageUrl={coverImageUrl}
      />
    </>
  );
};
