import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Bot, Brain, MessageSquare, Settings, Sparkles, Upload, ChevronDown, Zap, Send, Loader2 } from 'lucide-react';
import WorkflowBuilder from './WorkflowBuilder';
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
interface AgentConfigurationProps {
  community: Community;
  isAdmin: boolean;
  onUpdate: (community: Community) => void;
}
const AgentConfiguration = ({
  community,
  isAdmin,
  onUpdate
}: AgentConfigurationProps) => {
  const [formData, setFormData] = useState({
    agent_name: community.agent_name || '',
    agent_instructions: community.agent_instructions || '',
    agent_intro_message: community.agent_intro_message || '',
    agent_avatar_url: community.agent_avatar_url || '',
    agent_model: community.agent_model || 'google/gemini-2.5-flash',
    agent_max_tokens: community.agent_max_tokens || 2000,
    agent_temperature: community.agent_temperature || 0.7,
    agent_suggested_messages: community.agent_suggested_messages || []
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    toast
  } = useToast();
  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const {
        error
      } = await supabase.from('communities').update(formData).eq('id', community.id);
      if (error) throw error;
      onUpdate({
        ...community,
        ...formData
      });
      toast({
        title: "Agent Updated",
        description: "Agent configuration has been saved successfully."
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
  const availableModels = [{
    value: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Best for vision + reasoning'
  }, {
    value: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Balanced, vision-capable'
  }, {
    value: 'google/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: 'Fastest, cheapest'
  }, {
    value: 'openai/gpt-5',
    label: 'GPT-5',
    description: 'Most capable flagship model'
  }, {
    value: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'Faster, cost-efficient'
  }, {
    value: 'openai/gpt-5-nano',
    label: 'GPT-5 Nano',
    description: 'Fastest, cheapest'
  }];
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
    setFormData({
      ...formData,
      agent_suggested_messages: newMessages
    });
  };
  const removeSuggestedMessage = (index: number) => {
    const newMessages = formData.agent_suggested_messages.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      agent_suggested_messages: newMessages
    });
  };
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isAdmin) return;
    try {
      setUploading(true);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${community.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      const {
        error: uploadError,
        data
      } = await supabase.storage.from('avatars').upload(filePath, file, {
        upsert: true
      });
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setFormData({
        ...formData,
        agent_avatar_url: publicUrl
      });
      toast({
        title: "Avatar Uploaded",
        description: "Agent avatar has been uploaded successfully."
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };
  return <Tabs defaultValue="setup" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="setup" className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          <span>Agent Setup</span>
        </TabsTrigger>
        <TabsTrigger value="advanced" className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          <span>Advanced Settings</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="setup" className="space-y-4 md:space-y-6">
        {/* System Instructions - TOP PRIORITY */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-primary" />
              <span>Instructions</span>
            </CardTitle>
            <CardDescription>
              Define how your AI agent thinks, behaves, and responds to users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea id="agent_instructions" value={formData.agent_instructions} onChange={e => setFormData({
            ...formData,
            agent_instructions: e.target.value
          })} placeholder="You are a helpful community assistant. Your role is to..." disabled={!isAdmin} rows={8} className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Define how your AI agent thinks, behaves, and responds to users via the system prompt</p>
          </CardContent>
        </Card>

        {/* Identity & Behavior */}
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
            {/* Avatar Upload */}
            <div className="space-y-2">
              <Label>Agent Avatar</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {formData.agent_avatar_url ? <img src={formData.agent_avatar_url} alt="Agent avatar" className="w-20 h-20 rounded-lg object-cover border-2 border-border" /> : <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Bot className="w-8 h-8 text-muted-foreground" />
                  </div>}
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={!isAdmin} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!isAdmin || uploading}>
                    {uploading ? <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </> : <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </>}
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
              <Input id="agent_name" value={formData.agent_name} onChange={e => setFormData({
              ...formData,
              agent_name: e.target.value
            })} placeholder="Enter agent name" disabled={!isAdmin} />
            </div>

            {/* Intro Message */}
            <div className="space-y-2">
              <Label htmlFor="agent_intro_message">Intro Message</Label>
              <Textarea id="agent_intro_message" value={formData.agent_intro_message} onChange={e => setFormData({
              ...formData,
              agent_intro_message: e.target.value
            })} placeholder="Hi! I'm your AI assistant. How can I help you today?" disabled={!isAdmin} rows={3} />
              <p className="text-xs text-muted-foreground">
                Sent when users type /start — perfect for welcoming users and explaining what you can help with
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>
              Suggested messages that users can quickly send to the agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.agent_suggested_messages.map((message, index) => <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input value={message} onChange={e => updateSuggestedMessage(index, e.target.value)} placeholder="Enter suggested message" disabled={!isAdmin} className="flex-1" />
                {isAdmin && <Button variant="outline" size="sm" onClick={() => removeSuggestedMessage(index)} className="sm:w-auto">
                    Remove
                  </Button>}
              </div>)}
            
            {isAdmin && formData.agent_suggested_messages.length < 6 && <Button variant="outline" onClick={addSuggestedMessage} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Add Suggested Message
              </Button>}
          </CardContent>
        </Card>

        {/* Workflows Section */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-primary" />
              <span>Workflows</span>
            </CardTitle>
            <CardDescription>
              Connect and configure automated workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowBuilder community={community} isAdmin={isAdmin} onUpdate={updated => onUpdate({
            ...community,
            ...updated
          })} />
          </CardContent>
        </Card>

        {/* Save Button */}
        {isAdmin && <div className="flex justify-end sticky bottom-4 z-10">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary hover:shadow-glow w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>}
      </TabsContent>

      <TabsContent value="advanced" className="space-y-4 md:space-y-6">
        {/* AI Model Configuration */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-primary" />
              <span>AI Model Settings</span>
            </CardTitle>
            <CardDescription>
              Configure the AI model and behavior parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Provider - Now using Lovable AI Gateway */}
            <div className="space-y-2">
              <Label htmlFor="ai_provider" className="flex items-center gap-2">
                AI Provider
              </Label>
              <Select value="lovable" disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">
                    <div>
                      <div className="font-medium">Lovable AI Gateway</div>
                      <div className="text-xs text-muted-foreground">Access to GPT + Gemini models</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Using Lovable AI Gateway for all AI models.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent_model">AI Model</Label>
              <Select value={formData.agent_model} onValueChange={value => setFormData({
              ...formData,
              agent_model: value
            })} disabled={!isAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => <SelectItem key={model.value} value={model.value}>
                      <div>
                        <div className="font-medium">{model.label}</div>
                        <div className="text-xs text-muted-foreground">{model.description}</div>
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max_tokens">Max Tokens</Label>
                  <Badge variant="outline">{formData.agent_max_tokens}</Badge>
                </div>
                <Slider id="max_tokens" min={500} max={8000} step={100} value={[formData.agent_max_tokens]} onValueChange={value => setFormData({
                ...formData,
                agent_max_tokens: value[0]
              })} disabled={!isAdmin} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  Maximum tokens per AI response (higher = longer responses, higher cost)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Badge variant="outline">{formData.agent_temperature}</Badge>
                </div>
                <Slider id="temperature" min={0} max={1} step={0.1} value={[formData.agent_temperature]} onValueChange={value => setFormData({
                ...formData,
                agent_temperature: value[0]
              })} disabled={!isAdmin} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  Controls randomness: 0 = focused, 1 = creative
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        {isAdmin && <div className="flex justify-end sticky bottom-4 z-10">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary hover:shadow-glow w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>}
      </TabsContent>
    </Tabs>;
};
export default AgentConfiguration;