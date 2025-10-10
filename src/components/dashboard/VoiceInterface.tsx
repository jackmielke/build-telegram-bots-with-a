import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, Settings, Volume2, Edit, Sparkles, Loader2 } from "lucide-react";
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
  const [agentId, setAgentId] = useState("");
  const [savedAgentId, setSavedAgentId] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Voice creation wizard state
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);
  const [voiceDescription, setVoiceDescription] = useState("");
  const [voicePreviews, setVoicePreviews] = useState<any[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<number | null>(null);
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Fetch saved agent ID on mount
  useEffect(() => {
    const fetchAgentId = async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("elevenlabs_agent_id")
        .eq("id", communityId)
        .single();

      if (data?.elevenlabs_agent_id) {
        setSavedAgentId(data.elevenlabs_agent_id);
        setAgentId(data.elevenlabs_agent_id);
      }
    };

    fetchAgentId();
  }, [communityId]);

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
      const errorMessage = typeof error === 'string' 
        ? error 
        : (error as any)?.message || "An error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onMessage: (message) => {
      console.log("Received message:", message);
    },
  });

  const saveAgentId = async () => {
    if (!agentId.trim()) {
      toast({
        title: "Agent ID Required",
        description: "Please enter a valid ElevenLabs Agent ID",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("communities")
        .update({ elevenlabs_agent_id: agentId })
        .eq("id", communityId);

      if (error) throw error;

      setSavedAgentId(agentId);
      setIsEditDialogOpen(false);
      toast({
        title: "Saved",
        description: "ElevenLabs Agent ID has been saved successfully",
      });
    } catch (error) {
      console.error("Error saving agent ID:", error);
      toast({
        title: "Error",
        description: "Failed to save agent ID",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startConversation = async () => {
    try {
      if (!savedAgentId) {
        toast({
          title: "Setup Required",
          description: "Please configure your ElevenLabs Agent ID first",
          variant: "destructive",
        });
        setIsEditDialogOpen(true);
        return;
      }

      console.log("Starting conversation with agent:", agentId);

      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-session", {
        body: { agentId: savedAgentId },
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
        signedUrl: data.signed_url,
      } as any);
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

  const generateVoicePreviews = async () => {
    if (!voiceDescription.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe the voice you want to create",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPreviews(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-create-previews", {
        body: { voiceDescription },
      });

      if (error) throw error;
      
      if (!data?.previews || data.previews.length === 0) {
        throw new Error("No previews generated");
      }

      setVoicePreviews(data.previews);
      toast({
        title: "Previews Generated",
        description: "Listen to the voices and select your favorite!",
      });
    } catch (error) {
      console.error("Error generating previews:", error);
      toast({
        title: "Error",
        description: "Failed to generate voice previews",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreviews(false);
    }
  };

  const playPreview = (previewIndex: number, audioUrl: string) => {
    // Stop currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Create and play new audio
    const audio = new Audio(audioUrl);
    audio.play();
    setCurrentAudio(audio);
    setSelectedPreview(previewIndex);
  };

  const createVoiceAgent = async () => {
    if (selectedPreview === null) {
      toast({
        title: "Selection Required",
        description: "Please select a voice preview first",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingAgent(true);
    try {
      const selectedVoicePreview = voicePreviews[selectedPreview];
      
      const { data, error } = await supabase.functions.invoke("elevenlabs-create-agent", {
        body: {
          voiceDescription,
          previewId: selectedVoicePreview.generated_voice_id,
          agentName,
          agentInstructions,
          communityId,
        },
      });

      if (error) throw error;

      if (data?.agentId) {
        setSavedAgentId(data.agentId);
        setIsCreatingVoice(false);
        setVoiceDescription("");
        setVoicePreviews([]);
        setSelectedPreview(null);
        
        toast({
          title: "Success!",
          description: "Voice agent created successfully",
        });
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      toast({
        title: "Error",
        description: "Failed to create voice agent",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAgent(false);
    }
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
          {/* Agent ID Display/Setup */}
          <div className="space-y-2">
            <Label>ElevenLabs Agent ID</Label>
            {savedAgentId ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                  {savedAgentId}
                </div>
                {isAdmin && (
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Agent ID</DialogTitle>
                        <DialogDescription>
                          Update your ElevenLabs Conversational AI agent ID
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-agentId">Agent ID</Label>
                          <Input
                            id="edit-agentId"
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value)}
                            placeholder="agent_xxxxxxxxxxxxxxxx"
                          />
                          <p className="text-xs text-muted-foreground">
                            Create or find your agent at{" "}
                            <a
                              href="https://elevenlabs.io/app/conversational-ai"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              elevenlabs.io
                            </a>
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAgentId(savedAgentId);
                            setIsEditDialogOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={saveAgentId} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No agent configured. {isAdmin ? "Create a custom voice agent below!" : "Ask an admin to configure the agent."}
                </p>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Dialog open={isCreatingVoice} onOpenChange={setIsCreatingVoice}>
                      <DialogTrigger asChild>
                        <Button variant="default" className="flex-1">
                          <Sparkles className="w-4 h-4 mr-2" />
                          Create Voice Agent
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create Your Voice Agent</DialogTitle>
                          <DialogDescription>
                            Describe the voice you want, listen to samples, and create your agent
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          {/* Voice Description */}
                          <div className="space-y-2">
                            <Label htmlFor="voice-description">Describe Your Voice</Label>
                            <Textarea
                              id="voice-description"
                              value={voiceDescription}
                              onChange={(e) => setVoiceDescription(e.target.value)}
                              placeholder="e.g., A warm, friendly female voice with a slight British accent..."
                              className="min-h-[100px]"
                            />
                          </div>

                          {/* Generate Button */}
                          {voicePreviews.length === 0 && (
                            <Button 
                              onClick={generateVoicePreviews} 
                              disabled={isGeneratingPreviews}
                              className="w-full"
                            >
                              {isGeneratingPreviews ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Generating Previews...
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-4 h-4 mr-2" />
                                  Generate Voice Previews
                                </>
                              )}
                            </Button>
                          )}

                          {/* Voice Previews */}
                          {voicePreviews.length > 0 && (
                            <div className="space-y-3">
                              <Label>Select Your Favorite Voice</Label>
                              <div className="grid grid-cols-3 gap-3">
                                {voicePreviews.map((preview, index) => (
                                  <Card 
                                    key={index}
                                    className={`cursor-pointer transition-all ${
                                      selectedPreview === index 
                                        ? 'ring-2 ring-primary' 
                                        : 'hover:ring-1 hover:ring-muted-foreground'
                                    }`}
                                    onClick={() => playPreview(index, `data:audio/mpeg;base64,${preview.audio_base_64}`)}
                                  >
                                    <CardContent className="p-4 text-center">
                                      <Volume2 className="w-8 h-8 mx-auto mb-2" />
                                      <p className="text-sm font-medium">Voice {index + 1}</p>
                                      {selectedPreview === index && (
                                        <Badge variant="default" className="mt-2">Selected</Badge>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          {voicePreviews.length > 0 && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setVoicePreviews([]);
                                  setSelectedPreview(null);
                                  if (currentAudio) {
                                    currentAudio.pause();
                                  }
                                }}
                              >
                                Try Again
                              </Button>
                              <Button 
                                onClick={createVoiceAgent}
                                disabled={selectedPreview === null || isCreatingAgent}
                              >
                                {isCreatingAgent ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating Agent...
                                  </>
                                ) : (
                                  "Create Agent"
                                )}
                              </Button>
                            </>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <Settings className="w-4 h-4 mr-2" />
                          Use Existing Agent
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Use Existing Agent</DialogTitle>
                          <DialogDescription>
                            Enter your ElevenLabs agent ID if you already have one
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="setup-agentId">Agent ID</Label>
                            <Input
                              id="setup-agentId"
                              value={agentId}
                              onChange={(e) => setAgentId(e.target.value)}
                              placeholder="agent_xxxxxxxxxxxxxxxx"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={saveAgentId} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Badges */}
          {savedAgentId && (
            <div className="flex gap-2 flex-wrap">
              <Badge variant={conversation.status === "connected" ? "default" : "secondary"}>
                {conversation.status === "connected" ? "Connected" : "Disconnected"}
              </Badge>
              <Badge variant={conversation.isSpeaking ? "default" : "secondary"}>
                {conversation.isSpeaking ? "Speaking" : "Silent"}
              </Badge>
            </div>
          )}
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
          <div className="text-center text-sm text-muted-foreground">
            <p>
              {conversation.status === "connected"
                ? "Speak naturally - the AI will respond to your voice."
                : savedAgentId
                ? "Click 'Start Voice Conversation' to begin talking with the AI."
                : "Configure your agent above to enable voice conversations."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceInterface;
