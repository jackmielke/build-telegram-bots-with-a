import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, MessageSquare, BarChart3, Brain, Play, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import vibeLogo from '@/assets/vibe-logo.png';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  icon: string;
  estimated_timeline: string;
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
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

    // Fetch roadmap items
    const fetchRoadmap = async () => {
      const { data } = await supabase
        .from('product_roadmap')
        .select('*')
        .in('status', ['completed', 'in_progress'])
        .order('order_index')
        .limit(6);
      
      if (data) {
        setRoadmapItems(data);
      }
    };
    fetchRoadmap();
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
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      {/* Hero Section with Auth */}
      <div className="w-full max-w-5xl relative z-10 mx-auto p-4 py-12">
        <div className="grid md:grid-cols-2 gap-8 items-center mb-20">
        {/* Left side - Branding & Value Prop */}
        <div className="space-y-6 text-center md:text-left">
          <div className="inline-block">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-4 p-3">
              <img src={vibeLogo} alt="Vibe AI" className="w-full h-full object-contain rounded-lg" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm font-semibold text-primary mb-2">VIBE AI</div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Build Intelligent Telegram Bots & Communities
            </h1>
            <p className="text-xl text-muted-foreground">
              No code required. AI agents that learn, remember, and improve daily.
            </p>
          </div>

          <Button
            onClick={() => window.open('https://www.loom.com/share/39454b410c664fb2a185c766dadbbe38?sid=822920ef-b54e-4909-861c-0b8675e7aeba', '_blank')}
            variant="outline"
            size="lg"
            className="hover:bg-primary/10 hover:border-primary"
          >
            <Play className="w-4 h-4 mr-2" />
            Watch Demo
          </Button>

          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Setup in Minutes</h3>
                <p className="text-sm text-muted-foreground">No technical skills needed. Configure your AI agent and go live instantly.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Memory-Powered Intelligence</h3>
                <p className="text-sm text-muted-foreground">Your bot remembers context and learns from every interaction.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Full Transparency</h3>
                <p className="text-sm text-muted-foreground">Track every conversation, monitor health, and analyze performance.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <Card className="shadow-elevated border-border/50">
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
                {isLogin && (
                  <div className="text-right">
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => navigate('/forgot-password', { state: { email } })}
                      className="text-sm text-primary hover:text-primary-glow p-0 h-auto"
                    >
                      Forgot password?
                    </Button>
                  </div>
                )}
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

        {/* Product Roadmap Section */}
        <div className="max-w-7xl mx-auto pb-20 relative z-10">
          <div className="text-center mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              Product Roadmap
            </div>
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Building the Future
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See what we're building right now and what's coming next
            </p>
          </div>

          {/* Featured Roadmap Items */}
          {roadmapItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {roadmapItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="p-6 hover:shadow-xl transition-all border-2 bg-card/50 backdrop-blur-sm"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      {item.status === 'completed' ? (
                        <Badge variant="outline" className="gap-1 text-green-600 dark:text-green-400 border-green-500/20 bg-green-500/10">
                          <CheckCircle2 className="h-3 w-3" />
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10">
                          <Zap className="h-3 w-3" />
                          Building
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold leading-tight">{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* View Full Roadmap CTA */}
          <div className="text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/roadmap')}
              className="group hover:bg-primary/10 hover:border-primary"
            >
              View Full Roadmap
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;