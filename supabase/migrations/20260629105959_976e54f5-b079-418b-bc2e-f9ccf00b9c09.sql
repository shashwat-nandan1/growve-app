
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE public.forest_visibility AS ENUM ('private', 'friends', 'public');
CREATE TYPE public.habit_cadence AS ENUM ('daily', 'weekly');
CREATE TYPE public.habit_visibility AS ENUM ('public', 'private');
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username CITEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  forest_seed BIGINT NOT NULL DEFAULT (floor(random() * 9223372036854775806)::BIGINT),
  forest_visibility public.forest_visibility NOT NULL DEFAULT 'friends',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  reduced_motion BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_unique ON public.profiles (username) WHERE username IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.tree_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  model_url TEXT,
  thumbnail_url TEXT,
  base_scale REAL NOT NULL DEFAULT 1.0,
  biome TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tree_species TO authenticated;
GRANT ALL ON public.tree_species TO service_role;
ALTER TABLE public.tree_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tree species readable" ON public.tree_species FOR SELECT TO authenticated USING (is_active);

CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cadence public.habit_cadence NOT NULL DEFAULT 'daily',
  target_per_period INTEGER NOT NULL DEFAULT 1 CHECK (target_per_period >= 1),
  tree_species_id UUID NOT NULL REFERENCES public.tree_species(id),
  visibility public.habit_visibility NOT NULL DEFAULT 'private',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX habits_user_id_idx ON public.habits(user_id);
CREATE INDEX habits_user_archived_idx ON public.habits(user_id, is_archived);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habits" ON public.habits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER habits_updated_at BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  local_date DATE NOT NULL,
  cycle_start DATE NOT NULL,
  occurrence_index INTEGER NOT NULL,
  client_request_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX habit_logs_user_idx ON public.habit_logs(user_id);
CREATE INDEX habit_logs_habit_idx ON public.habit_logs(habit_id);
CREATE INDEX habit_logs_habit_cycle_idx ON public.habit_logs(habit_id, cycle_start);
CREATE INDEX habit_logs_local_date_idx ON public.habit_logs(user_id, local_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_logs TO authenticated;
GRANT ALL ON public.habit_logs TO service_role;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own logs" ON public.habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own logs" ON public.habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.forest_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_log_id UUID NOT NULL UNIQUE REFERENCES public.habit_logs(id) ON DELETE CASCADE,
  tree_species_id UUID NOT NULL REFERENCES public.tree_species(id),
  position_x REAL NOT NULL,
  position_z REAL NOT NULL,
  rotation_y REAL NOT NULL DEFAULT 0,
  scale REAL NOT NULL DEFAULT 1,
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  planted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX forest_trees_owner_idx ON public.forest_trees(owner_id);
CREATE INDEX forest_trees_planted_idx ON public.forest_trees(owner_id, planted_at DESC);
CREATE INDEX forest_trees_chunk_idx ON public.forest_trees(owner_id, chunk_x, chunk_z);
GRANT SELECT, DELETE ON public.forest_trees TO authenticated;
GRANT ALL ON public.forest_trees TO service_role;
ALTER TABLE public.forest_trees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX friendships_requester_idx ON public.friendships(requester_id);
CREATE INDEX friendships_addressee_idx ON public.friendships(addressee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Requester creates friendship" ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressee responds to pending" ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = addressee_id AND status = 'pending') WITH CHECK (auth.uid() = addressee_id);
CREATE POLICY "Participants can cancel" ON public.friendships FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a)));
$$;

CREATE OR REPLACE FUNCTION public.can_view_forest(_viewer UUID, _owner UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _viewer = _owner THEN true
    ELSE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner
      AND (p.forest_visibility = 'public' OR (p.forest_visibility = 'friends' AND public.are_friends(_viewer, _owner))))
  END;
$$;

