import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';

const ClaimProfile = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'claimed' | 'error'>('checking');
  const [profileData, setProfileData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkVerificationCode();
  }, [code]);

  const checkVerificationCode = async () => {
    try {
      setLoading(true);
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();
        setCurrentUser(userData);
      }

      // Check if verification code is valid
      const { data: claimRequest, error: claimError } = await supabase
        .from('profile_claim_requests')
        .select('*, user_profile_id')
        .eq('verification_code', code)
        .eq('is_verified', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (claimError || !claimRequest) {
        console.error('Claim request error:', claimError);
        setStatus('invalid');
        setLoading(false);
        return;
      }

      // Get the profile to be claimed
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', claimRequest.user_profile_id)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        setStatus('error');
        setLoading(false);
        return;
      }

      if (profile.is_claimed) {
        setStatus('claimed');
        setLoading(false);
        return;
      }

      setProfileData(profile);
      setStatus('valid');
    } catch (error) {
      console.error('Error checking verification code:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimProfile = async () => {
    if (!currentUser) {
      // Redirect to auth with return path
      navigate(`/auth?returnTo=/claim/${code}`);
      return;
    }

    setClaiming(true);
    try {
      // Update the user profile to link it to the auth account
      const { error: updateError } = await supabase
        .from('users')
        .update({
          auth_user_id: currentUser.auth_user_id,
          is_claimed: true
        })
        .eq('id', profileData.id);

      if (updateError) throw updateError;

      // Mark claim request as verified
      const { error: verifyError } = await supabase
        .from('profile_claim_requests')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('verification_code', code);

      if (verifyError) throw verifyError;

      toast({
        title: "Profile claimed successfully!",
        description: "You can now edit your profile",
      });

      // Redirect to user profile page
      navigate(`/user/${profileData.id}`);
    } catch (error: any) {
      console.error('Error claiming profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to claim profile",
        variant: "destructive"
      });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 px-6 max-w-2xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">Verifying your claim link...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 px-6 max-w-2xl mx-auto pb-12">
        {status === 'valid' && profileData && (
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Claim Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Profile to claim:</p>
                  <div className="flex items-center gap-3">
                    {profileData.avatar_url && (
                      <img 
                        src={profileData.avatar_url} 
                        alt={profileData.name} 
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{profileData.name}</p>
                      {profileData.username && (
                        <p className="text-sm text-muted-foreground">@{profileData.username}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm">
                    By claiming this profile, you'll be able to:
                  </p>
                  <ul className="text-sm space-y-2 text-muted-foreground ml-4">
                    <li>• Edit your bio and profile information</li>
                    <li>• Upload a custom profile photo</li>
                    <li>• Manage your community memberships</li>
                    <li>• Access all features of the platform</li>
                  </ul>
                </div>
              </div>

              <Button 
                onClick={handleClaimProfile}
                disabled={claiming}
                size="lg"
                className="w-full"
              >
                {claiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {currentUser ? 'Claim Profile' : 'Sign In to Claim'}
              </Button>

              {!currentUser && (
                <p className="text-xs text-center text-muted-foreground">
                  You'll be redirected to sign in or create an account
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {status === 'invalid' && (
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-6 h-6" />
                Invalid or Expired Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This claim link is either invalid or has expired. Please request a new link by sending <code className="bg-muted px-2 py-1 rounded">/claim</code> to the Telegram bot.
              </p>
              <Button onClick={() => navigate('/communities')} variant="outline">
                Go to Communities
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'claimed' && (
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Profile Already Claimed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This profile has already been claimed. If this is your profile, you can log in to access it.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => navigate('/auth')} variant="outline">
                  Sign In
                </Button>
                <Button onClick={() => navigate('/communities')}>
                  Go to Communities
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'error' && (
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-6 h-6" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An error occurred while processing your claim request. Please try again or contact support.
              </p>
              <Button onClick={() => navigate('/communities')} variant="outline">
                Go to Communities
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClaimProfile;
