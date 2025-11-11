import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Video, Sparkles } from "lucide-react";

interface VideoCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  onVideoCreated?: (videoId: string) => void;
}

export const VideoCreationDialog = ({ open, onOpenChange, communityId, onVideoCreated }: VideoCreationDialogProps) => {
  const [videoType, setVideoType] = useState<string>("intro");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStatus("Starting video generation...");

    try {
      const { data, error } = await supabase.functions.invoke("generate-bot-video", {
        body: {
          communityId,
          videoType,
          customPrompt: customPrompt || undefined,
        },
      });

      if (error) throw error;

      setVideoId(data.videoId);
      setStatus("Video generation in progress...");
      toast.success("Video generation started!");

      // Start polling for status
      pollVideoStatus(data.videoId);
    } catch (error: any) {
      console.error("Error generating video:", error);
      toast.error(error.message || "Failed to generate video");
      setIsGenerating(false);
      setStatus("");
    }
  };

  const pollVideoStatus = async (vId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-video-status", {
          body: { videoId: vId },
        });

        if (error) throw error;

        setStatus(`Status: ${data.status}`);

        if (data.status === "completed") {
          clearInterval(pollInterval);
          setVideoUrl(data.videoUrl);
          setIsGenerating(false);
          setStatus("Video completed!");
          toast.success("Video generated successfully!");
          onVideoCreated?.(vId);
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setStatus("Video generation failed");
          toast.error(data.errorMessage || "Video generation failed");
        }
      } catch (error: any) {
        console.error("Error polling status:", error);
        clearInterval(pollInterval);
        setIsGenerating(false);
        toast.error("Failed to check video status");
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleClose = () => {
    if (!isGenerating) {
      onOpenChange(false);
      // Reset state
      setVideoType("intro");
      setCustomPrompt("");
      setVideoId(null);
      setStatus("");
      setVideoUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Create Bot Video
          </DialogTitle>
          <DialogDescription>
            Generate an AI video for your bot using Higgsfield AI
          </DialogDescription>
        </DialogHeader>

        {!videoUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Video Type</Label>
              <Select value={videoType} onValueChange={setVideoType} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intro">Character Introduction</SelectItem>
                  <SelectItem value="promo">Promotional Video</SelectItem>
                  <SelectItem value="token_reveal">Token Launch Animation</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custom Prompt (Optional)</Label>
              <Textarea
                placeholder={videoType === "custom" 
                  ? "Describe the video you want to generate..." 
                  : "Leave empty to use default prompt for this video type"}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={isGenerating}
                rows={4}
              />
            </div>

            {status && (
              <div className="p-3 bg-muted rounded-md text-sm flex items-center gap-2">
                {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                {status}
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Video
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <video
                src={videoUrl}
                controls
                className="w-full rounded-md"
                autoPlay
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setVideoUrl(null);
                  setVideoId(null);
                  setStatus("");
                }}
                className="flex-1"
              >
                Create Another
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};