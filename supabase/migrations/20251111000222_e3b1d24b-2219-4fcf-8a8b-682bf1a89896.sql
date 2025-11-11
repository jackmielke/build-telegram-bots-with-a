-- Create bot_videos table to track AI-generated videos for bots/characters
CREATE TABLE public.bot_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  video_type TEXT NOT NULL DEFAULT 'intro', -- 'intro', 'promo', 'token_reveal', 'custom'
  prompt TEXT NOT NULL,
  source_image_url TEXT,
  model TEXT NOT NULL DEFAULT 'higgsfield/realistic-vision-v5', -- AI model used
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  resolution TEXT DEFAULT '1080p',
  generation_metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.bot_videos ENABLE ROW LEVEL SECURITY;

-- Community members can view videos for their communities
CREATE POLICY "Community members can view bot videos"
ON public.bot_videos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.community_id = bot_videos.community_id
      AND u.auth_user_id = auth.uid()
  )
);

-- Community admins can create videos
CREATE POLICY "Community admins can create bot videos"
ON public.bot_videos
FOR INSERT
TO authenticated
WITH CHECK (
  is_community_admin(community_id, auth.uid())
);

-- Community admins can update videos (for status polling)
CREATE POLICY "Community admins can update bot videos"
ON public.bot_videos
FOR UPDATE
TO authenticated
USING (
  is_community_admin(community_id, auth.uid())
);

-- Community admins can delete videos
CREATE POLICY "Community admins can delete bot videos"
ON public.bot_videos
FOR DELETE
TO authenticated
USING (
  is_community_admin(community_id, auth.uid())
);

-- Edge functions can update video status
CREATE POLICY "Edge functions can update video status"
ON public.bot_videos
FOR UPDATE
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_bot_videos_updated_at
BEFORE UPDATE ON public.bot_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_bot_videos_community_id ON public.bot_videos(community_id);
CREATE INDEX idx_bot_videos_status ON public.bot_videos(status);
CREATE INDEX idx_bot_videos_created_at ON public.bot_videos(created_at DESC);