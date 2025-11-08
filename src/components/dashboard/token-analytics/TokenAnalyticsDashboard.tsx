import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, Users, ArrowUpRight, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TokenAnalyticsDashboardProps {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  chainId: number;
  transactionHash: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
}

interface TokenHolder {
  address: string;
  balance: string;
}

export const TokenAnalyticsDashboard = ({
  tokenAddress,
  tokenName,
  tokenSymbol,
  chainId,
  transactionHash,
}: TokenAnalyticsDashboardProps) => {
  const [holderCount, setHolderCount] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isZeroAddress, setIsZeroAddress] = useState(false);

  useEffect(() => {
    // Check if it's a zero address (pending token)
    const isZero = tokenAddress === "0x0000000000000000000000000000000000000000" || !tokenAddress;
    setIsZeroAddress(isZero);
  }, [tokenAddress]);

  // Fetch token transactions from BaseScan API
  const { data: transferData, isLoading: loadingTransfers } = useQuery({
    queryKey: ['token-transfers', tokenAddress],
    queryFn: async () => {
      if (isZeroAddress) return null;
      
      const response = await fetch(
        `https://api.basescan.org/api?module=account&action=tokentx&contractaddress=${tokenAddress}&page=1&offset=100&sort=desc`
      );
      const data = await response.json();
      
      if (data.status === "1" && data.result) {
        setTransactions(data.result);
        
        // Calculate unique holders from transactions
        const uniqueHolders = new Set<string>();
        data.result.forEach((tx: Transaction) => {
          uniqueHolders.add(tx.to.toLowerCase());
          uniqueHolders.add(tx.from.toLowerCase());
        });
        setHolderCount(uniqueHolders.size);
        
        return data.result;
      }
      return [];
    },
    enabled: !isZeroAddress,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Calculate total volume from transactions
  const totalVolume = transactions.reduce((acc, tx) => {
    const value = parseFloat(tx.value) / 1e18; // Convert from wei
    return acc + value;
  }, 0);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleString();
  };

  const formatValue = (value: string) => {
    const val = parseFloat(value) / 1e18;
    return val.toFixed(4);
  };

  if (isZeroAddress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Token Analytics
          </CardTitle>
          <CardDescription>Real-time data for {tokenName}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Token address pending...</p>
                <p className="text-sm text-muted-foreground">
                  The token is being deployed on-chain. Once the transaction is confirmed, 
                  the token address will be available and analytics will load automatically.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://basescan.org/tx/${transactionHash}`, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Transaction on BaseScan
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Holders</CardDescription>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingTransfers ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{holderCount}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Volume</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingTransfers ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{totalVolume.toFixed(2)} {tokenSymbol}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Transactions</CardDescription>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingTransfers ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{transactions.length}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Token Analytics
          </CardTitle>
          <CardDescription>Real-time data for {tokenName}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transactions">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="info">Token Info</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4">
              {loadingTransfers ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.slice(0, 10).map((tx) => (
                    <Card key={tx.hash} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Transfer</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatValue(tx.value)} {tokenSymbol}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>From: {formatAddress(tx.from)}</div>
                            <div>To: {formatAddress(tx.to)}</div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(tx.timeStamp)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://basescan.org/tx/${tx.hash}`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found yet
                </div>
              )}
            </TabsContent>

            <TabsContent value="info" className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Token Address</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatAddress(tokenAddress)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://basescan.org/token/${tokenAddress}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Network</span>
                  <Badge variant="secondary">Base (Chain ID: {chainId})</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Total Holders</span>
                  <span className="text-sm font-semibold">{holderCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Total Transactions</span>
                  <span className="text-sm font-semibold">{transactions.length}</span>
                </div>
                <Alert className="mt-4">
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> Analytics data is fetched from BaseScan API. 
                    Price data and advanced metrics require additional integrations with DEX aggregators or The Graph.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};