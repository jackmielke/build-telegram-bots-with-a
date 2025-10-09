-- Add fields for unclaimed Telegram profiles
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT,
ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;

-- Add index on telegram_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON public.users(telegram_user_id);

-- Update RLS policy: Admins can update any user profile (including unclaimed)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles"
ON public.users
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
);

-- Update RLS policy: Users can only update their own claimed profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = auth_user_id AND is_claimed = true
)
WITH CHECK (
  auth.uid() = auth_user_id AND is_claimed = true
);