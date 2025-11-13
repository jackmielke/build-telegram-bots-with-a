-- Create table for magic link tokens
CREATE TABLE IF NOT EXISTS public.magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_magic_link_tokens_token ON public.magic_link_tokens(token) WHERE NOT used;
CREATE INDEX idx_magic_link_tokens_user_id ON public.magic_link_tokens(user_id);

-- Policy: Edge functions can manage tokens
CREATE POLICY "Edge functions can manage magic link tokens"
ON public.magic_link_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);