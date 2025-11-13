import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ClaimProfileMagicLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setErrorMessage('No token provided');
      return;
    }

    validateAndClaim(token);
  }, [searchParams]);

  const validateAndClaim = async (token: string) => {
    try {
      // Call the validate-magic-link edge function
      const { data, error } = await supabase.functions.invoke('validate-magic-link', {
        body: { token }
      });

      if (error) {
        console.error('Validation error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Failed to validate token');
        toast({
          title: "Error",
          description: "Failed to claim profile. The link may have expired.",
          variant: "destructive"
        });
        return;
      }

      if (!data.success) {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to claim profile');
        toast({
          title: "Error",
          description: data.error || 'Failed to claim profile',
          variant: "destructive"
        });
        return;
      }

      // Use the auth token to verify and establish session
      if (data.auth_token && data.token_hash && data.user.email) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: data.user.email,
          token: data.auth_token,
          type: 'magiclink',
          options: {
            redirectTo: 'https://bot-builder.app/profile'
          }
        });

        if (verifyError) {
          console.error('Verify error:', verifyError);
          setStatus('error');
          setErrorMessage('Failed to authenticate');
          return;
        }

        setStatus('success');
        toast({
          title: "Success! 🎉",
          description: "Your profile has been claimed successfully!",
        });

        // Redirect to profile page after 1 second
        setTimeout(() => {
          navigate('/profile');
        }, 1000);
      } else {
        setStatus('error');
        setErrorMessage('Invalid authentication data received');
      }

    } catch (error) {
      console.error('Claim error:', error);
      setStatus('error');
      setErrorMessage('An unexpected error occurred');
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {status === 'validating' && (
          <div className="space-y-4">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary" />
            <h1 className="text-2xl font-bold">Claiming Your Profile...</h1>
            <p className="text-muted-foreground">Please wait while we verify your link</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-6xl">🎉</div>
            <h1 className="text-3xl font-bold">Welcome!</h1>
            <p className="text-lg text-muted-foreground">
              Your profile has been claimed successfully!
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting you to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-6xl">❌</div>
            <h1 className="text-3xl font-bold">Oops!</h1>
            <p className="text-lg text-muted-foreground">
              {errorMessage || 'Something went wrong'}
            </p>
            <p className="text-sm text-muted-foreground">
              The link may have expired or already been used.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
