import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bot, Brain, MessageSquare, Upload, Loader2, Sparkles, Zap, Settings } from 'lucide-react';
import WorkflowBuilder from './WorkflowBuilder';
import BotHealthIndicator from './BotHealthIndicator';

interface Community {
  id: string;
  name: string;
  agent_name: string | null;
  agent_instructions: string | null;
  agent_intro_message: string | null;
  agent_avatar_url: string | null;
  agent_model: string | null;
  agent_max_tokens: number | null;
  agent_temperature: number | null;
  agent_suggested_messages: string[] | null;
  telegram_bot_token: string | null;
  telegram_bot_url: string | null;
}

interface UnifiedAgentSetupProps {
  community: Community;
  isAdmin: boolean;
  onUpdate: (community: Community) => void;
}

const UnifiedAgentSetup = ({ community, isAdmin, onUpdate }: UnifiedAgentSetupProps) => {
  const [formData, setFormData] = useState({
    agent_name: community.agent_name || '',
    agent_instructions: community.agent_instructions || '',
    agent_intro_message: community.agent_intro_message || '',
    agent_avatar_url: community.agent_avatar_url || '',
    agent_model: community.agent_model || 'gpt-5-mini-2025-08-07',
    agent_max_tokens: community.agent_max_tokens || 2000,
    agent_temperature: community.agent_temperature || 0.7,
    agent_suggested_messages: community.agent_suggested_messages || []
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const availableModels = [
    { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Latest)', description: 'Most capable flagship model' },
    { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini', description: 'Faster, cost-efficient' },
    { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano', description: 'Fastest, cheapest' },
    { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', description: 'Reliable flagship GPT-4' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and affordable' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Powerful with vision' }
  ];

  const handleSave = async () => {
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
        title: "Agent Updated",
        description: "All agent settings have been saved successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update agent configuration",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isAdmin) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${community.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setFormData({ ...formData, agent_avatar_url: publicUrl });
      toast({
        title: "Avatar Uploaded",
        description: "Agent avatar has been uploaded successfully."
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const addSuggestedMessage = () => {
    if (formData.agent_suggested_messages.length < 6) {
      setFormData({
        ...formData,
        agent_suggested_messages: [...formData.agent_suggested_messages, '']
      });
    }
  };

  const updateSuggestedMessage = (index: number, value: string) => {
    const newMessages = [...formData.agent_suggested_messages];
    newMessages[index] = value;
    setFormData({ ...formData, agent_suggested_messages: newMessages });
  };

  const removeSuggestedMessage = (index: number) => {
    const newMessages = formData.agent_suggested_messages.filter((_, i) => i !== index);
    setFormData({ ...formData, agent_suggested_messages: newMessages });
  };

  return (
    <div className="space-y-6">
      {/* 1. INSTRUCTIONS */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-primary" />
            <span>Instructions</span>
          </CardTitle>
          <CardDescription>
            Define the system prompt that determines how your AI agent thinks, behaves, and responds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            id="agent_instructions"
            value={formData.agent_instructions}
            onChange={(e) => setFormData({ ...formData, agent_instructions: e.target.value })}
            placeholder="You are a helpful community assistant. Your role is to..."
            disabled={!isAdmin}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Define how your AI agent thinks, behaves, and responds to users via the system prompt
          </p>
        </CardContent>
      </Card>

      {/* 2. WORKFLOWS */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-primary" />
            <span>Workflows</span>
          </CardTitle>
          <CardDescription>
            Configure automated workflows and agent tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowBuilder
            community={community}
            isAdmin={isAdmin}
            onUpdate={(updated) => onUpdate({ ...community, ...updated })}
          />
        </CardContent>
      </Card>

      {/* 3. HEALTH & STATUS */}
      {community.telegram_bot_token && (
        <BotHealthIndicator communityId={community.id} />
      )}

      {/* 4. LLM SETTINGS */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>LLM & Model Settings</span>
          </CardTitle>
          <CardDescription>
            Configure the AI model and behavior parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="agent_model">AI Model</Label>
            <Select
              value={formData.agent_model}
              onValueChange={(value) => setFormData({ ...formData, agent_model: value })}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div>
                      <div className="font-medium">{model.label}</div>
                      <div className="text-xs text-muted-foreground">{model.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Badge variant="outline">{formData.agent_max_tokens}</Badge>
              </div>
              <Slider
                id="max_tokens"
                min={500}
                max={8000}
                step={100}
                value={[formData.agent_max_tokens]}
                onValueChange={(value) => setFormData({ ...formData, agent_max_tokens: value[0] })}
                disabled={!isAdmin}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum tokens per AI response (higher = longer responses, higher cost)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <Badge variant="outline">{formData.agent_temperature}</Badge>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.1}
                value={[formData.agent_temperature]}
                onValueChange={(value) => setFormData({ ...formData, agent_temperature: value[0] })}
                disabled={!isAdmin}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Controls randomness: 0 = focused, 1 = creative
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. IDENTITY & APPEARANCE */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-primary" />
            <span>Identity & Appearance</span>
          </CardTitle>
          <CardDescription>
            Configure your AI agent's name, avatar, and first impression
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          {/* Avatar */}
          <div className="space-y-2">
            <Label>Agent Avatar</Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {formData.agent_avatar_url ? (
                <img
                  src={formData.agent_avatar_url}
                  alt="Agent avatar"
                  className="w-20 h-20 rounded-lg object-cover border-2 border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <Bot className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={!isAdmin}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isAdmin || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF (max 2MB)
                </p>
              </div>
            </div>
          </div>

          {/* Agent Name */}
          <div className="space-y-2">
            <Label htmlFor="agent_name">Agent Name</Label>
            <Input
              id="agent_name"
              value={formData.agent_name}
              onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
              placeholder="Enter agent name"
              disabled={!isAdmin}
            />
          </div>

          {/* Intro Message */}
          <div className="space-y-2">
            <Label htmlFor="agent_intro_message">Intro Message</Label>
            <Textarea
              id="agent_intro_message"
              value={formData.agent_intro_message}
              onChange={(e) => setFormData({ ...formData, agent_intro_message: e.target.value })}
              placeholder="Hi! I'm your AI assistant. How can I help you today?"
              disabled={!isAdmin}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Sent when users type /start — perfect for welcoming users
            </p>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3 pt-4 border-t border-border/40">
            <div>
              <Label className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Quick Actions
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Suggested messages that users can quickly send
              </p>
            </div>
            {formData.agent_suggested_messages.map((message, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  value={message}
                  onChange={(e) => updateSuggestedMessage(index, e.target.value)}
                  placeholder="Enter suggested message"
                  disabled={!isAdmin}
                  className="flex-1"
                />
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeSuggestedMessage(index)}
                    className="sm:w-auto"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {isAdmin && formData.agent_suggested_messages.length < 6 && (
              <Button variant="outline" onClick={addSuggestedMessage} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Add Suggested Message
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SAVE BUTTON */}
      {isAdmin && (
        <div className="flex justify-end sticky bottom-4 z-10">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-primary hover:shadow-glow w-full sm:w-auto"
          >
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default UnifiedAgentSetup;
