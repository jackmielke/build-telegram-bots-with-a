import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Search, MessageSquare, Bell, Clock, User } from 'lucide-react';

interface TelegramChatSession {
  id: string;
  telegram_chat_id: number;
  telegram_user_id: number | null;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  is_active: boolean;
  proactive_outreach_enabled: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface TelegramUsersManagementProps {
  communityId: string;
  isAdmin: boolean;
}

const TelegramUsersManagement = ({ communityId, isAdmin }: TelegramUsersManagementProps) => {
  const [sessions, setSessions] = useState<TelegramChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<TelegramChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, [communityId]);

  useEffect(() => {
    filterSessions();
  }, [sessions, searchQuery]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_chat_sessions')
        .select('*')
        .eq('community_id', communityId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching telegram sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load telegram users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterSessions = () => {
    let filtered = [...sessions];

    if (searchQuery) {
      filtered = filtered.filter(session =>
        session.telegram_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.telegram_first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.telegram_last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.telegram_chat_id.toString().includes(searchQuery)
      );
    }

    setFilteredSessions(filtered);
  };

  const toggleProactiveOutreach = async (sessionId: string, currentValue: boolean) => {
    if (!isAdmin) return;

    setUpdating(sessionId);
    try {
      const { error } = await supabase
        .from('telegram_chat_sessions')
        .update({ proactive_outreach_enabled: !currentValue })
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? { ...s, proactive_outreach_enabled: !currentValue }
            : s
        )
      );

      toast({
        title: "Updated",
        description: `Proactive outreach ${!currentValue ? 'enabled' : 'disabled'} for this user`
      });
    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        title: "Error",
        description: "Failed to update proactive outreach setting",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const toggleAllProactiveOutreach = async (enable: boolean) => {
    if (!isAdmin) return;

    setUpdating('all');
    try {
      const { error } = await supabase
        .from('telegram_chat_sessions')
        .update({ proactive_outreach_enabled: enable })
        .eq('community_id', communityId)
        .eq('is_active', true);

      if (error) throw error;

      await fetchSessions();

      toast({
        title: "Updated All",
        description: `Proactive outreach ${enable ? 'enabled' : 'disabled'} for all active users`
      });
    } catch (error) {
      console.error('Error updating all sessions:', error);
      toast({
        title: "Error",
        description: "Failed to update proactive outreach for all users",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const getUserDisplayName = (session: TelegramChatSession) => {
    if (session.telegram_first_name || session.telegram_last_name) {
      return `${session.telegram_first_name || ''} ${session.telegram_last_name || ''}`.trim();
    }
    if (session.telegram_username) {
      return `@${session.telegram_username}`;
    }
    return `User ${session.telegram_chat_id}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
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

  const activeCount = sessions.filter(s => s.is_active).length;
  const enabledCount = sessions.filter(s => s.proactive_outreach_enabled && s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Outreach Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{enabledCount}</div>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {sessions.reduce((sum, s) => sum + (s.message_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {isAdmin && (
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Bulk Actions
            </CardTitle>
            <CardDescription>
              Enable or disable proactive outreach for all active users
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={() => toggleAllProactiveOutreach(true)}
              disabled={updating === 'all'}
              variant="default"
            >
              Enable All
            </Button>
            <Button
              onClick={() => toggleAllProactiveOutreach(false)}
              disabled={updating === 'all'}
              variant="outline"
            >
              Disable All
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card className="gradient-card border-border/50">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, name, or chat ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Telegram Users
          </CardTitle>
          <CardDescription>
            {filteredSessions.length} user{filteredSessions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                <p>Loading users...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => (
                  <Card key={session.id} className="border-border/30">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-base truncate">
                              {getUserDisplayName(session)}
                            </h3>
                            {!session.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {session.telegram_username && (
                              <span>@{session.telegram_username}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {session.message_count || 0} messages
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(session.last_message_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Daily Messages
                            </div>
                            <Badge variant={session.proactive_outreach_enabled ? "default" : "outline"}>
                              {session.proactive_outreach_enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          {isAdmin && session.is_active && (
                            <Switch
                              checked={session.proactive_outreach_enabled}
                              onCheckedChange={() =>
                                toggleProactiveOutreach(session.id, session.proactive_outreach_enabled)
                              }
                              disabled={updating === session.id}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramUsersManagement;
