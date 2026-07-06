
-- Make `_description` optional so callers can omit it entirely.
DROP FUNCTION IF EXISTS public.create_habit_with_auto_tree(text, text, habit_cadence, integer, habit_visibility, date);

CREATE OR REPLACE FUNCTION public.create_habit_with_auto_tree(
  _name text,
  _cadence habit_cadence,
  _target integer,
  _visibility habit_visibility,
  _start_date date,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_species_id uuid;
  v_species_name text;
  v_habit public.habits%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name required' USING ERRCODE = '22023'; END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_uid FOR UPDATE;

  SELECT ts.id, ts.name INTO v_species_id, v_species_name
  FROM public.tree_species ts
  WHERE ts.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.user_id = v_uid AND h.tree_species_id = ts.id
    )
  ORDER BY random()
  LIMIT 1;

  IF v_species_id IS NULL THEN
    SELECT ts.id, ts.name INTO v_species_id, v_species_name
    FROM public.tree_species ts
    LEFT JOIN public.habits h ON h.tree_species_id = ts.id AND h.user_id = v_uid
    WHERE ts.is_active = true
    GROUP BY ts.id, ts.name
    ORDER BY COUNT(h.id) ASC, random()
    LIMIT 1;
  END IF;

  IF v_species_id IS NULL THEN
    RAISE EXCEPTION 'No tree species available' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.habits (
    user_id, name, description, cadence, target_per_period,
    tree_species_id, visibility, start_date
  ) VALUES (
    v_uid,
    btrim(_name),
    NULLIF(btrim(COALESCE(_description, '')), ''),
    _cadence,
    CASE WHEN _cadence = 'weekly' THEN GREATEST(1, LEAST(7, COALESCE(_target, 1))) ELSE 1 END,
    v_species_id,
    COALESCE(_visibility, 'public'::public.habit_visibility),
    COALESCE(_start_date, CURRENT_DATE)
  ) RETURNING * INTO v_habit;

  RETURN jsonb_build_object(
    'habit', to_jsonb(v_habit),
    'species', jsonb_build_object('id', v_species_id, 'name', v_species_name)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_habit_with_auto_tree(text, habit_cadence, integer, habit_visibility, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_habit_with_auto_tree(text, habit_cadence, integer, habit_visibility, date, text) TO authenticated;

-- Refresh ensure_profile: idempotent, preserves user-edited display_name/bio.
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles%ROWTYPE;
  v_meta jsonb;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN RETURN v_row; END IF;
  SELECT raw_user_meta_data, email INTO v_meta, v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    v_uid,
    COALESCE(v_meta->>'full_name', v_meta->>'name', NULLIF(split_part(COALESCE(v_email, ''), '@', 1), ''), 'Growve member'),
    COALESCE(v_meta->>'avatar_url', v_meta->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO v_row FROM public.profiles WHERE id = v_uid;
  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
