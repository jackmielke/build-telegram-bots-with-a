import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Loader2, Settings } from 'lucide-react';

interface VoiceInterfaceProps {
  communityId: string;
  agentName: string;
  agentInstructions: string;
  isAdmin: boolean;
}

const VoiceInterface = ({ communityId, agentName, agentInstructions, isAdmin }: VoiceInterfaceProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Available ElevenLabs voices (popular ones)
  const availableVoices = [
    { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
    { value: 'echo', label: 'Echo', description: 'Warm and friendly' },
    { value: 'shimmer', label: 'Shimmer', description: 'Clear and articulate' },
    { value: 'sage', label: 'Sage', description: 'Professional and calm' },
    { value: 'aria', label: 'Aria', description: 'Expressive and dynamic' },
    { value: 'coral', label: 'Coral', description: 'Soft and soothing' },
  ];

  const startConversation = async () => {
    try {
      // This will be implemented with ElevenLabs integration
      setIsConnected(true);
      setIsRecording(true);
      
      toast({
        title: "Voice Connected",
        description: `Ready to chat with ${agentName || 'your agent'}`,
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to start voice conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
    
    toast({
      title: "Voice Disconnected",
      description: "Conversation ended",
    });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Unmuted" : "Muted",
      description: isMuted ? "Microphone is now active" : "Microphone is now muted",
    });
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="space-y-6">
      {/* Voice Settings */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-primary" />
            <span>Voice Settings</span>
          </CardTitle>
          <CardDescription>
            Configure voice settings for your AI agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice">Agent Voice</Label>
            <Select
              value={selectedVoice}
              onValueChange={setSelectedVoice}
              disabled={isConnected || !isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map((voice) => (
                  <SelectItem key={voice.value} value={voice.value}>
                    <div>
                      <div className="font-medium">{voice.label}</div>
                      <div className="text-xs text-muted-foreground">{voice.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the voice personality for your AI agent
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {isRecording && (
                <Badge variant="default" className="text-xs animate-pulse">
                  Recording
                </Badge>
              )}
              {isSpeaking && (
                <Badge variant="secondary" className="text-xs">
                  Speaking
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Interface */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-primary" />
            <span>Voice Interface</span>
          </CardTitle>
          <CardDescription>
            Test your AI agent with voice interaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Display */}
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
              isConnected 
                ? 'bg-primary/20 border-4 border-primary/50 animate-pulse' 
                : 'bg-muted border-4 border-border/50'
            }`}>
              {isConnected ? (
                <Phone className="w-12 h-12 text-primary" />
              ) : (
                <PhoneOff className="w-12 h-12 text-muted-foreground" />
              )}
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {isConnected 
                  ? `Connected to ${agentName || 'Agent'}` 
                  : 'Not Connected'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isConnected 
                  ? 'Speak to interact with your agent' 
                  : 'Start a conversation to test the voice interface'}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isConnected ? (
              <Button 
                onClick={startConversation}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                size="lg"
              >
                <Phone className="w-5 h-5 mr-2" />
                Start Voice Conversation
              </Button>
            ) : (
              <>
                <Button
                  onClick={toggleMute}
                  variant={isMuted ? "destructive" : "secondary"}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {isMuted ? (
                    <>
                      <MicOff className="w-5 h-5 mr-2" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 mr-2" />
                      Mute
                    </>
                  )}
                </Button>

                <Button
                  onClick={endConversation}
                  variant="destructive"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <PhoneOff className="w-5 h-5 mr-2" />
                  End Conversation
                </Button>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              How to Use
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Click "Start Voice Conversation" to begin</li>
              <li>Speak naturally to interact with the AI agent</li>
              <li>The agent will respond with voice based on its instructions</li>
              <li>Use mute to temporarily stop recording</li>
              <li>Click "End Conversation" when finished</li>
            </ul>
          </div>

          {/* Coming Soon Notice */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-primary">
                  ElevenLabs Integration Coming Soon
                </h4>
                <p className="text-xs text-muted-foreground">
                  Full voice functionality with ElevenLabs will be implemented next. 
                  This interface will enable real-time voice conversations with your AI agent.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceInterface;
