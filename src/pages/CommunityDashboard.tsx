import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Home, MessageSquare, Bot, Brain, Settings, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Import dashboard sections
import HomePage from '@/components/dashboard/HomePage';
import ChatHistoryDashboard from '@/components/dashboard/ChatHistoryDashboard';
import AgentSetup from '@/components/dashboard/AgentSetup';
import WorkflowBuilder from '@/components/dashboard/WorkflowBuilder';
import LLMSettings from '@/components/dashboard/LLMSettings';
import MemoryManagement from '@/components/dashboard/MemoryManagement';
import CommunitySettings from '@/components/dashboard/CommunitySettings';

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
  const [activeTab, setActiveTab] = useState('home');
  const [agentSubTab, setAgentSubTab] = useState('setup');

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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/communities')}
                className="hover:bg-primary/10 p-2"
              >
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  {community.agent_avatar_url ? (
                    <img 
                      src={community.agent_avatar_url} 
                      alt={community.agent_name || community.name}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md"
                    />
                  ) : (
                    <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[180px] sm:max-w-none">{community.name}</h1>
                  {community.agent_name && (
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                      Agent: {community.agent_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Community Info Bar */}
      <div className="border-b border-border/30 bg-muted/30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Badge variant={isAdmin ? 'default' : 'outline'} className="text-xs">
              {community.user_role}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {community.member_count} members
            </Badge>
            {community.agent_name && (
              <Badge variant="outline" className="text-xs sm:hidden">
                {community.agent_name}
              </Badge>
            )}
            {community.telegram_bot_token && (
              <Badge variant="outline" className="text-xs flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                <Check className="w-3 h-3" />
                Telegram
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 bg-card/50 p-2 h-auto">
            <TabsTrigger value="home" className="flex flex-col items-center justify-center gap-2 py-4 px-3 text-sm font-medium rounded-lg border border-transparent data-[state=active]:border-primary/20 data-[state=active]:shadow-sm">
              <Home className="w-6 h-6 text-primary" />
              <span className="text-xs">Home</span>
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex flex-col items-center justify-center gap-2 py-4 px-3 text-sm font-medium rounded-lg border border-transparent data-[state=active]:border-primary/20 data-[state=active]:shadow-sm">
              <MessageSquare className="w-6 h-6 text-primary" />
              <span className="text-xs">Conversations</span>
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex flex-col items-center justify-center gap-2 py-4 px-3 text-sm font-medium rounded-lg border border-transparent data-[state=active]:border-primary/20 data-[state=active]:shadow-sm">
              <Bot className="w-6 h-6 text-primary" />
              <span className="text-xs">Agent</span>
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex flex-col items-center justify-center gap-2 py-4 px-3 text-sm font-medium rounded-lg border border-transparent data-[state=active]:border-primary/20 data-[state=active]:shadow-sm">
              <Brain className="w-6 h-6 text-primary" />
              <span className="text-xs">Memory</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex flex-col items-center justify-center gap-2 py-4 px-3 text-sm font-medium rounded-lg border border-transparent data-[state=active]:border-primary/20 data-[state=active]:shadow-sm">
              <Settings className="w-6 h-6 text-primary" />
              <span className="text-xs">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-6">
            <HomePage community={community} onNavigate={setActiveTab} />
          </TabsContent>

          <TabsContent value="conversations" className="space-y-6">
            <ChatHistoryDashboard communityId={community.id} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="agent" className="space-y-6">
            <Tabs value={agentSubTab} onValueChange={setAgentSubTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="workflows">Workflows</TabsTrigger>
                <TabsTrigger value="llm">LLM</TabsTrigger>
              </TabsList>

              <TabsContent value="setup">
                <AgentSetup 
                  community={community} 
                  isAdmin={isAdmin} 
                  onUpdate={(updatedCommunity) => setCommunity(prev => ({ ...prev, ...updatedCommunity }))} 
                />
              </TabsContent>

              <TabsContent value="workflows">
                <WorkflowBuilder 
                  community={community} 
                  isAdmin={isAdmin} 
                  onUpdate={(updatedCommunity) => setCommunity(prev => ({ ...prev, ...updatedCommunity }))} 
                />
              </TabsContent>

              <TabsContent value="llm">
                <LLMSettings 
                  community={community} 
                  isAdmin={isAdmin} 
                  onUpdate={(updatedCommunity) => setCommunity(prev => ({ ...prev, ...updatedCommunity }))} 
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="memory" className="space-y-6">
            <MemoryManagement communityId={community.id} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <CommunitySettings 
              community={community} 
              isAdmin={isAdmin} 
              onUpdate={(updatedCommunity) => setCommunity(prev => ({ ...prev, ...updatedCommunity }))} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CommunityDashboard;