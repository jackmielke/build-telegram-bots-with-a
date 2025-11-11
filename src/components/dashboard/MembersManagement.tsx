import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Crown, Shield, UserMinus, UserPlus, MessageSquare, MessageSquareOff } from 'lucide-react';

interface Member {
  id: string;
  role: string;
  joined_at: string;
  users: {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_claimed: boolean | null;
    telegram_user_id: number | null;
  };
  telegram_session?: {
    is_active: boolean;
    proactive_outreach_enabled: boolean;
  } | null;
}

interface MembersManagementProps {
  communityId: string;
  isAdmin: boolean;
}

const MembersManagement = ({ communityId, isAdmin }: MembersManagementProps) => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
  }, [communityId]);

  const fetchMembers = async () => {
    try {
      // Primary: fast, secure server-side join via Edge Function
      const { data, error } = await supabase.functions.invoke('list-community-members', {
        body: { communityId },
      });

      if (!error && data && Array.isArray(data.members)) {
        setMembers(data.members);
        return;
      }

      // Fallback: client-side 2-step fetch to avoid PostgREST join timeouts
      console.warn('Edge function unavailable, falling back to client-side merge:', error?.message);

      const { data: membersRows, error: membersErr } = await supabase
        .from('community_members')
        .select('id, role, joined_at, user_id')
        .eq('community_id', communityId)
        .order('joined_at', { ascending: true });

      if (membersErr) throw membersErr;

      const userIds = Array.from(new Set((membersRows || []).map(m => m.user_id))).filter(Boolean) as string[];

      let usersMap = new Map<string, any>();
      if (userIds.length) {
        const chunkSize = 100;
        const chunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += chunkSize) {
          chunks.push(userIds.slice(i, i + chunkSize));
        }

        let usersRowsAll: any[] = [];
        for (const idsChunk of chunks) {
          const { data: usersRows, error: usersErr } = await supabase
            .from('users')
            .select('id, name, email, avatar_url, is_claimed, telegram_user_id')
            .in('id', idsChunk);
          if (usersErr) throw usersErr;
          usersRowsAll = usersRowsAll.concat(usersRows || []);
        }
        usersMap = new Map((usersRowsAll || []).map(u => [u.id, u]));
      }

      const { data: sessionsRows, error: sessionsErr } = await supabase
        .from('telegram_chat_sessions')
        .select('telegram_user_id, is_active, proactive_outreach_enabled')
        .eq('community_id', communityId);
      if (sessionsErr) {
        console.error('Error fetching telegram sessions (fallback):', sessionsErr);
      }
      const sessionsMap = new Map(
        (sessionsRows || []).map(session => [
          session.telegram_user_id,
          { is_active: session.is_active, proactive_outreach_enabled: session.proactive_outreach_enabled },
        ])
      );

      const enrichedMembers = (membersRows || []).map((m: any) => {
        const u = usersMap.get(m.user_id) || null;
        const telegram_session = u?.telegram_user_id ? sessionsMap.get(u.telegram_user_id) || null : null;
        return { id: m.id, role: m.role, joined_at: m.joined_at, users: u, telegram_session };
      });

      setMembers(enrichedMembers);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    if (!isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('community_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      
      toast({
        title: "Role Updated",
        description: "Member role has been updated successfully.",
      });
      
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive"
      });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('id', memberId)
        .eq('community_id', communityId);

      if (error) throw error;
      
      toast({
        title: "Member Removed",
        description: "Member has been removed from the community.",
      });
      
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive"
      });
    }
  };

  const backfillCommunityMembers = async () => {
    if (!isAdmin) return;
    
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-community-members', {
        body: { communityId },
      });

      if (error) throw error;
      
      const summary = data?.summary;
      toast({
        title: "Backfill Complete!",
        description: `Added ${summary?.added || 0} members. Skipped ${summary?.skipped || 0}. Errors: ${summary?.errors || 0}`,
      });
      
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to backfill members",
        variant: "destructive"
      });
    } finally {
      setBackfilling(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />;
      case 'moderator':
        return <Shield className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Community Members</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={backfillCommunityMembers}
                disabled={backfilling}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {backfilling ? 'Syncing...' : 'Sync Telegram Users'}
              </Button>
            )}
            <Badge variant="secondary">{members.length} members</Badge>
          </div>
        </CardTitle>
        <CardDescription>
          View and manage community member roles. Use Sync to add existing Telegram users to this community.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingMembers ? (
          <div className="text-center py-6">Loading members...</div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div 
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
              >
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/user/${member.users.id}`);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                    {member.users.avatar_url ? (
                      <img 
                        src={member.users.avatar_url} 
                        alt={member.users.name || 'User'}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          console.log('Failed to load avatar:', member.users.avatar_url);
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
                        }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Users className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.users.name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.users.email}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center space-x-1">
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </Badge>
                      {member.users.is_claimed === false && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                          Unclaimed
                        </Badge>
                      )}
                      {member.telegram_session?.is_active && member.telegram_session?.proactive_outreach_enabled ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Can Broadcast
                        </Badge>
                      ) : member.users.telegram_user_id ? (
                        <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 flex items-center gap-1">
                          <MessageSquareOff className="w-3 h-3" />
                          No DM Access
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {isAdmin && member.role !== 'admin' && (
                    <div className="flex items-center space-x-1">
                      <Select 
                        value={member.role} 
                        onValueChange={(newRole) => updateMemberRole(member.id, newRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to do this? This can't be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMember(member.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MembersManagement;
