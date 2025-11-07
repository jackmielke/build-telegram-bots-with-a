import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, Copy, RefreshCw, Upload, X } from 'lucide-react';
import { TokenManagement } from './TokenManagement';

interface Community {
  id: string;
  name: string;
  description: string | null;
  privacy_level: string;
  invite_code: string | null;
  cover_image_url: string | null;
  agent_avatar_url: string | null;
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
    cover_image_url: community.cover_image_url || '',
    agent_avatar_url: community.agent_avatar_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dragActiveCover, setDragActiveCover] = useState(false);
  const [dragActiveAvatar, setDragActiveAvatar] = useState(false);
  const { toast } = useToast();

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

  const uploadCoverImage = async (file: File) => {
    if (!isAdmin) return;

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cover-${community.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community-covers')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community-covers')
        .getPublicUrl(filePath);

      setFormData({ ...formData, cover_image_url: publicUrl });
      
      toast({
        title: "Image Uploaded",
        description: "Cover image uploaded successfully. Don't forget to save!",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadAvatarImage = async (file: File) => {
    if (!isAdmin) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${community.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community-covers')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community-covers')
        .getPublicUrl(filePath);

      setFormData({ ...formData, agent_avatar_url: publicUrl });
      
      toast({
        title: "Image Uploaded",
        description: "Avatar image uploaded successfully. Don't forget to save!",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 5MB",
          variant: "destructive"
        });
        return;
      }
      uploadCoverImage(file);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 5MB",
          variant: "destructive"
        });
        return;
      }
      uploadAvatarImage(file);
    }
  };

  const handleCoverDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveCover(true);
    } else if (e.type === "dragleave") {
      setDragActiveCover(false);
    }
  };

  const handleAvatarDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveAvatar(true);
    } else if (e.type === "dragleave") {
      setDragActiveAvatar(false);
    }
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveCover(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 5MB",
          variant: "destructive"
        });
        return;
      }
      uploadCoverImage(file);
    }
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveAvatar(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 5MB",
          variant: "destructive"
        });
        return;
      }
      uploadAvatarImage(file);
    }
  };

  const removeCoverImage = () => {
    setFormData({ ...formData, cover_image_url: '' });
  };

  const removeAvatarImage = () => {
    setFormData({ ...formData, agent_avatar_url: '' });
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActiveCover ? 'border-primary bg-primary/5' : 'border-border'
                } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onDragEnter={handleCoverDrag}
                onDragLeave={handleCoverDrag}
                onDragOver={handleCoverDrag}
                onDrop={handleCoverDrop}
              >
                {formData.cover_image_url ? (
                  <div className="relative">
                    <img
                      src={formData.cover_image_url}
                      alt="Cover preview"
                      className="max-h-48 mx-auto rounded-lg object-cover"
                    />
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeCoverImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      {uploadingCover ? (
                        <p>Uploading...</p>
                      ) : (
                        <>
                          <p>Drag and drop an image here, or</p>
                          <label htmlFor="cover-upload" className="text-primary hover:underline cursor-pointer">
                            browse files
                          </label>
                        </>
                      )}
                    </div>
                    <Input
                      id="cover-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverFileChange}
                      disabled={!isAdmin || uploadingCover}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Avatar Image */}
            <div className="space-y-2">
              <Label>Agent Avatar</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActiveAvatar ? 'border-primary bg-primary/5' : 'border-border'
                } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onDragEnter={handleAvatarDrag}
                onDragLeave={handleAvatarDrag}
                onDragOver={handleAvatarDrag}
                onDrop={handleAvatarDrop}
              >
                {formData.agent_avatar_url ? (
                  <div className="relative">
                    <img
                      src={formData.agent_avatar_url}
                      alt="Avatar preview"
                      className="max-h-48 mx-auto rounded-lg object-cover"
                    />
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeAvatarImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      {uploadingAvatar ? (
                        <p>Uploading...</p>
                      ) : (
                        <>
                          <p>Drag and drop an image here, or</p>
                          <label htmlFor="avatar-upload" className="text-primary hover:underline cursor-pointer">
                            browse files
                          </label>
                        </>
                      )}
                    </div>
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                      disabled={!isAdmin || uploadingAvatar}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                  </div>
                )}
              </div>
            </div>
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

      {/* Token Management */}
      {isAdmin && (
        <TokenManagement
          communityId={community.id}
          communityName={community.name}
          coverImageUrl={community.cover_image_url}
        />
      )}

    </div>
  );
};

export default CommunitySettings;