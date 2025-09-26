import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  DollarSign, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  Activity,
  Users
} from 'lucide-react';

interface Community {
  id: string;
  name: string;
  total_tokens_used: number | null;
  total_cost_usd: number | null;
  member_count?: number;
}

interface AnalyticsData {
  totalSessions: number;
  totalMessages: number;
  averageSessionLength: number;
  recentSessions: any[];
  activityTrend: any[];
}

const AnalyticsDashboard = ({ community }: { community: Community }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalSessions: 0,
    totalMessages: 0,
    averageSessionLength: 0,
    recentSessions: [],
    activityTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [community.id]);

  const fetchAnalytics = async () => {
    try {
      // Fetch AI chat sessions for this community
      const { data: sessions, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch recent messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) throw messagesError;

      // Calculate analytics
      const totalSessions = sessions?.length || 0;
      const totalMessages = sessions?.reduce((sum, session) => sum + (session.message_count || 0), 0) || 0;
      const averageSessionLength = totalSessions > 0 
        ? Math.round(totalMessages / totalSessions) 
        : 0;

      setAnalytics({
        totalSessions,
        totalMessages,
        averageSessionLength,
        recentSessions: sessions?.slice(0, 5) || [],
        activityTrend: [] // We can add trend calculation later
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(community.total_cost_usd || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime AI usage cost
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatTokens(community.total_tokens_used || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total tokens processed
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {analytics.totalSessions}
            </div>
            <p className="text-xs text-muted-foreground">
              Total AI chat sessions
            </p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {community.member_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active community members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-primary" />
              <span>Recent AI Sessions</span>
            </CardTitle>
            <CardDescription>
              Latest AI chat interactions in your community
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.recentSessions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No AI sessions yet
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.recentSessions.map((session, index) => (
                  <div 
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-primary shadow-glow" />
                      <div>
                        <p className="text-sm font-medium">
                          {session.model_used}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">
                        {formatCurrency(session.cost_usd)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTokens(session.tokens_used)} tokens
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Usage Insights</span>
            </CardTitle>
            <CardDescription>
              Analytics and patterns from your AI usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Average Session Messages</span>
                <span className="text-sm text-primary">{analytics.averageSessionLength}</span>
              </div>
              <Progress 
                value={Math.min((analytics.averageSessionLength / 20) * 100, 100)} 
                className="h-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Cost Efficiency</span>
                <Badge variant="secondary">Good</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Average cost per message: {analytics.totalMessages > 0 
                  ? formatCurrency((community.total_cost_usd || 0) / analytics.totalMessages)
                  : '$0.00'
                }
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Activity Level</span>
                <Badge variant={analytics.totalSessions > 10 ? 'default' : 'outline'}>
                  {analytics.totalSessions > 10 ? 'Active' : 'Getting Started'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on total sessions and member engagement
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;