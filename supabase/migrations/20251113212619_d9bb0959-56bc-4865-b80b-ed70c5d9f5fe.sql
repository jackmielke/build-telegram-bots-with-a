-- Fix the policy to ensure users can always look up their own ID
DROP POLICY IF EXISTS "Users can view basic info of community members" ON public.users;

-- Create a more permissive policy that allows:
-- 1. Users to view their own complete profile
-- 2. Users to view basic info of others in the same community
CREATE POLICY "Users can view profiles"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- User can always view their own profile
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