-- Add webhook API key and tracking columns to communities table
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS webhook_api_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS webhook_request_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhook_last_used_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_communities_webhook_api_key 
ON public.communities(webhook_api_key) 
WHERE webhook_api_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.communities.webhook_api_key IS 'Secure API key for webhook integration';
COMMENT ON COLUMN public.communities.webhook_enabled IS 'Whether webhook integration is enabled';
COMMENT ON COLUMN public.communities.webhook_request_count IS 'Total number of webhook requests received';
COMMENT ON COLUMN public.communities.webhook_last_used_at IS 'Last time webhook was used';