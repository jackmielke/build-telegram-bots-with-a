import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Brain } from 'lucide-react';

interface Community {
  id: string;
  agent_model: string | null;
  agent_max_tokens: number | null;
  agent_temperature: number | null;
}

interface LLMSettingsProps {
  community: Community;
  isAdmin: boolean;
  onUpdate: (community: Community) => void;
}

const LLMSettings = ({ community, isAdmin, onUpdate }: LLMSettingsProps) => {
  const [formData, setFormData] = useState({
    agent_model: community.agent_model || 'google/gemini-2.5-flash',
    agent_max_tokens: community.agent_max_tokens || 2000,
    agent_temperature: community.agent_temperature || 0.7,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const availableModels = [
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Best for vision + reasoning', provider: 'Gemini' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Balanced, vision-capable', provider: 'Gemini' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Fastest, cheapest', provider: 'Gemini' },
    { value: 'openai/gpt-5', label: 'GPT-5', description: 'Most capable flagship model', provider: 'OpenAI' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', description: 'Faster, cost-efficient', provider: 'OpenAI' },
    { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano', description: 'Fastest, cheapest', provider: 'OpenAI' },
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
        title: "Settings Updated",
        description: "LLM configuration has been saved successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update LLM settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
                      <div className="font-medium flex items-center gap-2">
                        {model.label}
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{model.provider}</Badge>
                      </div>
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

      {/* Save Button */}
      {isAdmin && (
        <div className="flex justify-end sticky bottom-4 z-10">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-primary hover:shadow-glow w-full sm:w-auto"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default LLMSettings;
