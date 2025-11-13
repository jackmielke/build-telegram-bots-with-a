-- Simplify users table RLS policy to allow authenticated users to view profiles
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;

-- Create a simple policy: authenticated users can view all user profiles
CREATE POLICY "Authenticated users can view user profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);