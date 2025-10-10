import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneOff, Mic, Settings, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceInterfaceProps {
  communityId: string;
  agentName: string;
  agentInstructions: string;
  isAdmin: boolean;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  communityId,
  agentName,
  agentInstructions,
  isAdmin,
}) => {
  const { toast } = useToast();
  const [selectedVoice, setSelectedVoice] = useState("9BWtsMINqrJLrRacOk9x");
  const [agentId, setAgentId] = useState("");

  // Available ElevenLabs voices
  const availableVoices = [
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" },
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
    { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
    { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
    { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  ];

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs");
      toast({
        title: "Connected",
        description: "Voice conversation started",
      });
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
      toast({
        title: "Disconnected",
        description: "Voice conversation ended",
      });
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
    onMessage: (message) => {
      console.log("Received message:", message);
    },
  });

  const startConversation = async () => {
    try {
      if (!agentId) {
        toast({
          title: "Agent ID Required",
          description: "Please enter an ElevenLabs Agent ID in the settings below",
          variant: "destructive",
        });
        return;
      }

      console.log("Starting conversation with agent:", agentId);

      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-session", {
        body: { agentId },
      });

      if (error) {
        throw error;
      }

      if (!data || !data.signed_url) {
        throw new Error("Failed to get signed URL from ElevenLabs");
      }

      console.log("Got signed URL, starting session");

      // Start the conversation with the signed URL
      await conversation.startSession({
        url: data.signed_url,
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error("Error ending conversation:", error);
    }
  };

  const toggleMute = async () => {
    // Mute functionality is built into the conversation hook
    console.log("Toggle mute");
  };

  return (
    <div className="space-y-6">
      {/* Voice Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Voice Settings
          </CardTitle>
          <CardDescription>
            Configure your AI agent's voice and conversation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agent ID Input */}
          <div className="space-y-2">
            <Label htmlFor="agentId">ElevenLabs Agent ID</Label>
            <Input
              id="agentId"
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Enter your ElevenLabs Agent ID"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Create an agent at{" "}
              <a
                href="https://elevenlabs.io/app/conversational-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                elevenlabs.io/app/conversational-ai
              </a>
            </p>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label htmlFor="voice">AI Voice (for reference)</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger id="voice">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Note: Voice is configured in your ElevenLabs agent settings
            </p>
          </div>

          {/* Status Badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant={conversation.status === "connected" ? "default" : "secondary"}>
              {conversation.status === "connected" ? "Connected" : "Disconnected"}
            </Badge>
            <Badge variant={conversation.isSpeaking ? "default" : "secondary"}>
              {conversation.isSpeaking ? "Speaking" : "Silent"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Voice Interface Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Voice Interface
          </CardTitle>
          <CardDescription>
            Talk to {agentName} using your voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual Indicator */}
          <div className="flex justify-center">
            <div
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                conversation.status === "connected"
                  ? conversation.isSpeaking
                    ? "bg-primary/20 scale-110"
                    : "bg-primary/10"
                  : "bg-muted"
              }`}
            >
              <Phone
                className={`w-16 h-16 ${
                  conversation.status === "connected" ? "text-primary" : "text-muted-foreground"
                }`}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center gap-4">
            {conversation.status !== "connected" ? (
              <Button onClick={startConversation} size="lg" className="gap-2">
                <Phone className="w-5 h-5" />
                Start Voice Conversation
              </Button>
            ) : (
              <>
                <Button onClick={endConversation} variant="destructive" size="lg" className="gap-2">
                  <PhoneOff className="w-5 h-5" />
                  End Conversation
                </Button>
                <Button onClick={toggleMute} variant="outline" size="lg" className="gap-2">
                  <Mic className="w-5 h-5" />
                  Mute/Unmute
                </Button>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>
              {conversation.status === "connected"
                ? "Speak naturally - the AI will respond to your voice."
                : "Enter your ElevenLabs Agent ID above and click 'Start Voice Conversation' to begin."}
            </p>
            {isAdmin && agentInstructions && (
              <p className="text-xs">
                Agent instructions: {agentInstructions}
              </p>
            )}
          </div>

          {/* Setup Instructions */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              Setup Instructions
            </h4>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Create an agent at ElevenLabs Conversational AI</li>
              <li>Copy your Agent ID from the agent settings</li>
              <li>Paste it in the field above</li>
              <li>Click "Start Voice Conversation" to begin</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              You can customize voices, prompts, and knowledge base in your ElevenLabs agent settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceInterface;
