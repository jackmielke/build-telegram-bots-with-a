-- Create bot_tokens table to store launched tokens
CREATE TABLE IF NOT EXISTS public.bot_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_description TEXT,
  token_address TEXT NOT NULL,
  hook_address TEXT,
  transaction_hash TEXT NOT NULL,
  image_ipfs_hash TEXT,
  metadata_ipfs_hash TEXT,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  template_id TEXT NOT NULL,
  initial_supply TEXT,
  num_tokens_to_sell TEXT,
  launch_metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_tokens ENABLE ROW LEVEL SECURITY;

-- Community members can view tokens for their communities
CREATE POLICY "Community members can view tokens"
ON public.bot_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_members cm
    JOIN public.users u ON cm.user_id = u.id
    WHERE cm.community_id = bot_tokens.community_id
    AND u.auth_user_id = auth.uid()
  )
);

-- Community admins can create tokens
CREATE POLICY "Community admins can create tokens"
ON public.bot_tokens
FOR INSERT
WITH CHECK (
  is_community_admin(community_id, auth.uid())
);

-- Community admins can update tokens
CREATE POLICY "Community admins can update tokens"
ON public.bot_tokens
FOR UPDATE
USING (
  is_community_admin(community_id, auth.uid())
);

-- Community admins can delete tokens
CREATE POLICY "Community admins can delete tokens"
ON public.bot_tokens
FOR DELETE
USING (
  is_community_admin(community_id, auth.uid())
);

-- Create index for faster lookups
CREATE INDEX idx_bot_tokens_community_id ON public.bot_tokens(community_id);
CREATE INDEX idx_bot_tokens_token_address ON public.bot_tokens(token_address);

-- Add updated_at trigger
CREATE TRIGGER update_bot_tokens_updated_at
BEFORE UPDATE ON public.bot_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();