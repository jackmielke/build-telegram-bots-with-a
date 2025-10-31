import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Bot, User, Calendar, DollarSign, BarChart3, Download, Eye, Pencil, UserPlus, Bell, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AIContextViewer } from './AIContextViewer';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  sent_by: string | null;
  chat_type: string;
  created_at: string;
  metadata: any;
  message_type: string;
  topic_name?: string;
  users?: {
    name: string;
    avatar_url: string;
  };
}

interface ConversationViewerProps {
  conversationId: string;
  communityId: string;
  onBack: () => void;
}

const ConversationViewer = ({ conversationId, communityId, onBack }: ConversationViewerProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationStats, setConversationStats] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingThreadName, setEditingThreadName] = useState(false);
  const [newThreadName, setNewThreadName] = useState('');
  const [communityMemberIds, setCommunityMemberIds] = useState<Set<string>>(new Set());
  const [chatSession, setChatSession] = useState<any>(null);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [bioDialogOpen, setBioDialogOpen] = useState(false);
  const [generatedBio, setGeneratedBio] = useState('');
  const [editingBio, setEditingBio] = useState('');
  const [generatingBio, setGeneratingBio] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportProgress, setBulkImportProgress] = useState<{ current: number; total: number; errors: string[] }>({ current: 0, total: 0, errors: [] });
  const MESSAGES_PER_PAGE = 50;
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversation();
    fetchConversationStats();
    fetchCommunityMembers();
    fetchChatSession();
    
    // Set up real-time subscription for new messages in this conversation
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => [payload.new as Message, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, page]);

  const fetchConversation = async () => {
    try {
      const from = page * MESSAGES_PER_PAGE;
      const to = from + MESSAGES_PER_PAGE - 1;
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          users:sender_id (
            name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setHasMore(data && data.length === MESSAGES_PER_PAGE);
      setMessages(prev => page === 0 ? (data || []) : [...prev, ...(data || [])]);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationStats = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('community_id', communityId)
        .eq('metadata->>conversation_id', conversationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setConversationStats(data);
    } catch (error) {
      console.error('Error fetching conversation stats:', error);
    }
  };

  const fetchCommunityMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id', communityId);

      if (error) throw error;
      
      const memberIds = new Set(data?.map(m => m.user_id) || []);
      setCommunityMemberIds(memberIds);
    } catch (error) {
      console.error('Error fetching community members:', error);
    }
  };

  const fetchChatSession = async () => {
    try {
      // Extract telegram_chat_id from first message metadata
      const { data: firstMessage } = await supabase
        .from('messages')
        .select('metadata')
        .eq('conversation_id', conversationId)
        .eq('community_id', communityId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const metadata = firstMessage?.metadata as any;
      if (!metadata?.telegram_chat_id) {
        return; // Not a Telegram conversation
      }

      const telegramChatId = metadata.telegram_chat_id;

      const { data, error } = await supabase
        .from('telegram_chat_sessions')
        .select('*')
        .eq('telegram_chat_id', telegramChatId)
        .eq('community_id', communityId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setChatSession(data);
    } catch (error) {
      console.error('Error fetching chat session:', error);
    }
  };

  const toggleProactiveOutreach = async () => {
    if (!chatSession) return;

    try {
      const newValue = !chatSession.proactive_outreach_enabled;
      const { error } = await supabase
        .from('telegram_chat_sessions')
        .update({ proactive_outreach_enabled: newValue })
        .eq('id', chatSession.id);

      if (error) throw error;

      setChatSession({ ...chatSession, proactive_outreach_enabled: newValue });
      toast({
        title: "Success",
        description: `Proactive outreach ${newValue ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      console.error('Error toggling proactive outreach:', error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive"
      });
    }
  };

  const sendTestOutreach = async () => {
    if (!chatSession) return;

    setSendingOutreach(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-proactive-outreach', {
        body: {
          chatSessionId: chatSession.id,
          triggerType: 'manual'
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test outreach message sent!"
      });

      // Refresh chat session to update last_outreach_at
      fetchChatSession();
    } catch (error) {
      console.error('Error sending test outreach:', error);
      toast({
        title: "Error",
        description: "Failed to send test outreach",
        variant: "destructive"
      });
    } finally {
      setSendingOutreach(false);
    }
  };

  const exportConversation = () => {
    const conversationText = messages.map(msg => {
      const sender = msg.sent_by === 'ai' ? 'AI Assistant' : (msg.users?.name || 'User');
      const timestamp = new Date(msg.created_at).toLocaleString();
      return `[${timestamp}] ${sender}:\n${msg.content}\n`;
    }).join('\n');

    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Conversation exported successfully"
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const viewPrompt = (messageId: string) => {
    setSelectedMessageId(messageId);
    setPromptDialogOpen(true);
  };

  const updateThreadName = async () => {
    if (!newThreadName.trim()) {
      toast({
        title: "Error",
        description: "Thread name cannot be empty",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ topic_name: newThreadName })
        .eq('conversation_id', conversationId)
        .eq('community_id', communityId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Thread name updated"
      });

      setEditingThreadName(false);
      setNewThreadName('');
      fetchConversation();
    } catch (error) {
      console.error('Error updating thread name:', error);
      toast({
        title: "Error",
        description: "Failed to update thread name",
        variant: "destructive"
      });
    }
  };

  const generateUser = async (message: Message) => {
    try {
      console.log('generateUser called with message:', message);
      
      if (!message.metadata?.telegram_user_id && !message.metadata?.from?.id) {
        toast({
          title: "Missing Data",
          description: "No Telegram user ID found in message metadata",
          variant: "destructive"
        });
        return;
      }

      // Call edge function to provision user
      const { data, error } = await supabase.functions.invoke('provision-telegram-user', {
        body: {
          message,
          communityId,
        },
      });

      if (error) {
        console.error('Error provisioning user:', error);
        toast({
          title: "Error",
          description: "Failed to generate user account",
          variant: "destructive",
        });
        return;
      }

      const name = data.user?.name || 'Telegram User';
      toast({
        title: "Success",
        description: `Created account for ${name}`,
      });

      // Refresh data
      fetchConversation();
      fetchCommunityMembers();
    } catch (error) {
      console.error('Error in generateUser:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate user account",
        variant: "destructive"
      });
    }
  };

  const handleGenerateIntro = async (message: Message) => {
    // Directly copy the message text to the bio editor
    setSelectedMessage(message);
    setEditingBio(message.content);
    setGeneratedBio('');
    setBioDialogOpen(true);
  };

  const handleAIEnhancement = async () => {
    if (!selectedMessage) return;
    
    try {
      setGeneratingBio(true);
      
      const { data, error } = await supabase.functions.invoke('generate-intro', {
        body: { 
          conversationId: conversationId,
          communityId: communityId,
          singleMessage: selectedMessage.content,
          userId: selectedMessage.sender_id
        }
      });

      if (error) throw error;

      if (!data?.intro) {
        throw new Error('No intro generated');
      }

      setGeneratedBio(data.intro);
      setEditingBio(data.intro);
      
      toast({
        title: "Success",
        description: "AI-enhanced bio generated",
      });
    } catch (error) {
      console.error('Error generating AI enhancement:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate AI enhancement",
        variant: "destructive"
      });
    } finally {
      setGeneratingBio(false);
    }
  };

  const handleSaveBio = async () => {
    if (!selectedMessage) {
      console.error('No selected message');
      return;
    }

    try {
      console.log('Starting bio save process for message:', selectedMessage);
      
      const telegramUserId = selectedMessage.metadata?.telegram_user_id || selectedMessage.metadata?.from?.id;
      console.log('Extracted telegram_user_id:', telegramUserId);
      
      if (!telegramUserId) {
        throw new Error('No Telegram user ID found in message metadata');
      }

      // Check if user already exists
      console.log('Checking for existing user...');
      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      
      if (existingUserError) {
        console.error('Error checking for existing user:', existingUserError);
      }
      console.log('Existing user check result:', existingUser);

      let userId: string | undefined = existingUser?.id;

      // If user doesn't exist, provision via edge function (handles membership + RLS)
      if (!userId) {
        console.log('User does not exist, provisioning new user...');
        const { data: provisionData, error: provisionError } = await supabase.functions.invoke('provision-telegram-user', {
          body: { message: selectedMessage, communityId, bio: editingBio },
        });
        
        console.log('Provision response:', { data: provisionData, error: provisionError });
        
        if (provisionError) {
          console.error('Error provisioning user:', provisionError);
          throw new Error(`Failed to provision user: ${provisionError.message ?? JSON.stringify(provisionError)}`);
        }
        
        userId = provisionData?.user?.id;
        console.log('Provisioned user ID:', userId);
        
        if (!userId) {
          throw new Error('Provisioning did not return a user id');
        }
      } else {
        console.log('User already exists with ID:', userId);
      }

      // Ensure bio is persisted for existing users via provisioning function
      if (userId) {
        console.log('Persisting bio for existing user via provisioning function...');
        const { data: bioProvisionData, error: bioProvisionError } = await supabase.functions.invoke('provision-telegram-user', {
          body: { message: selectedMessage, communityId, bio: editingBio },
        });
        console.log('Bio provision response:', { data: bioProvisionData, error: bioProvisionError });
        if (bioProvisionError) {
          console.error('Error saving bio via provisioning:', bioProvisionError);
          throw new Error(`Failed to save bio: ${bioProvisionError.message ?? JSON.stringify(bioProvisionError)}`);
        }
        const persistedBio = bioProvisionData?.user?.bio;
        if (typeof editingBio === 'string' && persistedBio !== editingBio) {
          throw new Error('Bio update did not persist to Supabase');
        }
      }

      console.log('Bio saved successfully!');
      toast({
        title: 'Success',
        description: 'Bio saved and profile created successfully',
      });

      setBioDialogOpen(false);
      setGeneratedBio('');
      setEditingBio('');
      setSelectedMessage(null);

      // Refresh data
      fetchConversation();
      fetchCommunityMembers();
    } catch (error) {
      console.error('Error saving bio - full error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save bio',
        variant: 'destructive',
      });
    }
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    setBulkImportProgress({ current: 0, total: 0, errors: [] });

    try {
      // Get all messages from intro-like users (with telegram metadata)
      const introMessages = messages.filter(msg => 
        msg.metadata?.telegram_user_id && 
        msg.sent_by !== 'ai' &&
        msg.content && 
        msg.content.length > 20
      );

      if (introMessages.length === 0) {
        toast({
          title: "No Messages Found",
          description: "No intro messages found to import",
          variant: "destructive"
        });
        setBulkImporting(false);
        return;
      }

      // Process all intro messages
      const batch = introMessages;
      
      setBulkImportProgress({ current: 0, total: batch.length, errors: [] });

      const errors: string[] = [];
      
      for (let i = 0; i < batch.length; i++) {
        const msg = batch[i];
        
        try {
          // Check if user already exists
          const telegramUserId = msg.metadata?.telegram_user_id;
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, bio')
            .eq('telegram_user_id', telegramUserId)
            .maybeSingle();

          // Skip if user already has a bio
          if (existingUser?.bio) {
            console.log(`Skipping user ${telegramUserId} - already has bio`);
            setBulkImportProgress(prev => ({ ...prev, current: i + 1 }));
            continue;
          }

          // Use message content directly as bio (no AI generation)
          const bio = msg.content;

          const { error } = await supabase.functions.invoke('provision-telegram-user', {
            body: { 
              message: msg, 
              communityId,
              bio 
            }
          });

          if (error) {
            console.error(`Error importing user ${i + 1}:`, error);
            errors.push(`Message ${i + 1}: ${error.message}`);
          }

          setBulkImportProgress(prev => ({ 
            ...prev, 
            current: i + 1,
            errors 
          }));

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error processing message ${i + 1}:`, error);
          errors.push(`Message ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      toast({
        title: "Bulk Import Complete",
        description: `Processed ${batch.length} profiles. ${errors.length} errors.`,
        variant: errors.length > 0 ? "destructive" : "default"
      });

      // Refresh data
      fetchConversation();
      fetchCommunityMembers();
    } catch (error) {
      console.error('Bulk import error:', error);
      toast({
        title: "Error",
        description: "Failed to complete bulk import",
        variant: "destructive"
      });
    } finally {
      setBulkImporting(false);
    }
  };

  const currentThreadName = messages[0]?.topic_name || 'Unnamed Thread';
  const isPlaceholderName = currentThreadName.startsWith('Thread ');

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4 bg-card rounded-lg border border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Back</span>
          </Button>
          <div className="min-w-0 flex-1">
            {editingThreadName ? (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newThreadName}
                  onChange={(e) => setNewThreadName(e.target.value)}
                  placeholder="Enter thread name"
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  autoFocus
                />
                <Button size="sm" onClick={updateThreadName}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingThreadName(false)}>Cancel</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-semibold truncate">
                    {currentThreadName}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewThreadName(currentThreadName);
                      setEditingThreadName(true);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {messages.length} messages
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {chatSession && (
            <>
              <Button
                variant={chatSession.proactive_outreach_enabled ? "default" : "outline"}
                size="sm"
                onClick={toggleProactiveOutreach}
                className="flex items-center gap-1"
                title={chatSession.proactive_outreach_enabled ? "Disable proactive outreach" : "Enable proactive outreach"}
              >
                <Bell className="w-4 h-4" />
                <span className="text-xs hidden md:inline">
                  {chatSession.proactive_outreach_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={sendTestOutreach}
                disabled={sendingOutreach}
                className="flex items-center gap-1"
                title="Send test outreach message now"
              >
                <Send className="w-4 h-4" />
                <span className="text-xs hidden md:inline">
                  {sendingOutreach ? 'Sending...' : 'Test'}
                </span>
              </Button>
            </>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleBulkImport}
            disabled={bulkImporting}
            className="hidden flex items-center gap-1"
            title="Import all profiles from this conversation (skips duplicates)"
          >
            <UserPlus className="w-4 h-4" />
            <span className="text-xs hidden md:inline">
              {bulkImporting ? `${bulkImportProgress.current}/${bulkImportProgress.total}` : 'Bulk Import'}
            </span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportConversation}
            className="flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs hidden md:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Proactive Outreach Info */}
      {chatSession?.proactive_outreach_enabled && (
        <Card className="gradient-card border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Proactive Outreach Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {chatSession.last_outreach_at 
                ? `Last message sent ${new Date(chatSession.last_outreach_at).toLocaleDateString()} at ${new Date(chatSession.last_outreach_at).toLocaleTimeString()}`
                : 'No messages sent yet'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {conversationStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Tokens Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {conversationStats.tokens_used?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Model: {conversationStats.model_used}
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(conversationStats.cost_usd || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total conversation cost
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {conversationStats.message_count || messages.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total messages exchanged
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages - Full width, no card wrapper */}
      <div className="w-full">
        <div className="mb-4">
          <h3 className="text-base md:text-lg font-semibold">Conversation Thread</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Full message history from this conversation
          </p>
        </div>
        {loading && page === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Loading messages...</div>
        ) : (
          <ScrollArea className="h-[600px] md:h-[700px]">
            <div className="space-y-3 md:space-y-4 pr-4">
              {messages.map((message) => {
              const isAI = message.sent_by === 'ai' || message.chat_type === 'ai';
              const userName = message.users?.name || 'User';
              const avatarUrl = message.users?.avatar_url;

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 md:gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  <Avatar 
                    className={`w-7 h-7 md:w-8 md:h-8 flex-shrink-0 ${!isAI && message.sender_id ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                    onClick={() => {
                      if (!isAI && message.sender_id) {
                        navigate(`/user/${message.sender_id}`);
                      }
                    }}
                  >
                    {isAI ? (
                      <>
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                        </AvatarFallback>
                      </>
                    ) : (
                      <>
                        <AvatarImage src={avatarUrl} alt={userName} />
                        <AvatarFallback className="bg-muted">
                          <User className="w-3 h-3 md:w-4 md:h-4" />
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>

                  <div className="flex-1 min-w-0 max-w-[calc(100%-3rem)]">
                    <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                      <span className="text-xs md:text-sm font-medium">
                        {isAI ? 'AI Assistant' : userName}
                      </span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-[10px] md:text-xs h-4 md:h-5">
                        {message.message_type}
                      </Badge>
                      {isAI && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewPrompt(message.id)}
                          className="h-5 md:h-6 px-1 md:px-2"
                        >
                          <Eye className="w-3 h-3" />
                          <span className="text-[10px] md:text-xs ml-1">Prompt</span>
                        </Button>
                      )}
                      {!isAI && (message.metadata?.telegram_user_id || message.metadata?.from?.id) && (
                        <div className="flex gap-1">
                          {(!message.sender_id || (message.sender_id && !communityMemberIds.has(message.sender_id))) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateUser(message)}
                              className="h-5 md:h-6 px-1.5 md:px-2 flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span className="text-[10px] md:text-xs">{message.sender_id ? "Add to Community" : "Generate User"}</span>
                            </Button>
                          )}
                           <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateIntro(message)}
                            className="h-5 md:h-6 px-1.5 md:px-2 flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            <span className="text-[10px] md:text-xs">
                              Add to Bio
                            </span>
                          </Button>
                          {message.sender_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/user/${message.sender_id}`)}
                              className="h-5 md:h-6 px-1.5 md:px-2 flex items-center gap-1"
                            >
                              <User className="w-3 h-3" />
                              <span className="text-[10px] md:text-xs">View Profile</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      className={`rounded-lg p-2.5 md:p-3 ${
                        isAI
                          ? 'bg-primary/10 border border-primary/20'
                          : 'bg-muted border border-border'
                      }`}
                    >
                      <p className="text-xs md:text-sm whitespace-pre-wrap break-all leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
            {hasMore && messages.length >= MESSAGES_PER_PAGE && (
              <div className="pt-4 text-center pr-4">
                <Button 
                  onClick={loadMore} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  className="w-full md:w-auto"
                >
                  {loading ? 'Loading...' : 'Load Earlier Messages'}
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      {/* AI Context Viewer Dialog */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI Context Mirror</DialogTitle>
            <DialogDescription>
              Exact reconstruction of what the AI saw when generating this response
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {selectedMessageId && (
              <AIContextViewer 
                messageId={selectedMessageId}
                conversationId={conversationId}
                communityId={communityId}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Intro Generator Dialog */}
      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Bio</DialogTitle>
            <DialogDescription>
              Edit the bio or use AI to enhance it before saving to profile
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* User Profile Preview */}
            {selectedMessage && (
              <Card className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage 
                        src={selectedMessage.metadata?.telegram_photo_url} 
                        alt={selectedMessage.metadata?.telegram_first_name || 'User'} 
                      />
                      <AvatarFallback className="bg-muted">
                        <User className="w-8 h-8" />
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-2">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {[selectedMessage.metadata?.telegram_first_name, selectedMessage.metadata?.telegram_last_name]
                            .filter(Boolean)
                            .join(' ') || 'Telegram User'}
                        </h3>
                        {selectedMessage.metadata?.telegram_username && (
                          <p className="text-sm text-muted-foreground">
                            @{selectedMessage.metadata.telegram_username}
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Telegram ID:</span>
                          <p className="font-mono">{selectedMessage.metadata?.telegram_user_id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <p>Unclaimed Profile</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bio Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">User Bio</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAIEnhancement}
                  disabled={generatingBio}
                >
                  {generatingBio ? 'Generating...' : '✨ AI Enhancement'}
                </Button>
              </div>
              <Textarea
                value={editingBio}
                onChange={(e) => setEditingBio(e.target.value)}
                rows={6}
                placeholder="Bio will appear here..."
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Edit the bio directly or use AI enhancement to generate a professional version
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBioDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBio}>
              Confirm & Save Bio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ConversationViewer;
