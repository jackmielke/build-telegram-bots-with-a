import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, Bot, Users, Calendar, Filter } from 'lucide-react';
import ConversationViewer from './ConversationViewer';

interface Conversation {
  conversation_id: string;
  chat_type: string;
  topic_name: string | null;
  message_count: number;
  participant_count: number;
  started_at: string;
  last_message_at: string;
  community_id: string;
  display_name?: string;
}

interface ChatHistoryDashboardProps {
  communityId: string;
  isAdmin: boolean;
}

const ChatHistoryDashboard = ({ communityId, isAdmin }: ChatHistoryDashboardProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatTypeFilter, setChatTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchConversations();
  }, [communityId]);

  useEffect(() => {
    filterConversations();
  }, [conversations, searchQuery, chatTypeFilter]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('community_id', communityId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      
      // Enrich conversations with display names from messages
      const enrichedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          // Get the first message to extract metadata
          const { data: firstMessage } = await supabase
            .from('messages')
            .select('metadata, sent_by, sender_id, users(name, telegram_username)')
            .eq('conversation_id', conv.conversation_id)
            .eq('community_id', communityId)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          let displayName = conv.topic_name || 'Untitled Conversation';

          if (firstMessage) {
            const metadata = firstMessage.metadata as any;
            
            // For Telegram chats, extract chat title or user name
            if (conv.chat_type === 'telegram_bot') {
              if (metadata?.chat_type_detail === 'private') {
                // For private chats, use the user's name
                const userName = metadata?.telegram_first_name || 
                                metadata?.telegram_username || 
                                firstMessage.sent_by || 
                                'Unknown User';
                displayName = `DM: ${userName}`;
              } else if (metadata?.chat_type_detail === 'group' || metadata?.chat_type_detail === 'supergroup') {
                // For group chats, extract title from conversation_id or metadata
                const chatId = conv.conversation_id.replace('telegram_', '');
                displayName = `Group Chat ${chatId}`;
                
                // Try to get the actual group name from messages
                const { data: groupMessages } = await supabase
                  .from('messages')
                  .select('metadata')
                  .eq('conversation_id', conv.conversation_id)
                  .limit(1);
                
                if (groupMessages?.[0]?.metadata) {
                  const groupMetadata = groupMessages[0].metadata as any;
                  // The group name might be in various places in metadata
                  if (groupMetadata?.telegram_chat_title) {
                    displayName = groupMetadata.telegram_chat_title;
                  }
                }
              }
            } else if (firstMessage.users?.name) {
              // For other chat types with linked users
              displayName = firstMessage.users.name;
            } else if (firstMessage.sent_by && firstMessage.sent_by !== 'ai') {
              displayName = firstMessage.sent_by;
            }
          }

          return {
            ...conv,
            display_name: displayName
          };
        })
      );
      
      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterConversations = () => {
    let filtered = [...conversations];

    // Filter by chat type
    if (chatTypeFilter !== 'all') {
      filtered = filtered.filter(conv => conv.chat_type === chatTypeFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(conv => 
        conv.topic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.conversation_id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredConversations(filtered);
  };

  const getChatTypeIcon = (chatType: string) => {
    switch (chatType) {
      case 'ai':
        return <Bot className="w-4 h-4" />;
      case 'telegram_bot':
        return <MessageSquare className="w-4 h-4" />;
      case 'group':
      case 'supergroup':
        return <Users className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getChatTypeLabel = (chatType: string) => {
    switch (chatType) {
      case 'ai':
        return 'AI Chat';
      case 'telegram_bot':
        return 'Telegram Bot';
      case 'group':
        return 'Group Chat';
      case 'supergroup':
        return 'Supergroup';
      case 'community':
        return 'Community';
      default:
        return chatType;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (selectedConversation) {
    return (
      <ConversationViewer
        conversationId={selectedConversation}
        communityId={communityId}
        onBack={() => setSelectedConversation(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Total Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{conversations.length}</div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              AI Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {conversations.filter(c => c.chat_type === 'ai' || c.chat_type === 'telegram_bot').length}
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Group Chats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {conversations.filter(c => c.chat_type === 'group' || c.chat_type === 'supergroup').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Filters & Search
          </CardTitle>
          <CardDescription>
            Find conversations by type, date, or search by content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={chatTypeFilter} onValueChange={setChatTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ai">AI Chat</SelectItem>
                <SelectItem value="telegram_bot">Telegram Bot</SelectItem>
                <SelectItem value="group">Group Chat</SelectItem>
                <SelectItem value="supergroup">Supergroup</SelectItem>
                <SelectItem value="community">Community</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conversation List */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Conversations
          </CardTitle>
          <CardDescription>
            {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No conversations found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConversations.map((conversation) => (
                  <Button
                    key={conversation.conversation_id}
                    variant="ghost"
                    className="w-full h-auto p-4 justify-start hover:bg-primary/10 border border-border/30"
                    onClick={() => setSelectedConversation(conversation.conversation_id)}
                  >
                    <div className="flex items-start gap-4 w-full text-left">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        {getChatTypeIcon(conversation.chat_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-semibold truncate">
                            {conversation.display_name || conversation.topic_name || 'Untitled Conversation'}
                          </h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {getChatTypeLabel(conversation.chat_type)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {conversation.message_count} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {conversation.participant_count} participants
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(conversation.last_message_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatHistoryDashboard;
