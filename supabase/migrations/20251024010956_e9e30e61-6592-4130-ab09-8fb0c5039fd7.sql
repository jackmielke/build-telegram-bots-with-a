-- Add daily message configuration to communities table
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS daily_message_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_message_content TEXT,
ADD COLUMN IF NOT EXISTS daily_message_time TIME DEFAULT '09:00:00';

-- Create function to get communities that need daily messages sent
CREATE OR REPLACE FUNCTION get_communities_for_daily_message()
RETURNS TABLE (
  community_id uuid,
  community_name text,
  telegram_bot_token text,
  daily_message_content text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id as community_id,
    c.name as community_name,
    c.telegram_bot_token,
    c.daily_message_content
  FROM communities c
  WHERE c.daily_message_enabled = true
    AND c.daily_message_content IS NOT NULL
    AND c.telegram_bot_token IS NOT NULL;
$$;