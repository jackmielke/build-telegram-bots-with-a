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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bot, Brain, MessageSquare, Upload, Loader2, Sparkles, Zap, Settings, Bell, Users } from 'lucide-react';
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
  daily_message_enabled: boolean | null;
  daily_message_content: string | null;
  daily_message_time: string | null;
  timezone: string | null;
}

interface UnifiedAgentSetupProps {
  community: Community;
  isAdmin: boolean;
  onUpdate: (community: Community) => void;
}

const UnifiedAgentSetup = ({ community, isAdmin, onUpdate }: UnifiedAgentSetupProps) => {
  const timezone = community.timezone || 'America/Argentina/Buenos_Aires';
  
  // Convert UTC time to local timezone for display
  const getLocalTime = (utcTimeString: string, tz: string): string => {
    try {
      const [hours, minutes] = utcTimeString.split(':');
      // Create a date in UTC
      const utcDate = new Date(`2000-01-01T${hours}:${minutes}:00Z`);
      
      // Format it in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return formatter.format(utcDate);
    } catch {
      return '09:00';
    }
  };
  
  // Convert local timezone time to UTC for storage
  const getUTCTime = (localTimeString: string, tz: string): string => {
    try {
      const [hours, minutes] = localTimeString.split(':');
      
      // Create a date string in the local timezone
      const dateString = '2000-01-01';
      const timeString = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
      
      // Parse as if it's in the target timezone
      const localDateTimeString = `${dateString}T${timeString}`;
      
      // Get offset for this timezone at this time
      const testDate = new Date(localDateTimeString);
      const utcDate = new Date(testDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(testDate.toLocaleString('en-US', { timeZone: tz }));
      const offset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60); // offset in minutes
      
      // Apply offset to get UTC time
      let utcHours = parseInt(hours);
      let utcMinutes = parseInt(minutes);
      
      // Subtract the offset to get UTC
      utcMinutes -= offset;
      
      while (utcMinutes < 0) {
        utcMinutes += 60;
        utcHours -= 1;
      }
      while (utcMinutes >= 60) {
        utcMinutes -= 60;
        utcHours += 1;
      }
      while (utcHours < 0) {
        utcHours += 24;
      }
      while (utcHours >= 24) {
        utcHours -= 24;
      }
      
      // Round to nearest 15-minute interval to match cron schedule
      // Cron runs at :00, :15, :30, :45
      const totalMinutes = utcHours * 60 + utcMinutes;
      const roundedMinutes = Math.round(totalMinutes / 15) * 15;
      const finalHours = Math.floor(roundedMinutes / 60) % 24;
      const finalMinutes = roundedMinutes % 60;
      
      return `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}:00`;
    } catch (e) {
      console.error('Error converting to UTC:', e);
      return `${localTimeString}:00`;
    }
  };
  
  // Generate time options in 15-minute intervals
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 15, 30, 45]) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };
  
  const [formData, setFormData] = useState({
    agent_name: community.agent_name || '',
    agent_instructions: community.agent_instructions || '',
    agent_intro_message: community.agent_intro_message || '',
    agent_avatar_url: community.agent_avatar_url || '',
    agent_model: community.agent_model || 'google/gemini-2.5-flash',
    agent_max_tokens: community.agent_max_tokens || 2000,
    agent_temperature: community.agent_temperature || 0.7,
    agent_suggested_messages: community.agent_suggested_messages || [],
    daily_message_enabled: community.daily_message_enabled || false,
    daily_message_content: community.daily_message_content || '',
    daily_message_time: community.daily_message_time || '09:00:00',
    timezone: timezone,
    displayTime: getLocalTime(community.daily_message_time || '09:00:00', timezone)
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const commonTimezones = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (Argentina)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (US)' },
    { value: 'America/Chicago', label: 'Central Time (US)' },
    { value: 'America/Denver', label: 'Mountain Time (US)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
    { value: 'America/Phoenix', label: 'Arizona' },
    { value: 'America/Anchorage', label: 'Alaska' },
    { value: 'Pacific/Honolulu', label: 'Hawaii' },
    { value: 'America/Mexico_City', label: 'Mexico City' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (Brazil)' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Berlin', label: 'Berlin' },
    { value: 'Europe/Rome', label: 'Rome' },
    { value: 'Europe/Madrid', label: 'Madrid' },
    { value: 'Europe/Athens', label: 'Athens' },
    { value: 'Asia/Dubai', label: 'Dubai' },
    { value: 'Asia/Kolkata', label: 'India' },
    { value: 'Asia/Shanghai', label: 'China' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'Pacific/Auckland', label: 'New Zealand' }
  ];

  const availableModels = [
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Best for vision + reasoning' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Balanced, vision-capable' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Fastest, cheapest' },
    { value: 'openai/gpt-5', label: 'GPT-5', description: 'Most capable flagship model' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', description: 'Faster, cost-efficient' },
    { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano', description: 'Fastest, cheapest' }
  ];

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      // Convert display time (in selected timezone) back to UTC before saving
      const utcTime = getUTCTime(formData.displayTime, formData.timezone);
      
      const { displayTime, ...dataWithoutDisplay } = formData;
      const dataToSave = {
        ...dataWithoutDisplay,
        daily_message_time: utcTime
      };
      
      const { error } = await supabase
        .from('communities')
        .update(dataToSave)
        .eq('id', community.id);

      if (error) throw error;

      onUpdate({ ...community, ...dataToSave });
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

  const handleBackfillProfiles = async () => {
    if (!isAdmin) return;
    
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-intros', {
        body: { communityId: community.id }
      });

      if (error) throw error;

      const stats = data?.stats || {};
      toast({
        title: "Profile Backfill Complete",
        description: `Processed ${stats.successful || 0} intros. ${stats.failed > 0 ? `${stats.failed} failed.` : ''}`,
        duration: 5000
      });
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast({
        title: "Backfill Failed",
        description: error.message || "Failed to backfill profiles from intro messages",
        variant: "destructive"
      });
    } finally {
      setBackfilling(false);
    }
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
      <WorkflowBuilder
        community={community}
        isAdmin={isAdmin}
        onUpdate={(updated) => onUpdate({ ...community, ...updated })}
      />

      {/* 3. LLM SETTINGS */}
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

      {/* 4. IDENTITY & APPEARANCE */}
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

      {/* 5. DAILY NOTIFICATIONS */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-primary" />
            <span>Daily Notifications</span>
          </CardTitle>
          <CardDescription>
            Schedule automatic daily messages to active bot users who have opted in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="daily_message_enabled">Enable Daily Messages</Label>
              <p className="text-xs text-muted-foreground">
                Send a scheduled message to active users who have proactive outreach enabled
              </p>
            </div>
            <Switch
              id="daily_message_enabled"
              checked={formData.daily_message_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, daily_message_enabled: checked })}
              disabled={!isAdmin}
            />
          </div>

          {formData.daily_message_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="daily_message_content">Daily Message</Label>
                <Textarea
                  id="daily_message_content"
                  value={formData.daily_message_content}
                  onChange={(e) => setFormData({ ...formData, daily_message_content: e.target.value })}
                  placeholder="Good morning! Here's what's happening today..."
                  disabled={!isAdmin}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be sent to bot users who have opted in for proactive messages
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => {
                    const newDisplayTime = getLocalTime(formData.daily_message_time, value);
                    setFormData({ ...formData, timezone: value, displayTime: newDisplayTime });
                  }}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {commonTimezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Your local timezone for scheduling messages
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="daily_message_time">Send Time</Label>
                <Select
                  value={formData.displayTime}
                  onValueChange={(value) => setFormData({ ...formData, displayTime: value })}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {generateTimeOptions().map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Time in {formData.timezone} when messages will be sent. Messages are checked every 15 minutes.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PROFILE MANAGEMENT */}
      {isAdmin && (
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Profile Management</span>
            </CardTitle>
            <CardDescription>
              Generate user profiles from existing intro messages in Telegram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm">
                This will scan all messages in the <strong>"Intros"</strong> channel and automatically 
                generate profile bios for users who don't have one yet using AI.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Only processes messages from the Intros channel</li>
                <li>Skips users who already have bios</li>
                <li>Uses AI to format intro messages into professional bios</li>
                <li>Safe to run multiple times</li>
              </ul>
            </div>
            
            <Button
              onClick={handleBackfillProfiles}
              disabled={backfilling}
              variant="outline"
              className="w-full"
            >
              {backfilling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Profiles...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Profiles from Intros
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

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
