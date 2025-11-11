-- Create a security definer function to check if users are in the same community
-- This prevents recursive RLS issues
CREATE OR REPLACE FUNCTION public.can_view_community_user(target_user_id UUID, viewer_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if viewer and target user are in the same community
  SELECT EXISTS (
    SELECT 1 
    FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    JOIN users u ON u.id = cm1.user_id
    WHERE cm2.user_id = target_user_id
      AND u.auth_user_id = viewer_auth_id
  );
$$;

-- Add RLS policy to users table so community members can view each other
CREATE POLICY "Community members can view other members in their communities"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.can_view_community_user(id, auth.uid())
);

-- Also allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;