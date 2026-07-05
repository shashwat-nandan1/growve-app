
-- 1) Deprecate forest_visibility: normalize values, change default
ALTER TABLE public.profiles ALTER COLUMN forest_visibility SET DEFAULT 'friends';
UPDATE public.profiles SET forest_visibility = 'friends' WHERE forest_visibility <> 'friends';

-- 2) can_view_forest: owner OR accepted friend, rejecting any block. Ignores forest_visibility.
CREATE OR REPLACE FUNCTION public.can_view_forest(_viewer uuid, _owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _viewer IS NULL THEN false
    WHEN _viewer = _owner THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'blocked'
        AND ((requester_id = _viewer AND addressee_id = _owner)
          OR (requester_id = _owner AND addressee_id = _viewer))
    ) THEN false
    ELSE public.are_friends(_viewer, _owner)
  END;
$$;

-- 3) ensure_profile: idempotent bootstrap from auth.users metadata
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;

-- 4) create_habit_with_auto_tree: single-transaction habit + auto species
CREATE OR REPLACE FUNCTION public.create_habit_with_auto_tree(
  _name text,
  _description text,
  _cadence public.habit_cadence,
  _target integer,
  _visibility public.habit_visibility,
  _start_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_species_id uuid;
  v_species_name text;
  v_habit public.habits%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name required' USING ERRCODE = '22023'; END IF;

  -- Concurrency guard: lock the user's profile row so parallel creates serialize.
  PERFORM 1 FROM public.profiles WHERE id = v_uid FOR UPDATE;

  -- Prefer a species this user has never used (including archived habits).
  SELECT ts.id, ts.name INTO v_species_id, v_species_name
  FROM public.tree_species ts
  WHERE ts.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.user_id = v_uid AND h.tree_species_id = ts.id
    )
  ORDER BY random()
  LIMIT 1;

  -- Fallback: least-used species overall for this user.
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
END; $$;
