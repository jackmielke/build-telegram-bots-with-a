-- Drop existing policies on memories table
DROP POLICY IF EXISTS "Community members can create memories" ON public.memories;
DROP POLICY IF EXISTS "Community members can view memories" ON public.memories;
DROP POLICY IF EXISTS "Users can delete memories" ON public.memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON public.memories;

-- Create simpler, more reliable policies for memories

-- Anyone in the community can view memories
CREATE POLICY "Community members can view memories"
ON public.memories
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM community_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.community_id = memories.community_id
    AND u.auth_user_id = auth.uid()
  )
);

-- Anyone in the community can create memories
CREATE POLICY "Community members can create memories"
ON public.memories
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM community_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.community_id = memories.community_id
    AND u.auth_user_id = auth.uid()
  )
);

-- Memory creator or community admin can update
CREATE POLICY "Creators and admins can update memories"
ON public.memories
FOR UPDATE
USING (
  created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  OR
  is_community_admin(community_id, auth.uid())
);

-- Memory creator or community admin can delete
CREATE POLICY "Creators and admins can delete memories"
ON public.memories
FOR DELETE
USING (
  created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  OR
  is_community_admin(community_id, auth.uid())
);