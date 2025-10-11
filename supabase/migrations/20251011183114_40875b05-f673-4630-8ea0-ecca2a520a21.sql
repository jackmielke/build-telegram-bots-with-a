-- Create profile claim requests table for verification
CREATE TABLE public.profile_claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.profile_claim_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create claim requests for their own auth account
CREATE POLICY "Users can create their own claim requests"
ON public.profile_claim_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- Policy: Users can view their own claim requests
CREATE POLICY "Users can view their own claim requests"
ON public.profile_claim_requests
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Policy: Edge functions can update claim requests
CREATE POLICY "Edge functions can update claim requests"
ON public.profile_claim_requests
FOR UPDATE
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_profile_claim_requests_verification_code ON public.profile_claim_requests(verification_code);
CREATE INDEX idx_profile_claim_requests_auth_user_id ON public.profile_claim_requests(auth_user_id);