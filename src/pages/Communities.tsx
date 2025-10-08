import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Crown, Shield, Plus, LogOut, Heart, Sparkles, Compass, Bot, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CreateCommunityDialog from '@/components/CreateCommunityDialog';
import { CreateBotWorkflow } from '@/components/dashboard/CreateBotWorkflow';
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
}

const Communities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showCreateBotWorkflow, setShowCreateBotWorkflow] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
            privacy_level
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                onClick={() => window.open('https://www.loom.com/share/39454b410c664fb2a185c766dadbbe38?sid=822920ef-b54e-4909-861c-0b8675e7aeba', '_blank')}
                variant="outline"
                className="hover:bg-primary/10"
              >
                <Play className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Watch Demo</span>
              </Button>
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
                            <Badge variant="default" className="flex items-center space-x-1 text-xs">
                              <Crown className="w-3 h-3" />
                              <span>Admin</span>
                            </Badge>
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