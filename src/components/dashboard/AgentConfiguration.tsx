import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Bot, Brain, MessageSquare, Settings, Sparkles, Image } from 'lucide-react';

interface Community {
  id: string;
  agent_name: string | null;
  agent_instructions: string | null;
  agent_intro_message: string | null;
  agent_avatar_url: string | null;
  agent_model: string | null;
  agent_max_tokens: number | null;
  agent_temperature: number | null;
  agent_suggested_messages: string[] | null;
}

interface AgentConfigurationProps {
  community: Community;
  isAdmin: boolean;
  onUpdate: (community: Community) => void;
}

const AgentConfiguration = ({ community, isAdmin, onUpdate }: AgentConfigurationProps) => {
  const [formData, setFormData] = useState({
    agent_name: community.agent_name || '',
    agent_instructions: community.agent_instructions || '',
    agent_intro_message: community.agent_intro_message || '',
    agent_avatar_url: community.agent_avatar_url || '',
    agent_model: community.agent_model || 'gpt-4o-mini',
    agent_max_tokens: community.agent_max_tokens || 2000,
    agent_temperature: community.agent_temperature || 0.7,
    agent_suggested_messages: community.agent_suggested_messages || []
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
        description: "Agent configuration has been saved successfully.",
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

  const availableModels = [
    { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Latest)', description: 'Most capable flagship model' },
    { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini', description: 'Faster, cost-efficient' },
    { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano', description: 'Fastest, cheapest' },
    { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', description: 'Reliable flagship GPT-4' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and affordable' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Powerful with vision' }
  ];

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

  return (
    <div className="space-y-6">
      {/* Agent Identity */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-primary" />
            <span>Agent Identity</span>
          </CardTitle>
          <CardDescription>
            Configure your AI agent's personality and appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="space-y-2">
              <Label htmlFor="agent_avatar_url">Avatar URL</Label>
              <Input
                id="agent_avatar_url"
                value={formData.agent_avatar_url}
                onChange={(e) => setFormData({ ...formData, agent_avatar_url: e.target.value })}
                placeholder="https://example.com/avatar.png"
                disabled={!isAdmin}
              />
            </div>
          </div>

          {formData.agent_avatar_url && (
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-background/50 border border-border/30">
              <img 
                src={formData.agent_avatar_url} 
                alt="Agent avatar preview"
                className="w-10 h-10 rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <p className="font-medium">{formData.agent_name || 'Agent Preview'}</p>
                <p className="text-sm text-muted-foreground">Avatar preview</p>
              </div>
            </div>
          )}

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
          </div>
        </CardContent>
      </Card>

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

      {/* Instructions */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>Agent Instructions</span>
          </CardTitle>
          <CardDescription>
            Define your agent's behavior, knowledge, and personality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="agent_instructions">System Instructions</Label>
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
              These instructions guide how your AI agent behaves and responds to users
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Messages */}
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
        <CardContent className="space-y-4">
          {formData.agent_suggested_messages.map((message, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={message}
                onChange={(e) => updateSuggestedMessage(index, e.target.value)}
                placeholder="Enter suggested message"
                disabled={!isAdmin}
              />
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeSuggestedMessage(index)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          
          {isAdmin && formData.agent_suggested_messages.length < 6 && (
            <Button
              variant="outline"
              onClick={addSuggestedMessage}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Add Suggested Message
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="gradient-primary hover:shadow-glow"
          >
            {saving ? 'Saving...' : 'Save Agent Configuration'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AgentConfiguration;