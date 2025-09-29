import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Crown, Shield, Plus, LogOut, Settings, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/80 to-accent bg-fixed bg-cover">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-white">Your Communities</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        {user?.email && (
          <div className="mb-12 space-y-8">
            {/* Welcome Card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-normal text-white mb-1">
                  Welcome back, {user.email.split('@')[0]}!
                </h2>
                <p className="text-base font-light text-white/70">
                  Ready for your next adventure?
                </p>
              </div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center border border-white/30">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Hero Section */}
            <div className="text-center space-y-4">
              <h1 className="text-5xl sm:text-6xl font-bold text-white">
                Choose Your Adventure
              </h1>
              <p className="text-lg font-light text-white/80 max-w-2xl mx-auto">
                Step into immersive worlds where every choice shapes your journey. 
                Select a community and become part of an evolving story.
              </p>
            </div>
          </div>
        )}

        {communities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-white/70" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-white">No communities yet</h3>
            <p className="text-white/70 mb-6">
              You're not a member of any communities. Contact an admin to get invited.
            </p>
            <Button onClick={() => window.location.reload()} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
              <Plus className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {communities.map((community) => (
                <Card 
                  key={community.id}
                  className="group cursor-pointer hover:shadow-glow transition-all duration-300 bg-white/10 backdrop-blur-md border-white/20 hover:border-white/40"
                  onClick={() => navigate(`/community/${community.id}`)}
                >
                 <CardHeader className="space-y-3">
                   <div className="flex items-start space-x-3">
                     <div className="w-16 h-12 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
                       {community.cover_image_url ? (
                         <img 
                           src={community.cover_image_url} 
                           alt={community.name}
                           className="w-full h-full object-cover"
                         />
                       ) : (
                         <Users className="w-6 h-6 text-white" />
                       )}
                     </div>
                     <div className="min-w-0 flex-1">
                       <div className="flex items-center justify-between">
                         <CardTitle className="text-lg text-white group-hover:text-white/80 transition-colors truncate">
                           {community.name}
                         </CardTitle>
                         <button
                           onClick={(e) => handleToggleFavorite(e, community.id)}
                           className="p-1 hover:bg-white/10 rounded-md transition-colors"
                         >
                           <Heart 
                             className={`w-4 h-4 transition-colors ${
                               community.is_favorited 
                                 ? 'fill-red-500 text-red-500' 
                                 : 'text-white/70 hover:text-red-500'
                             }`}
                           />
                         </button>
                       </div>
                       {community.agent_name && (
                         <p className="text-sm text-white/70 truncate">
                           Agent: {community.agent_name}
                         </p>
                       )}
                     </div>
                   </div>
                 </CardHeader>

                   <CardContent>
                     <CardDescription className="line-clamp-2 text-white/60">
                       {community.description || "No description available"}
                     </CardDescription>
                     
                     <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                       <div className="flex items-center space-x-2">
                         <Badge variant="outline" className="text-xs bg-white/10 border-white/30 text-white">
                           {community.privacy_level}
                         </Badge>
                         <Badge variant="outline" className="flex items-center space-x-1 text-xs bg-white/10 border-white/30 text-white">
                           {getRoleIcon(community.role)}
                           <span className="capitalize">{community.role}</span>
                         </Badge>
                       </div>
                       <div className="text-xs text-white/60">
                         Click to manage →
                       </div>
                     </div>
                   </CardContent>
                </Card>
              ))}
            </div>

            {/* Sign out button at bottom */}
            <div className="flex justify-center pt-6 border-t border-white/20">
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white/70 hover:text-white hover:bg-white/10">
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