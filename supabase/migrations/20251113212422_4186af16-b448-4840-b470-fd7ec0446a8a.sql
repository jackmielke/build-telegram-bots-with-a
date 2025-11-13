-- Drop overly restrictive policies that are blocking memory fetches
DROP POLICY IF EXISTS "Community members can view other members in their communities" ON public.users;
DROP POLICY IF EXISTS "Community members can view other members public profiles" ON public.users;

-- Create a more permissive policy for viewing basic user info
-- This allows authenticated users to see names of users in their communities
CREATE POLICY "Users can view basic info of community members"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- User can view their own profile
  auth.uid() = auth_user_id
  OR
  -- User can view other users who are in the same community
  EXISTS (
    SELECT 1 
    FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    JOIN users u ON cm1.user_id = u.id
    WHERE cm2.user_id = users.id
      AND u.auth_user_id = auth.uid()
  )
);