import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, User, Calendar, Tag, CheckCircle2, Link2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  username: string | null;
  is_claimed: boolean | null;
  auth_user_id: string | null;
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [claimingProfile, setClaimingProfile] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchCurrentUser();
  }, [userId]);

  const fetchCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();
      setCurrentUser(userData);
    }
  };

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

  const handleClaimProfile = async () => {
    if (!currentUser) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to claim a profile",
        variant: "destructive"
      });
      return;
    }

    setClaimingProfile(true);
    try {
      // Generate a unique verification code
      const verificationCode = `CLAIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      // Store the claim request
      const { data: claimRequest, error: claimError } = await supabase
        .from('profile_claim_requests')
        .insert({
          user_profile_id: userId,
          auth_user_id: currentUser.auth_user_id,
          verification_code: verificationCode
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // Get the community's telegram bot token to create deep link
      const { data: community } = await supabase
        .from('communities')
        .select('telegram_bot_url')
        .single();

      // Create Telegram deep link with verification code
      const botUsername = community?.telegram_bot_url?.split('/').pop() || 'edge_city_bot';
      const telegramLink = `https://t.me/${botUsername}?start=${verificationCode}`;

      // Open Telegram
      window.open(telegramLink, '_blank');

      toast({
        title: "Verification code sent",
        description: `Send this code to the bot: ${verificationCode}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setClaimingProfile(false);
    }
  };

  const isOwnProfile = currentUser?.id === userId;
  const canClaimProfile = !profile?.is_claimed && !isOwnProfile && currentUser;

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
                  {profile.is_claimed === true && profile.auth_user_id && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </Badge>
                  )}
                  {profile.is_claimed === false && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                      Unclaimed Profile
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
            {/* Claim Profile Button */}
            {canClaimProfile && (
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Is this you?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Claim this profile by verifying your Telegram account
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={claimingProfile}>
                          <Link2 className="w-4 h-4 mr-2" />
                          Claim This Profile
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Claim this profile</AlertDialogTitle>
                          <AlertDialogDescription>
                            You'll be redirected to Telegram to verify your account. 
                            Send the verification code to the bot to complete the claim process.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClaimProfile}>
                            Continue to Telegram
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            )}
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