CREATE POLICY "Forest trees viewable by allowed viewers" ON public.forest_trees
  FOR SELECT TO authenticated USING (public.can_view_forest(auth.uid(), owner_id));

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipient reads notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Recipient updates notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Recipient deletes notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_habit_completion(_habit_id UUID, _client_request_id UUID, _local_date DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_habit public.habits%ROWTYPE;
  v_cycle_start DATE;
  v_existing_log public.habit_logs%ROWTYPE;
  v_count INTEGER;
  v_occurrence INTEGER;
  v_log public.habit_logs%ROWTYPE;
  v_tree public.forest_trees%ROWTYPE;
  v_seed BIGINT;
  v_seq BIGINT;
  v_angle DOUBLE PRECISION;
  v_radius DOUBLE PRECISION;
  v_x REAL; v_z REAL; v_rot REAL; v_scale REAL;
  v_min_radius CONSTANT DOUBLE PRECISION := 6.0;
  v_ring_width CONSTANT DOUBLE PRECISION := 40.0;
  v_chunk_size CONSTANT INTEGER := 16;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_existing_log FROM public.habit_logs WHERE client_request_id = _client_request_id;
  IF FOUND THEN
    IF v_existing_log.user_id <> v_uid THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
    SELECT * INTO v_tree FROM public.forest_trees WHERE habit_log_id = v_existing_log.id;
    RETURN jsonb_build_object('log', to_jsonb(v_existing_log), 'tree', to_jsonb(v_tree), 'duplicate', true);
  END IF;

  SELECT * INTO v_habit FROM public.habits WHERE id = _habit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Habit not found' USING ERRCODE = 'P0002'; END IF;
  IF v_habit.user_id <> v_uid THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  IF v_habit.is_archived THEN RAISE EXCEPTION 'Habit is archived' USING ERRCODE = '22023'; END IF;

  IF v_habit.cadence = 'daily' THEN
    v_cycle_start := _local_date;
  ELSE
    v_cycle_start := _local_date - ((EXTRACT(ISODOW FROM _local_date)::INTEGER - 1));
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.habit_logs
    WHERE habit_id = _habit_id AND cycle_start = v_cycle_start;

  IF v_habit.cadence = 'daily' AND v_count >= 1 THEN
    RAISE EXCEPTION 'Already completed today' USING ERRCODE = '23505';
  END IF;
  IF v_habit.cadence = 'weekly' AND v_count >= v_habit.target_per_period THEN
    RAISE EXCEPTION 'Weekly target reached' USING ERRCODE = '23514';
  END IF;
  v_occurrence := v_count + 1;

  INSERT INTO public.habit_logs (habit_id, user_id, local_date, cycle_start, occurrence_index, client_request_id)
  VALUES (_habit_id, v_uid, _local_date, v_cycle_start, v_occurrence, _client_request_id)
  RETURNING * INTO v_log;

  SELECT forest_seed INTO v_seed FROM public.profiles WHERE id = v_uid;
  SELECT COUNT(*) INTO v_seq FROM public.forest_trees WHERE owner_id = v_uid;
  v_seq := v_seq + 1;

  v_angle := (abs(hashtextextended(v_seed::text || ':a:' || v_seq::text, 0)) % 360000)::DOUBLE PRECISION / 1000.0 * pi() / 180.0;
  v_radius := v_min_radius + ((abs(hashtextextended(v_seed::text || ':r:' || v_seq::text, 0)) % 100000)::DOUBLE PRECISION / 100000.0) * v_ring_width;
  v_x := (v_radius * cos(v_angle))::REAL;
  v_z := (v_radius * sin(v_angle))::REAL;
  v_rot := ((abs(hashtextextended(v_seed::text || ':rot:' || v_seq::text, 0)) % 360000)::DOUBLE PRECISION / 1000.0)::REAL;
  v_scale := (0.85 + ((abs(hashtextextended(v_seed::text || ':s:' || v_seq::text, 0)) % 1000)::DOUBLE PRECISION / 1000.0) * 0.3)::REAL;

  INSERT INTO public.forest_trees (owner_id, habit_log_id, tree_species_id, position_x, position_z, rotation_y, scale, chunk_x, chunk_z)
  VALUES (v_uid, v_log.id, v_habit.tree_species_id, v_x, v_z, v_rot, v_scale,
    floor(v_x / v_chunk_size)::INTEGER, floor(v_z / v_chunk_size)::INTEGER)
  RETURNING * INTO v_tree;

  RETURN jsonb_build_object('log', to_jsonb(v_log), 'tree', to_jsonb(v_tree), 'duplicate', false);
END; $$;
REVOKE ALL ON FUNCTION public.log_habit_completion(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_habit_completion(UUID, UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.undo_habit_log(_log_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_log public.habit_logs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_log FROM public.habit_logs WHERE id = _log_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_log.user_id <> v_uid THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.forest_trees WHERE habit_log_id = _log_id;
  DELETE FROM public.habit_logs WHERE id = _log_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.undo_habit_log(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_habit_log(UUID) TO authenticated;
