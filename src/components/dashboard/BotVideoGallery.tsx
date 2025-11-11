import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Download, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { VideoCreationDialog } from "./VideoCreationDialog";

interface BotVideoGalleryProps {
  communityId: string;
}

export const BotVideoGallery = ({ communityId }: BotVideoGalleryProps) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: videos, isLoading, refetch } = useQuery({
    queryKey: ["bot-videos", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_videos")
        .select("*")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from("bot_videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;

      toast.success("Video deleted");
      refetch();
    } catch (error: any) {
      toast.error("Failed to delete video");
      console.error(error);
    }
  };

  const handleDownload = (videoUrl: string, videoId: string) => {
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = `bot-video-${videoId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVideoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      intro: "Introduction",
      promo: "Promotional",
      token_reveal: "Token Launch",
      custom: "Custom",
    };
    return labels[type] || type;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Gallery
              </CardTitle>
              <CardDescription>AI-generated videos for your bot</CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Video className="mr-2 h-4 w-4" />
              Create Video
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <div key={video.id} className="group relative rounded-lg border overflow-hidden">
                  {video.status === "completed" && video.video_url ? (
                    <video
                      src={video.video_url}
                      controls
                      className="w-full aspect-video object-cover"
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : video.status === "processing" ? (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Generating...</p>
                      </div>
                    </div>
                  ) : video.status === "failed" ? (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <p className="text-sm text-destructive">Generation failed</p>
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  <div className="p-3 bg-background">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {getVideoTypeLabel(video.video_type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {video.resolution} • {video.duration}s
                      </span>
                    </div>
                    
                    {video.status === "completed" && video.video_url && (
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDownload(video.video_url!, video.id)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(video.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No videos yet. Create your first AI-generated video!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <VideoCreationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        communityId={communityId}
        onVideoCreated={() => refetch()}
      />
    </>
  );
};