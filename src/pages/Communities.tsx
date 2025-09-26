import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Crown, Shield, Plus, LogOut, Settings } from 'lucide-react';
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

      // Fetch communities user is a member of
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

      const formattedCommunities = data?.map(member => ({
        ...member.communities,
        role: member.role
      })) || [];

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
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Settings className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">Your Communities</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User info section */}
        {user?.email && (
          <div className="mb-6 text-center">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
          </div>
        )}

        {communities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No communities yet</h3>
            <p className="text-muted-foreground mb-6">
              You're not a member of any communities. Contact an admin to get invited.
            </p>
            <Button onClick={() => window.location.reload()}>
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
                      ) : (
                        <Users className="w-6 h-6 text-primary" />
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
                        <Badge variant={getRoleBadgeVariant(community.role)} className="flex items-center space-x-1 text-xs">
                          {getRoleIcon(community.role)}
                          <span className="capitalize">{community.role}</span>
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Click to manage →
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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