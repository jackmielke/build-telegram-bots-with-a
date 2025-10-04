import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, DollarSign, Bot, Zap, TrendingUp, Activity } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  member_count?: number;
  total_tokens_used: number | null;
  total_cost_usd: number | null;
  telegram_bot_token: string | null;
  telegram_bot_url: string | null;
}

interface HomePageProps {
  community: Community;
  onNavigate: (tab: string) => void;
}

const HomePage = ({ community, onNavigate }: HomePageProps) => {
  const hasTelegram = !!community.telegram_bot_token;

  return (
    <div className="space-y-6">
      {/* Telegram Connection CTA - Show if not connected */}
      {!hasTelegram && (
        <Card className="gradient-card border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Connect Your Telegram Bot</CardTitle>
                <CardDescription className="text-base mt-1">
                  Get started in 2 minutes — enable AI responses in your Telegram community
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => onNavigate('agent')} 
              className="gradient-primary hover:shadow-glow"
              size="lg"
            >
              <Zap className="w-4 h-4 mr-2" />
              Connect Telegram Bot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{community.member_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Community members
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {community.total_tokens_used ? Math.floor(community.total_tokens_used / 100) : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI conversations
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cost</CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(community.total_cost_usd || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total AI spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Status */}
      {hasTelegram && (
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Bot Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Telegram Bot</span>
              <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                Connected
              </Badge>
            </div>
            {community.telegram_bot_url && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bot Link</span>
                <a 
                  href={community.telegram_bot_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open in Telegram
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Jump to the most used sections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('conversations')}
            >
              <MessageSquare className="w-5 h-5 text-primary" />
              <span className="text-xs">Conversations</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('agent')}
            >
              <Bot className="w-5 h-5 text-primary" />
              <span className="text-xs">Agent Setup</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('memory')}
            >
              <Users className="w-5 h-5 text-primary" />
              <span className="text-xs">Memory</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => onNavigate('settings')}
            >
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-xs">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;
