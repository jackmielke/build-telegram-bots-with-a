import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, BarChart3, Bot, Brain, Users, Zap, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Import dashboard sections
import AnalyticsDashboard from '@/components/dashboard/AnalyticsDashboard';
import AgentConfiguration from '@/components/dashboard/AgentConfiguration';
import MemoryManagement from '@/components/dashboard/MemoryManagement';
import CommunitySettings from '@/components/dashboard/CommunitySettings';
import WorkflowBuilder from '@/components/dashboard/WorkflowBuilder';

interface Community {
  id: string;
  name: string;
  description: string | null;
  agent_name: string | null;
  agent_avatar_url: string | null;
  agent_instructions: string | null;
  agent_intro_message: string | null;
  agent_model: string | null;
  agent_max_tokens: number | null;
  agent_temperature: number | null;
  agent_suggested_messages: string[] | null;
  privacy_level: string;
  invite_code: string | null;
  cover_image_url: string | null;
  telegram_bot_token: string | null;
  telegram_bot_url: string | null;
  total_tokens_used: number | null;
  total_cost_usd: number | null;
  member_count?: number;
  user_role?: string;
}

const CommunityDashboard = () => {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    const checkAuthAndFetchCommunity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      await fetchCommunity(session.user.id);
    };

    checkAuthAndFetchCommunity();
  }, [communityId, navigate]);

  const fetchCommunity = async (authUserId: string) => {
    try {
      // Get user's internal ID and check membership
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();

      if (!userData) {
        navigate('/communities');
        return;
      }

      // Check if user is a member of this community
      const { data: memberData } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', userData.id)
        .single();

      if (!memberData) {
        toast({
          title: "Access Denied",
          description: "You don't have access to this community",
          variant: "destructive"
        });
        navigate('/communities');
        return;
      }

      // Fetch community details
      const { data: communityData, error } = await supabase
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single();

      if (error) throw error;

      // Get member count
      const { count: memberCount } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);

      setCommunity({
        ...communityData,
        member_count: memberCount || 0,
        user_role: memberData.role
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load community",
        variant: "destructive"
      });
      navigate('/communities');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!community) {
    return null;
  }

  const isAdmin = community.user_role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/communities')}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  {community.agent_avatar_url ? (
                    <img 
                      src={community.agent_avatar_url} 
                      alt={community.agent_name || community.name}
                      className="w-6 h-6 rounded-md"
                    />
                  ) : (
                    <Bot className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{community.name}</h1>
                  {community.agent_name && (
                    <p className="text-sm text-muted-foreground">
                      Agent: {community.agent_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant={isAdmin ? 'default' : 'outline'}>
                {community.user_role}
              </Badge>
              <Badge variant="secondary">
                {community.member_count} members
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-card/50">
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Agent</span>
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <span>Memory</span>
            </TabsTrigger>
            <TabsTrigger value="community" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Community</span>
            </TabsTrigger>
            <TabsTrigger value="workflows" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Workflows</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard community={community} />
          </TabsContent>

          <TabsContent value="agent" className="space-y-6">
            <AgentConfiguration 
              community={community} 
              isAdmin={isAdmin} 
              onUpdate={(updatedCommunity) => setCommunity(prev => ({ ...prev, ...updatedCommunity }))} 
            />
          </TabsContent>

          <TabsContent value="memory" className="space-y-6">
            <MemoryManagement communityId={community.id} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <CommunitySettings 
              community={community} 
              isAdmin={isAdmin} 
              onUpdate={(updatedCommunity) => setCommunity(prev => ({ ...prev, ...updatedCommunity }))} 
            />
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            <WorkflowBuilder community={community} isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CommunityDashboard;