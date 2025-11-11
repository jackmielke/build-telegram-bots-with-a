-- Fix community_favorites RLS policy to work with restricted users table access
-- The issue: The policy uses a subquery to users table which is now restricted
-- Solution: Use the existing get_user_id_from_auth function instead

DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.community_favorites;

-- Allow users to view their own favorites
CREATE POLICY "Users can view their own favorites"
ON public.community_favorites
FOR SELECT
TO authenticated
USING (user_id = get_user_id_from_auth(auth.uid()));

-- Allow users to insert their own favorites
CREATE POLICY "Users can insert their own favorites"
ON public.community_favorites
FOR INSERT
TO authenticated
WITH CHECK (user_id = get_user_id_from_auth(auth.uid()));

-- Allow users to delete their own favorites
CREATE POLICY "Users can delete their own favorites"
ON public.community_favorites
FOR DELETE
TO authenticated
USING (user_id = get_user_id_from_auth(auth.uid()));