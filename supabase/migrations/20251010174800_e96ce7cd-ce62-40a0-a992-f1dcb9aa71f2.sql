-- Fix handle_new_user to mark app signups as claimed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_community_id uuid := 'b59aaee3-5e78-4daf-81ba-18f5e42156a1';
  invite_code_value text;
  target_community_id uuid;
  new_user_id uuid;
  user_name text;
BEGIN
  invite_code_value := NEW.raw_user_meta_data ->> 'invite_code';
  
  user_name := COALESCE(
    TRIM(CONCAT(
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
      ' ',
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
    )),
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name', 
    split_part(NEW.email, '@', 1),
    'User'
  );
  
  IF user_name = ' ' OR user_name = '' THEN
    user_name := COALESCE(
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'full_name', 
      split_part(NEW.email, '@', 1),
      'User'
    );
  END IF;
  
  -- Insert user with is_claimed = true for app signups
  INSERT INTO public.users (auth_user_id, name, username, email, is_claimed)
  VALUES (
    NEW.id, 
    user_name,
    NEW.raw_user_meta_data ->> 'username',
    NEW.email,
    true  -- Mark as claimed since they signed up through the app
  )
  RETURNING id INTO new_user_id;
  
  IF invite_code_value IS NOT NULL AND invite_code_value != '' THEN
    SELECT id INTO target_community_id 
    FROM public.communities 
    WHERE invite_code = invite_code_value;
    
    IF target_community_id IS NOT NULL THEN
      INSERT INTO public.community_members (community_id, user_id, role)
      VALUES (target_community_id, new_user_id, 'member');
    ELSE
      INSERT INTO public.community_members (community_id, user_id, role)
      VALUES (default_community_id, new_user_id, 'member');
    END IF;
  ELSE
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (default_community_id, new_user_id, 'member');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update all Edge City Patagonia users to claimed except Mariela
UPDATE public.users
SET is_claimed = true
WHERE id IN (
  SELECT cm.user_id 
  FROM community_members cm
  JOIN communities c ON cm.community_id = c.id
  WHERE c.name = 'Edge City Patagonia'
  AND cm.user_id NOT IN (
    SELECT id FROM users WHERE name = 'Mariela'
  )
);