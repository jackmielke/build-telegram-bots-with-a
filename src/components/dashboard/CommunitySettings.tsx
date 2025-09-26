import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, Shield, Crown, Copy, RefreshCw, UserMinus } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  description: string | null;
  privacy_level: string;
  invite_code: string | null;
  cover_image_url: string | null;
}

interface Member {
  id: string;
  role: string;
  joined_at: string;
  users: {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

interface CommunitySettingsProps {
  community: Community;
  isAdmin: boolean;
  onUpdate: (community: Community) => void;
}

const CommunitySettings = ({ community, isAdmin, onUpdate }: CommunitySettingsProps) => {
  const [formData, setFormData] = useState({
    name: community.name,
    description: community.description || '',
    privacy_level: community.privacy_level,
    cover_image_url: community.cover_image_url || ''
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
  }, [community.id]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          users!community_members_user_id_fkey (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('community_id', community.id)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load members",
        variant: "destructive"
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSaveCommunity = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('communities')
        .update(formData)
        .eq('id', community.id);

      if (error) throw error;

      onUpdate({ ...community, ...formData });
      toast({
        title: "Community Updated",
        description: "Community settings have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update community settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const generateInviteCode = async () => {
    if (!isAdmin) return;
    
    try {
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { error } = await supabase
        .from('communities')
        .update({ invite_code: newCode })
        .eq('id', community.id);

      if (error) throw error;

      onUpdate({ ...community, invite_code: newCode });
      toast({
        title: "Invite Code Generated",
        description: "New invite code has been created.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to generate invite code",
        variant: "destructive"
      });
    }
  };

  const copyInviteCode = () => {
    if (community.invite_code) {
      navigator.clipboard.writeText(community.invite_code);
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard.",
      });
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
        .eq('id', memberId);

      if (error) throw error;
      
      toast({
        title: "Member Removed",
        description: "Member has been removed from the community.",
      });
      
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive"
      });
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
    <div className="space-y-6">
      {/* Basic Settings */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>Community Settings</span>
          </CardTitle>
          <CardDescription>
            Configure your community's basic information and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Community Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacy_level">Privacy Level</Label>
              <Select 
                value={formData.privacy_level} 
                onValueChange={(value) => setFormData({ ...formData, privacy_level: value })}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your community..."
              disabled={!isAdmin}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover_image_url">Cover Image URL</Label>
            <Input
              id="cover_image_url"
              value={formData.cover_image_url}
              onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
              placeholder="https://example.com/cover.png"
              disabled={!isAdmin}
            />
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveCommunity} 
                disabled={saving}
                className="gradient-primary hover:shadow-glow"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Management */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Invite Management</span>
          </CardTitle>
          <CardDescription>
            Manage community invitations and access codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <Label>Invite Code</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input 
                  value={community.invite_code || 'No code generated'} 
                  readOnly 
                  className="font-mono"
                />
                <Button variant="outline" size="sm" onClick={copyInviteCode}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {isAdmin && (
              <Button variant="outline" onClick={generateInviteCode}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate New
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Community Members</span>
            </div>
            <Badge variant="secondary">{members.length} members</Badge>
          </CardTitle>
          <CardDescription>
            View and manage community member roles
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
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      {member.users.avatar_url ? (
                        <img 
                          src={member.users.avatar_url} 
                          alt={member.users.name || 'User'}
                          className="w-8 h-8 rounded-full"
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
                      <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center space-x-1">
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </Badge>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunitySettings;