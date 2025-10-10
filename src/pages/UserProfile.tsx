import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, User, Calendar, Tag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  username: string | null;
  is_claimed: boolean | null;
  created_at: string;
  interests_skills: string[] | null;
  headline: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
}

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load user profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-6 max-w-4xl mx-auto">
          <div className="text-center">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-6 max-w-4xl mx-auto">
          <div className="text-center">User not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 px-6 max-w-4xl mx-auto pb-12">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="gradient-card border-border/50">
          <CardHeader>
            <div className="flex items-start space-x-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                {profile.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.name || 'User'}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-2xl">
                    {profile.name || 'Unknown User'}
                  </CardTitle>
                  {profile.is_claimed === false && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                      Unclaimed
                    </Badge>
                  )}
                </div>
                {profile.headline && (
                  <p className="text-muted-foreground mt-1">{profile.headline}</p>
                )}
                {profile.username && (
                  <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              <div className="space-y-2">
                {profile.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{profile.email}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Bio</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* Social Links */}
            {(profile.instagram_handle || profile.twitter_handle) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Social Media</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.instagram_handle && (
                    <Badge variant="outline">
                      Instagram: @{profile.instagram_handle}
                    </Badge>
                  )}
                  {profile.twitter_handle && (
                    <Badge variant="outline">
                      Twitter: @{profile.twitter_handle}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Interests & Skills */}
            {profile.interests_skills && profile.interests_skills.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Tag className="w-5 h-5" />
                  <span>Interests & Skills</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests_skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfile;
