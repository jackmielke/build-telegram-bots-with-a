-- Update the users table INSERT policy to allow admins to create unclaimed profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can insert their own profile" 
ON public.users 
FOR INSERT 
WITH CHECK (
  -- Regular users can only insert their own profile
  ((auth.uid() = auth_user_id) OR ((auth.uid() IS NOT NULL) AND (auth_user_id = auth.uid())))
  OR
  -- Admins can insert any profile (including unclaimed ones)
  (has_role(auth.uid(), 'admin'))
);