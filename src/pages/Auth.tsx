import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Bot, Zap, MessageSquare, BarChart3, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import vibeHero from '@/assets/vibe-hero.png';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/communities');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        toast({
          title: "Welcome back!",
          description: "Successfully signed in.",
        });
        navigate('/communities');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/communities`
          }
        });
        if (error) throw error;
        
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Starry background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(250,60%,15%)] via-[hsl(220,13%,9%)] to-[hsl(220,13%,9%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(8,85%,68%,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(195,100%,65%,0.08),transparent_40%)]" />
      
      <div className="w-full max-w-6xl relative z-10 grid md:grid-cols-2 gap-12 items-center">
        {/* Left side - Branding & Value Prop */}
        <div className="space-y-6 text-center md:text-left">
          <div className="inline-block mb-6">
            <img 
              src={vibeHero} 
              alt="Vibe AI" 
              className="w-48 h-48 object-contain drop-shadow-[0_0_40px_rgba(255,120,130,0.3)]"
            />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[hsl(8,85%,68%)] via-[hsl(280,65%,68%)] to-[hsl(195,100%,65%)] bg-clip-text text-transparent leading-tight">
              Build Intelligent Telegram Communities
            </h1>
            <p className="text-lg text-foreground/70">
              No code required. AI agents that learn, remember, and improve daily.
            </p>
          </div>

          <div className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(8,85%,68%)]/20 to-[hsl(195,100%,65%)]/20 flex items-center justify-center flex-shrink-0 border border-[hsl(8,85%,68%)]/30">
                <Zap className="w-5 h-5 text-[hsl(8,85%,68%)]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Setup in Minutes</h3>
                <p className="text-sm text-muted-foreground">No technical skills needed. Configure your AI agent and go live instantly.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(8,85%,68%)]/20 to-[hsl(195,100%,65%)]/20 flex items-center justify-center flex-shrink-0 border border-[hsl(195,100%,65%)]/30">
                <Brain className="w-5 h-5 text-[hsl(195,100%,65%)]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Memory-Powered Intelligence</h3>
                <p className="text-sm text-muted-foreground">Your bot remembers context and learns from every interaction.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(8,85%,68%)]/20 to-[hsl(195,100%,65%)]/20 flex items-center justify-center flex-shrink-0 border border-[hsl(280,65%,68%)]/30">
                <BarChart3 className="w-5 h-5 text-[hsl(280,65%,68%)]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Full Transparency</h3>
                <p className="text-sm text-muted-foreground">Track every conversation, monitor health, and analyze performance.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <Card className="shadow-elevated border-border/30 bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'Sign in to manage your communities' : 'Create your account in seconds'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-input border-border/50 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-input border-border/50 focus:border-primary"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full gradient-primary hover:shadow-glow transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => setIsLogin(!isLogin)}
                className="text-muted-foreground hover:text-foreground"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;