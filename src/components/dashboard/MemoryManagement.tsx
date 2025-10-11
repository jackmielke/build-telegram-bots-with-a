import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Brain, Plus, Search, Trash2, Edit, User, Calendar, Sparkles, Loader2, UserPlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Memory {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: any;
  creator_name?: string;
}

interface MemoryManagementProps {
  communityId: string;
  isAdmin: boolean;
}

const MemoryManagement = ({ communityId, isAdmin }: MemoryManagementProps) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    tags: ''
  });
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [convertingMemory, setConvertingMemory] = useState<Memory | null>(null);
  const [profileFormData, setProfileFormData] = useState({
    name: "",
    username: "",
    bio: "",
    interests_skills: [] as string[],
    headline: ""
  });
  const [isParsingProfile, setIsParsingProfile] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMemories();
  }, [communityId]);

  const fetchMemories = async () => {
    try {
      const { data, error } = await supabase
        .from('memories')
        .select(`
          *,
          creator:users!created_by(name)
        `)
        .eq('community_id', communityId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      const memoriesWithCreator = data?.map(memory => ({
        ...memory,
        creator_name: memory.creator?.name || 'Unknown'
      })) || [];
      
      setMemories(memoriesWithCreator);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load memories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMemory = async () => {
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      if (selectedMemory) {
        // Update existing memory
        const { error } = await supabase
          .from('memories')
          .update({
            content: formData.content,
            tags: tagsArray,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedMemory.id);

        if (error) throw error;
        
        toast({
          title: "Memory Updated",
          description: "Memory has been updated successfully.",
        });
      } else {
        // Create new memory - get current user's internal ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
          
        if (userError) throw userError;
        
        const { error } = await supabase
          .from('memories')
          .insert({
            community_id: communityId,
            content: formData.content,
            tags: tagsArray,
            metadata: {},
            created_by: userData.id
          });

        if (error) throw error;
        
        toast({
          title: "Memory Created",
          description: "New memory has been added successfully.",
        });
      }

      setFormData({ content: '', tags: '' });
      setSelectedMemory(null);
      setIsEditing(false);
      fetchMemories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save memory",
        variant: "destructive"
      });
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', memoryId);

      if (error) throw error;
      
      toast({
        title: "Memory Deleted",
        description: "Memory has been removed successfully.",
      });
      
      fetchMemories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete memory",
        variant: "destructive"
      });
    }
  };

  const handleImproveWriting = async () => {
    if (!formData.content.trim()) {
      toast({
        title: "No Content",
        description: "Please enter some content first.",
        variant: "destructive"
      });
      return;
    }

    setIsImproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('improve-memory', {
        body: { content: formData.content }
      });

      if (error) throw error;

      setFormData({ ...formData, content: data.improvedContent });
      toast({
        title: "Writing Improved",
        description: "Memory has been reformatted for better clarity.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to improve writing. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsImproving(false);
    }
  };

  const openEditDialog = (memory?: Memory) => {
    if (memory) {
      setSelectedMemory(memory);
      setFormData({
        content: memory.content || '',
        tags: (memory.tags || []).join(', ')
      });
    } else {
      setSelectedMemory(null);
      setFormData({ content: '', tags: '' });
    }
    setIsEditing(true);
  };

  const handleConvertToProfile = async (memory: Memory) => {
    setConvertingMemory(memory);
    setIsConvertDialogOpen(true);
    setIsParsingProfile(true);

    try {
      const { data, error } = await supabase.functions.invoke('parse-memory-to-profile', {
        body: { content: memory.content }
      });

      if (error) throw error;

      const { profileData } = data;
      setProfileFormData({
        name: profileData.name || "",
        username: profileData.username || "",
        bio: profileData.bio || "",
        interests_skills: profileData.interests_skills || [],
        headline: profileData.headline || ""
      });

      toast({
        title: "Profile data extracted",
        description: "Review and edit the data before creating the profile"
      });
    } catch (error) {
      console.error('Error parsing profile:', error);
      toast({
        title: "Error",
        description: "Failed to parse profile data",
        variant: "destructive"
      });
    } finally {
      setIsParsingProfile(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!profileFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingProfile(true);

    try {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          name: profileFormData.name,
          username: profileFormData.username || null,
          bio: profileFormData.bio || null,
          interests_skills: profileFormData.interests_skills.length > 0 ? profileFormData.interests_skills : null,
          headline: profileFormData.headline || null,
          is_claimed: false
        }] as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Profile created for ${profileFormData.name}`
      });

      setIsConvertDialogOpen(false);
      setConvertingMemory(null);
      setProfileFormData({
        name: "",
        username: "",
        bio: "",
        interests_skills: [],
        headline: ""
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      toast({
        title: "Error",
        description: "Failed to create profile",
        variant: "destructive"
      });
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const filteredMemories = memories.filter(memory =>
    memory.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memory.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isAutoBio = (memory: Memory) => {
    return memory.metadata?.type === 'bio' && memory.metadata?.auto_generated;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-primary" />
            <span>Memory Management</span>
          </CardTitle>
          <CardDescription>
            Manage your AI agent's knowledge base and context memories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search memories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {isAdmin && (
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button onClick={() => openEditDialog()} className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Memory
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {selectedMemory ? 'Edit Memory' : 'Add New Memory'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="content">Content</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleImproveWriting}
                          disabled={isImproving || !formData.content.trim()}
                          className="h-7 text-xs"
                        >
                          {isImproving ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Improving...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" />
                              Improve Writing
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="content"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Enter memory content..."
                        rows={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="ai, community, knowledge"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveMemory}>
                        {selectedMemory ? 'Update' : 'Create'} Memory
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Memories List */}
      <div className="space-y-4">
        {filteredMemories.length === 0 ? (
          <Card className="gradient-card border-border/50">
            <CardContent className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No memories found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No memories match your search.' : 'Start building your AI agent\'s knowledge base.'}
              </p>
              {isAdmin && !searchTerm && (
                <Button onClick={() => openEditDialog()} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Memory
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredMemories.map((memory) => (
            <Card key={memory.id} className="gradient-card border-border/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>{memory.creator_name}</span>
                      </Badge>
                      {isAutoBio(memory) && (
                        <Badge variant="outline" className="flex items-center space-x-1">
                          <span>Auto Bio</span>
                        </Badge>
                      )}
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(memory.updated_at).toLocaleDateString()}</span>
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {memory.tags?.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleConvertToProfile(memory)}
                        title="Convert to Profile"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(memory)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  <ReactMarkdown>{memory.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Convert to Profile Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert Memory to Profile</DialogTitle>
          </DialogHeader>
          
          {isParsingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Parsing profile data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="profile-name">Name *</Label>
                <Input
                  id="profile-name"
                  value={profileFormData.name}
                  onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>

              <div>
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  value={profileFormData.username}
                  onChange={(e) => setProfileFormData({ ...profileFormData, username: e.target.value })}
                  placeholder="username or handle"
                />
              </div>

              <div>
                <Label htmlFor="profile-headline">Headline</Label>
                <Input
                  id="profile-headline"
                  value={profileFormData.headline}
                  onChange={(e) => setProfileFormData({ ...profileFormData, headline: e.target.value })}
                  placeholder="One-line headline"
                />
              </div>

              <div>
                <Label htmlFor="profile-bio">Bio</Label>
                <Textarea
                  id="profile-bio"
                  value={profileFormData.bio}
                  onChange={(e) => setProfileFormData({ ...profileFormData, bio: e.target.value })}
                  placeholder="Short bio"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="profile-interests">Interests & Skills</Label>
                <Input
                  id="profile-interests"
                  value={profileFormData.interests_skills.join(", ")}
                  onChange={(e) => setProfileFormData({ 
                    ...profileFormData, 
                    interests_skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="comma, separated, values"
                />
              </div>

              {convertingMemory && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Original Memory:</p>
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {convertingMemory.content}
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsConvertDialogOpen(false);
                    setConvertingMemory(null);
                  }}
                  disabled={isCreatingProfile}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProfile}
                  disabled={isCreatingProfile || !profileFormData.name.trim()}
                >
                  {isCreatingProfile ? "Creating..." : "Create Profile"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemoryManagement;