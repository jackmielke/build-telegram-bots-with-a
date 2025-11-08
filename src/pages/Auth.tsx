import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, MessageSquare, BarChart3, Brain, Play, Sparkles, ArrowRight, CheckCircle2, ThumbsUp, ThumbsDown } from 'lucide-react';
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
  upvotes: number;
  downvotes: number;
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 'upvote' | 'downvote'>>({});
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
      const { data, error } = await supabase
        .from('product_roadmap')
        .select('*')
        .in('status', ['completed', 'in_progress', 'planned']);
      
      if (error) {
        console.error('Error fetching roadmap:', error);
        return;
      }
      
      if (data) {
        console.log('Fetched roadmap items:', data.length);
        // Sort: non-completed items first (by votes), then completed items (by votes)
        const sorted = data.sort((a, b) => {
          const aCompleted = a.status === 'completed' ? 1 : 0;
          const bCompleted = b.status === 'completed' ? 1 : 0;
          
          // First sort by completion status
          if (aCompleted !== bCompleted) {
            return aCompleted - bCompleted;
          }
          
          // Then sort by net votes (upvotes - downvotes)
          const aVotes = (a.upvotes || 0) - (a.downvotes || 0);
          const bVotes = (b.upvotes || 0) - (b.downvotes || 0);
          return bVotes - aVotes;
        });
        
        setRoadmapItems(sorted);
      }
    };
    fetchRoadmap();

    // Load user votes from localStorage
    const savedVotes = localStorage.getItem('roadmap_votes');
    if (savedVotes) {
      setUserVotes(JSON.parse(savedVotes));
    }
  }, [navigate]);

  const handleVote = async (itemId: string, voteType: 'upvote' | 'downvote') => {
    const existingVote = userVotes[itemId];
    
    // If clicking the same vote type, remove the vote (unvote)
    if (existingVote === voteType) {
      // Optimistic update - decrease the count
      setRoadmapItems(items => {
        const updated = items.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              upvotes: voteType === 'upvote' ? Math.max(0, (item.upvotes || 0) - 1) : item.upvotes,
              downvotes: voteType === 'downvote' ? Math.max(0, (item.downvotes || 0) - 1) : item.downvotes,
            };
          }
          return item;
        });
        
        return updated.sort((a, b) => {
          const aCompleted = a.status === 'completed' ? 1 : 0;
          const bCompleted = b.status === 'completed' ? 1 : 0;
          
          if (aCompleted !== bCompleted) {
            return aCompleted - bCompleted;
          }
          
          const aVotes = (a.upvotes || 0) - (a.downvotes || 0);
          const bVotes = (b.upvotes || 0) - (b.downvotes || 0);
          return bVotes - aVotes;
        });
      });

      // Remove vote from localStorage
      const newVotes = { ...userVotes };
      delete newVotes[itemId];
      setUserVotes(newVotes);
      localStorage.setItem('roadmap_votes', JSON.stringify(newVotes));

      toast({
        title: "Vote removed",
        description: "Your vote has been removed.",
      });

      // Sync with server
      try {
        await fetch('https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/vote-roadmap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roadmapItemId: itemId, voteType, action: 'remove' }),
        });
      } catch (error) {
        console.error('Failed to sync unvote with server:', error);
      }
      return;
    }
    
    // If clicking different vote type, show error
    if (existingVote && existingVote !== voteType) {
      toast({
        title: "Already voted",
        description: "Remove your current vote first to change it.",
        variant: "destructive",
      });
      return;
    }

    // Optimistic update - update UI immediately
    setRoadmapItems(items => {
      const updated = items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            upvotes: voteType === 'upvote' ? (item.upvotes || 0) + 1 : item.upvotes,
            downvotes: voteType === 'downvote' ? (item.downvotes || 0) + 1 : item.downvotes,
          };
        }
        return item;
      });
      
      // Re-sort after optimistic update
      return updated.sort((a, b) => {
        const aCompleted = a.status === 'completed' ? 1 : 0;
        const bCompleted = b.status === 'completed' ? 1 : 0;
        
        if (aCompleted !== bCompleted) {
          return aCompleted - bCompleted;
        }
        
        const aVotes = (a.upvotes || 0) - (a.downvotes || 0);
        const bVotes = (b.upvotes || 0) - (b.downvotes || 0);
        return bVotes - aVotes;
      });
    });

    // Save vote to localStorage immediately
    const newVotes = { ...userVotes, [itemId]: voteType };
    setUserVotes(newVotes);
    localStorage.setItem('roadmap_votes', JSON.stringify(newVotes));

    // Show success toast immediately
    toast({
      title: "Vote recorded!",
      description: `Thanks for your ${voteType === 'upvote' ? 'support' : 'feedback'}!`,
    });

    // Sync with server in background
    try {
      const response = await fetch('https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/vote-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roadmapItemId: itemId, voteType }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync vote');
      }

      const result = await response.json();
      
      // Update with actual server values
      setRoadmapItems(items =>
        items.map(item =>
          item.id === itemId
            ? { ...item, upvotes: result.upvotes, downvotes: result.downvotes }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to sync vote with server:', error);
      // Don't show error to user since optimistic update already happened
    }
  };

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

        {/* Separator */}
        <div className="w-full max-w-4xl mx-auto my-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center">
              <div className="bg-background px-6 py-2">
                <Sparkles className="h-6 w-6 text-primary/60" />
              </div>
            </div>
          </div>
        </div>

        {/* Product Roadmap Section */}
        <div className="max-w-7xl mx-auto pb-20 relative z-10 space-y-20">
          {/* Live Features Section */}
          {roadmapItems.filter(item => item.status === 'completed').length > 0 && (
            <div>
              <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-green-500 to-green-600 dark:from-green-400 dark:via-green-300 dark:to-green-400 bg-clip-text text-transparent">
                  Live Features
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Features that are live and ready to use right now
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {roadmapItems
                  .filter(item => item.status === 'completed')
                  .map((item) => (
                    <Card 
                      key={item.id} 
                      className="p-6 hover:shadow-xl transition-all border-2 bg-card/50 backdrop-blur-sm h-full"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <Badge variant="outline" className="gap-1 text-green-600 dark:text-green-400 border-green-500/20 bg-green-500/10">
                            <CheckCircle2 className="h-3 w-3" />
                            Live
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-lg font-bold leading-tight">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVote(item.id, 'upvote')}
                            className={`gap-1 transition-all ${userVotes[item.id] === 'upvote' ? 'bg-primary/10 border-primary' : ''}`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            {item.upvotes || 0}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVote(item.id, 'downvote')}
                            className={`gap-1 transition-all ${userVotes[item.id] === 'downvote' ? 'bg-destructive/10 border-destructive' : ''}`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                            {item.downvotes || 0}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* What We're Building Section */}
          {roadmapItems.filter(item => item.status !== 'completed').length > 0 && (
            <div>
              <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
                  What We're Building
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Features in progress and coming soon
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {roadmapItems
                  .filter(item => item.status !== 'completed')
                  .map((item) => (
                    <Card 
                      key={item.id} 
                      className="p-6 hover:shadow-xl transition-all border-2 bg-card/50 backdrop-blur-sm h-full"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          {item.status === 'in_progress' ? (
                            <Badge variant="outline" className="gap-1 text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10">
                              <Zap className="h-3 w-3" />
                              Building
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-purple-600 dark:text-purple-400 border-purple-500/20 bg-purple-500/10">
                              <Sparkles className="h-3 w-3" />
                              Planned
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-lg font-bold leading-tight">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVote(item.id, 'upvote')}
                            className={`gap-1 transition-all ${userVotes[item.id] === 'upvote' ? 'bg-primary/10 border-primary' : ''}`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            {item.upvotes || 0}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVote(item.id, 'downvote')}
                            className={`gap-1 transition-all ${userVotes[item.id] === 'downvote' ? 'bg-destructive/10 border-destructive' : ''}`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                            {item.downvotes || 0}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;