-- Safe fix: redefine function without changing signature, avoid dropping dependencies
CREATE OR REPLACE FUNCTION public.get_user_id_from_auth(auth_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id ALIAS FOR $1;
  v_user_id uuid;
BEGIN
  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE u.auth_user_id = v_auth_user_id;
  RETURN v_user_id;
END;
$$;

-- Recreate users INSERT policy to correctly allow admins
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
WITH CHECK (
  (auth.uid() = auth_user_id)
  OR public.has_role(public.get_user_id_from_auth(auth.uid()), 'admin')
);

-- Recreate admins update policy with correct mapping
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles"
ON public.users
FOR UPDATE
USING (public.has_role(public.get_user_id_from_auth(auth.uid()), 'admin'))
WITH CHECK (public.has_role(public.get_user_id_from_auth(auth.uid()), 'admin'));
