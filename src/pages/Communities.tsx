import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Users, Crown, Shield, Plus, LogOut, Heart, Sparkles, Compass, Bot, Mic, Phone, PhoneOff, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversation } from '@11labs/react';
import CreateCommunityDialog from '@/components/CreateCommunityDialog';
import { CreateBotWorkflow } from '@/components/dashboard/CreateBotWorkflow';
import { CommunityAppTile } from '@/components/dashboard/CommunityAppTile';
import { useIsMobile } from '@/hooks/use-mobile';
import vibeLogo from '@/assets/vibe-logo.png';

interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  agent_name: string | null;
  agent_avatar_url: string | null;
  privacy_level: string;
  role: string;
  member_count?: number;
  is_favorited: boolean;
  elevenlabs_agent_id: string | null;
}

const Communities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunities, setActiveCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showCreateBotWorkflow, setShowCreateBotWorkflow] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [activeVoiceCall, setActiveVoiceCall] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const conversation = useConversation({
    onConnect: () => {
      toast({
        title: "Connected",
        description: "Voice conversation started",
      });
    },
    onDisconnect: () => {
      setActiveVoiceCall(null);
      toast({
        title: "Disconnected",
        description: "Voice conversation ended",
      });
    },
    onError: (error) => {
      console.error("Voice error:", error);
      setActiveVoiceCall(null);
      const errorMessage = typeof error === 'string' 
        ? error 
        : (error as any)?.message || "An error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
      await fetchCommunities(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchCommunities = async (authUserId: string) => {
    try {
      // Get user's internal ID first
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();

      if (!userData) {
        setLoading(false);
        return;
      }

      // Fetch communities user is a member of with favorites info
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          role,
          communities (
            id,
            name,
            description,
            cover_image_url,
            agent_name,
            agent_avatar_url,
            privacy_level,
            elevenlabs_agent_id
          )
        `)
        .eq('user_id', userData.id);

      if (error) throw error;

      // Get favorites for the user
      const { data: favoritesData } = await supabase
        .from('community_favorites')
        .select('community_id')
        .eq('user_id', userData.id);

      const favoriteIds = new Set(favoritesData?.map(f => f.community_id) || []);

      const formattedCommunities = (data?.map(member => ({
        ...member.communities,
        role: member.role,
        is_favorited: favoriteIds.has(member.communities.id)
      })) || [])
      .sort((a, b) => {
        // Sort favorites first
        if (a.is_favorited && !b.is_favorited) return -1;
        if (!a.is_favorited && b.is_favorited) return 1;
        return a.name.localeCompare(b.name);
      });

      setCommunities(formattedCommunities as Community[]);

      // Show welcome dialog if user has no admin communities (no bots created)
      const adminCommunities = formattedCommunities.filter(c => c.role === 'admin');
      if (adminCommunities.length === 0) {
        setShowWelcomeDialog(true);
      }

      // Fetch top 10 most recently active communities
      const { data: activeData, error: activeError } = await supabase
        .from('communities')
        .select('id, name, description, cover_image_url, agent_name, agent_avatar_url, privacy_level, last_activity_at, elevenlabs_agent_id')
        .not('last_activity_at', 'is', null)
        .order('last_activity_at', { ascending: false })
        .limit(10);

      if (!activeError && activeData) {
        setActiveCommunities(activeData.map(c => ({ ...c, role: 'none', is_favorited: false })) as Community[]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load communities",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleToggleFavorite = async (e: React.MouseEvent, communityId: string) => {
    e.stopPropagation();
    
    if (!user) return;

    try {
      // Get user's internal ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) return;

      const community = communities.find(c => c.id === communityId);
      if (!community) return;

      if (community.is_favorited) {
        // Remove from favorites
        await supabase
          .from('community_favorites')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', userData.id);
      } else {
        // Add to favorites
        await supabase
          .from('community_favorites')
          .insert({
            community_id: communityId,
            user_id: userData.id
          });
      }

      // Update local state
      setCommunities(prev => {
        const updated = prev.map(c => 
          c.id === communityId 
            ? { ...c, is_favorited: !c.is_favorited }
            : c
        );
        
        // Re-sort with favorites first
        return updated.sort((a, b) => {
          if (a.is_favorited && !b.is_favorited) return -1;
          if (!a.is_favorited && b.is_favorited) return 1;
          return a.name.localeCompare(b.name);
        });
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update favorite",
        variant: "destructive"
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />;
      case 'moderator':
        return <Shield className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const startVoiceCall = async (e: React.MouseEvent, communityId: string, agentId: string) => {
    e.stopPropagation();
    
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-session", {
        body: { agentId },
      });

      if (error) throw error;
      if (!data?.signed_url) throw new Error("Failed to get signed URL");

      setActiveVoiceCall(communityId);
      await conversation.startSession({ signedUrl: data.signed_url } as any);
    } catch (error) {
      console.error("Error starting voice call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start voice call",
        variant: "destructive",
      });
    }
  };

  const endVoiceCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await conversation.endSession();
      setActiveVoiceCall(null);
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Dialog for First-Time Users */}
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="mx-auto mb-4">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <DialogTitle className="text-2xl text-center">
              Welcome to Vibe AI! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Get started by creating your first AI bot. You'll be able to customize its personality, 
              connect it to Telegram, deploy a token for it, and start growing your community!
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
                <Bot className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium mb-1">Create Custom AI Agents</h4>
                  <p className="text-sm text-muted-foreground">
                    Build AI bots with unique personalities and capabilities
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
                <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium mb-1">Build Your Community</h4>
                  <p className="text-sm text-muted-foreground">
                    Grow and manage your community with powerful admin tools
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
                <Mic className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium mb-1">Voice & Chat Interactions</h4>
                  <p className="text-sm text-muted-foreground">
                    Enable voice calls and natural conversations with your bot
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWelcomeDialog(false)}
              className="w-full sm:w-auto"
            >
              I'll explore first
            </Button>
            <Button
              onClick={() => {
                setShowWelcomeDialog(false);
                setShowCreateBotWorkflow(true);
              }}
              className="gradient-primary w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create My First Bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Bot Workflow Dialog */}
      <CreateBotWorkflow 
        open={showCreateBotWorkflow}
        onOpenChange={setShowCreateBotWorkflow}
      />

      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <img src={vibeLogo} alt="Vibe AI" className="w-10 h-10 object-contain rounded-lg" />
              <h1 className="text-xl font-semibold">Vibe AI</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowCreateBotWorkflow(true)}
                className="gradient-primary"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">New Bot</span>
              </Button>
              <Button
                onClick={() => navigate('/explore')}
                variant="outline"
                className="hover:bg-primary/10"
              >
                <Compass className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Explore</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* User info section */}
        {user?.email && (
          <div className="mb-4 sm:mb-6">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
          </div>
        )}

        {communities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto rounded-full gradient-primary flex items-center justify-center mb-6 shadow-glow">
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Welcome to Vibe AI! 🎉</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Create your first community and become the admin. You'll be able to customize everything and invite others to join!
            </p>
            <CreateCommunityDialog 
              onCommunityCreated={() => fetchCommunities(user?.id)}
              trigger={
                <Button size="lg" className="gradient-primary hover:shadow-glow transition-all duration-300">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Your First Community
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Admin Communities Section */}
            {communities.filter(c => c.role === 'admin').length > 0 && (
              <div className="mb-12">
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Crown className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Your Communities</h2>
                    <Badge variant="secondary" className="text-xs">
                      {communities.filter(c => c.role === 'admin').length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Communities you manage and have full control over
                  </p>
                </div>
                {isMobile ? (
                  <div className="grid grid-cols-2 gap-3">
                    {communities.filter(c => c.role === 'admin').map((community) => (
                      <CommunityAppTile
                        key={community.id}
                        id={community.id}
                        name={community.name}
                        agentName={community.agent_name}
                        coverImageUrl={community.cover_image_url}
                        agentAvatarUrl={community.agent_avatar_url}
                        isFavorited={community.is_favorited}
                        onToggleFavorite={handleToggleFavorite}
                        onClick={() => navigate(`/community/${community.id}`)}
                      />
                    ))}
                    {/* Add new bot tile */}
                    <div
                      onClick={() => setShowCreateBotWorkflow(true)}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/50 cursor-pointer transition-all duration-200 active:scale-95 min-h-[120px]"
                    >
                      <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mb-2">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">New Bot</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {communities.filter(c => c.role === 'admin').map((community) => (
                      <Card
                        key={community.id}
                        className="group cursor-pointer hover:shadow-glow transition-all duration-300 border-border/50 hover:border-primary/50"
                        onClick={() => navigate(`/community/${community.id}`)}
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-16 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                              {community.cover_image_url && community.cover_image_url.trim() !== '' ? (
                                <img 
                                  src={community.cover_image_url} 
                                  alt={community.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      const icon = document.createElement('div');
                                      icon.className = 'w-6 h-6 text-primary flex items-center justify-center';
                                      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                      parent.appendChild(icon);
                                    }
                                  }}
                                />
                              ) : community.agent_avatar_url && community.agent_avatar_url.trim() !== '' ? (
                                <img 
                                  src={community.agent_avatar_url} 
                                  alt={community.agent_name || community.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      const icon = document.createElement('div');
                                      icon.className = 'w-6 h-6 text-primary flex items-center justify-center';
                                      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/></svg>';
                                      parent.appendChild(icon);
                                    }
                                  }}
                                />
                              ) : (
                                <Bot className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                                  {community.name}
                                </CardTitle>
                                <button
                                  onClick={(e) => handleToggleFavorite(e, community.id)}
                                  className="p-1 hover:bg-muted rounded-md transition-colors"
                                >
                                  <Heart 
                                    className={`w-4 h-4 transition-colors ${
                                      community.is_favorited 
                                        ? 'fill-red-500 text-red-500' 
                                        : 'text-muted-foreground hover:text-red-500'
                                    }`}
                                  />
                                </button>
                              </div>
                              {community.agent_name && (
                                <p className="text-sm text-muted-foreground truncate">
                                  Agent: {community.agent_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent>
                          <CardDescription className="line-clamp-2">
                            {community.description || "No description available"}
                          </CardDescription>
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {community.privacy_level}
                              </Badge>
                              <Badge variant="default" className="flex items-center space-x-1 text-xs">
                                <Crown className="w-3 h-3" />
                                <span>Admin</span>
                              </Badge>
                              {community.elevenlabs_agent_id && (
                                <Badge 
                                  variant="secondary" 
                                  className={`flex items-center space-x-1 text-xs cursor-pointer transition-all ${
                                    activeVoiceCall === community.id
                                      ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/30'
                                      : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
                                  }`}
                                  onClick={(e) => 
                                    activeVoiceCall === community.id 
                                      ? endVoiceCall(e)
                                      : startVoiceCall(e, community.id, community.elevenlabs_agent_id!)
                                  }
                                >
                                  {activeVoiceCall === community.id ? (
                                    <>
                                      <PhoneOff className="w-3 h-3" />
                                      <span>End Call</span>
                                    </>
                                  ) : (
                                    <>
                                      <Phone className="w-3 h-3" />
                                      <span>Call</span>
                                    </>
                                  )}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Click to manage →
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <CreateCommunityDialog asCard onCommunityCreated={() => fetchCommunities(user?.id)} />
                  </div>
                )}
              </div>
            )}

            {/* Member Communities Section */}
            {communities.filter(c => c.role !== 'admin').length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Joined Communities</h2>
                    <Badge variant="secondary" className="text-xs">
                      {communities.filter(c => c.role !== 'admin').length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Communities you're a member of (view-only access)
                  </p>
                </div>
                {isMobile ? (
                  <div className="grid grid-cols-2 gap-3">
                    {communities.filter(c => c.role !== 'admin').map((community) => (
                      <CommunityAppTile
                        key={community.id}
                        id={community.id}
                        name={community.name}
                        agentName={community.agent_name}
                        coverImageUrl={community.cover_image_url}
                        agentAvatarUrl={community.agent_avatar_url}
                        isFavorited={community.is_favorited}
                        onToggleFavorite={handleToggleFavorite}
                        onClick={() => navigate(`/community/${community.id}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {communities.filter(c => c.role !== 'admin').map((community) => (
                      <Card 
                        key={community.id}
                        className="group cursor-pointer hover:shadow-glow transition-all duration-300 border-border/50 hover:border-primary/50"
                        onClick={() => navigate(`/community/${community.id}`)}
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-16 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                              {community.cover_image_url ? (
                                <img 
                                  src={community.cover_image_url} 
                                  alt={community.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : community.agent_avatar_url ? (
                                <img 
                                  src={community.agent_avatar_url} 
                                  alt={community.agent_name || community.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Bot className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                                  {community.name}
                                </CardTitle>
                                <button
                                  onClick={(e) => handleToggleFavorite(e, community.id)}
                                  className="p-1 hover:bg-muted rounded-md transition-colors"
                                >
                                  <Heart 
                                    className={`w-4 h-4 transition-colors ${
                                      community.is_favorited 
                                        ? 'fill-red-500 text-red-500' 
                                        : 'text-muted-foreground hover:text-red-500'
                                    }`}
                                  />
                                </button>
                              </div>
                              {community.agent_name && (
                                <p className="text-sm text-muted-foreground truncate">
                                  Agent: {community.agent_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent>
                          <CardDescription className="line-clamp-2">
                            {community.description || "No description available"}
                          </CardDescription>
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {community.privacy_level}
                              </Badge>
                              <Badge variant={getRoleBadgeVariant(community.role)} className="flex items-center space-x-1 text-xs">
                                {getRoleIcon(community.role)}
                                <span className="capitalize">{community.role}</span>
                              </Badge>
                              {community.elevenlabs_agent_id && (
                                <Badge 
                                  variant="secondary" 
                                  className={`flex items-center space-x-1 text-xs cursor-pointer transition-all ${
                                    activeVoiceCall === community.id
                                      ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/30'
                                      : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
                                  }`}
                                  onClick={(e) => 
                                    activeVoiceCall === community.id 
                                      ? endVoiceCall(e)
                                      : startVoiceCall(e, community.id, community.elevenlabs_agent_id!)
                                  }
                                >
                                  {activeVoiceCall === community.id ? (
                                    <>
                                      <PhoneOff className="w-3 h-3" />
                                      <span>End Call</span>
                                    </>
                                  ) : (
                                    <>
                                      <Phone className="w-3 h-3" />
                                      <span>Call</span>
                                    </>
                                  )}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Click to view →
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <CreateCommunityDialog asCard onCommunityCreated={() => fetchCommunities(user?.id)} />
                  </div>
                )}
              </div>
            )}

            {/* Active Communities Section */}
            {activeCommunities.length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">Active Communities</h2>
                    <Badge variant="secondary" className="text-xs">
                      {activeCommunities.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Most recently active communities you can explore
                  </p>
                </div>
                {isMobile ? (
                  <div className="grid grid-cols-2 gap-3">
                    {activeCommunities.map((community) => (
                      <CommunityAppTile
                        key={community.id}
                        id={community.id}
                        name={community.name}
                        agentName={community.agent_name}
                        coverImageUrl={community.cover_image_url}
                        agentAvatarUrl={community.agent_avatar_url}
                        isFavorited={community.is_favorited}
                        onToggleFavorite={handleToggleFavorite}
                        onClick={() => navigate(`/explore`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeCommunities.map((community) => (
                      <Card
                        key={community.id}
                        className="group cursor-pointer hover:shadow-glow transition-all duration-300 border-border/50 hover:border-primary/50"
                        onClick={() => navigate(`/explore`)}
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <div className="w-16 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                              {community.cover_image_url ? (
                                <img 
                                  src={community.cover_image_url} 
                                  alt={community.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : community.agent_avatar_url ? (
                                <img 
                                  src={community.agent_avatar_url} 
                                  alt={community.agent_name || community.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Bot className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                                {community.name}
                              </CardTitle>
                              {community.agent_name && (
                                <p className="text-sm text-muted-foreground truncate">
                                  Agent: {community.agent_name}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent>
                          <CardDescription className="line-clamp-2">
                            {community.description || "No description available"}
                          </CardDescription>
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {community.privacy_level}
                              </Badge>
                              <Badge variant="secondary" className="flex items-center space-x-1 text-xs">
                                <Activity className="w-3 h-3" />
                                <span>Active</span>
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Explore →
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sign out button at bottom */}
            <div className="flex justify-center pt-6 border-t border-border/30">
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Communities;