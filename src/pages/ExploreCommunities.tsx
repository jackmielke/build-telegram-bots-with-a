import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Search, Lock, Globe, ArrowLeft, UserPlus, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import vibeLogo from '@/assets/vibe-logo.png';

interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  privacy_level: string;
  member_count?: number;
  is_member: boolean;
  has_pending_request: boolean;
}

const ExploreCommunities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
      
      // Get internal user ID
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single();
      
      if (userData) {
        setUserId(userData.id);
        await fetchCommunities(userData.id);
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCommunities(communities);
    } else {
      const filtered = communities.filter(community =>
        community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        community.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCommunities(filtered);
    }
  }, [searchQuery, communities]);

  const fetchCommunities = async (internalUserId: string) => {
    try {
      // Get all communities
      const { data: allCommunities, error: communitiesError } = await supabase
        .from('communities')
        .select('id, name, description, cover_image_url, privacy_level')
        .order('name');

      if (communitiesError) throw communitiesError;

      // Get communities user is already a member of
      const { data: memberData } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', internalUserId);

      const memberCommunityIds = new Set(memberData?.map(m => m.community_id) || []);

      // Get pending join requests
      const { data: requestData } = await supabase
        .from('community_join_requests')
        .select('community_id')
        .eq('user_id', internalUserId)
        .eq('status', 'pending');

      const pendingRequestIds = new Set(requestData?.map(r => r.community_id) || []);

      // Get member counts for each community
      const { data: memberCounts } = await supabase
        .from('community_members')
        .select('community_id');

      const countMap = new Map<string, number>();
      memberCounts?.forEach(m => {
        countMap.set(m.community_id, (countMap.get(m.community_id) || 0) + 1);
      });

      const formattedCommunities = allCommunities?.map(community => ({
        ...community,
        is_member: memberCommunityIds.has(community.id),
        has_pending_request: pendingRequestIds.has(community.id),
        member_count: countMap.get(community.id) || 0
      })) || [];

      setCommunities(formattedCommunities);
      setFilteredCommunities(formattedCommunities);
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

  const handleJoinPublic = async (communityId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: userId,
          role: 'member'
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You've joined the community",
      });

      // Refresh communities
      await fetchCommunities(userId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join community",
        variant: "destructive"
      });
    }
  };

  const handleRequestToJoin = async (communityId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('community_join_requests')
        .insert({
          community_id: communityId,
          user_id: userId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Request sent!",
        description: "The community admin will review your request",
      });

      // Refresh communities
      await fetchCommunities(userId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send request",
        variant: "destructive"
      });
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/communities')}
              >
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <img src={vibeLogo} alt="Vibe AI" className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-lg" />
              <h1 className="text-lg sm:text-xl font-semibold">Vibe AI</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {filteredCommunities.length} {filteredCommunities.length === 1 ? 'community' : 'communities'} found
          </p>
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommunities.map((community) => (
            <Card
              key={community.id}
              className="group hover:shadow-glow transition-all duration-300 border-border/50 hover:border-primary/50"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    {community.cover_image_url ? (
                      <img 
                        src={community.cover_image_url} 
                        alt={community.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">
                      {community.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs flex items-center space-x-1">
                        {community.privacy_level === 'public' ? (
                          <Globe className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        <span>{community.privacy_level}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {community.member_count} {community.member_count === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <CardDescription className="line-clamp-3">
                  {community.description || "No description available"}
                </CardDescription>
                
                {community.is_member ? (
                  <Button
                    className="w-full"
                    onClick={() => navigate(`/community/${community.id}`)}
                  >
                    View Community
                  </Button>
                ) : community.has_pending_request ? (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Request Pending
                  </Button>
                ) : community.privacy_level === 'public' ? (
                  <Button
                    className="w-full gradient-primary hover:shadow-glow"
                    onClick={() => handleJoinPublic(community.id)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join Community
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleRequestToJoin(community.id)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Request to Join
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCommunities.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No communities found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'No communities available yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreCommunities;
