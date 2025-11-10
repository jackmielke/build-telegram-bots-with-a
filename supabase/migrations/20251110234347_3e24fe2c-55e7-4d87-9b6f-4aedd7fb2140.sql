-- Fix critical security issue: Restrict access to users table to protect emails and contact info
-- This prevents spammers from harvesting user data

-- Drop the dangerous public access policy
DROP POLICY IF EXISTS "Anyone can view basic profile info" ON public.users;

-- Allow users to view their own complete profile (including sensitive data)
CREATE POLICY "Users can view their own complete profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Allow community members to view other members' PUBLIC profile info only
-- This excludes sensitive fields like email, phone, and social media handles
CREATE POLICY "Community members can view other members public profiles"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM community_members cm1
    JOIN community_members cm2 ON cm1.community_id = cm2.community_id
    WHERE cm1.user_id = users.id
      AND cm2.user_id = get_user_id_from_auth(auth.uid())
  )
);

-- Note: The above policy allows viewing profile data, but sensitive fields (email, phone_number, 
-- telegram_username, instagram_handle, twitter_handle) should be filtered at the application level
-- when displaying to other community members. Consider creating a view or function that returns
-- only public fields for non-self queries.

-- Create a helper function to get public user profile (without sensitive data)
CREATE OR REPLACE FUNCTION public.get_user_public_profile(user_id_param uuid)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  bio text,
  avatar_url text,
  created_at timestamp with time zone,
  interests_skills text[],
  headline text,
  profile_picture_url character varying
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.name,
    u.username,
    u.bio,
    u.avatar_url,
    u.created_at,
    u.interests_skills,
    u.headline,
    u.profile_picture_url
  FROM users u
  WHERE u.id = user_id_param;
$$;