-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Community admins can remove members" ON public.community_members;

-- Allow community admins to remove members from their communities
CREATE POLICY "Community admins can remove members"
ON public.community_members
FOR DELETE
USING (is_community_admin(community_id, auth.uid()));