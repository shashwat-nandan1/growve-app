ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE public.profiles p
   SET onboarding_completed_at = now()
 WHERE onboarding_completed_at IS NULL
   AND (p.username IS NOT NULL OR EXISTS (SELECT 1 FROM public.habits h WHERE h.user_id = p.id));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Growve member'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;