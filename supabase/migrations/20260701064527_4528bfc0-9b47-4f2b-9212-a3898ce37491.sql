
-- Guard against reciprocal duplicate friendships for non-blocked rows
CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair_nonblocked
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
  WHERE status <> 'blocked';

-- Guard trigger: forbid new pending/accepted rows when a block exists either direction
CREATE OR REPLACE FUNCTION public.friendships_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'blocked' AND EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'blocked'
      AND ((requester_id = NEW.requester_id AND addressee_id = NEW.addressee_id)
        OR (requester_id = NEW.addressee_id AND addressee_id = NEW.requester_id))
  ) THEN
    RAISE EXCEPTION 'Cannot create friendship — a block is in place' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS friendships_guard_ins ON public.friendships;
CREATE TRIGGER friendships_guard_ins
BEFORE INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.friendships_guard();

-- Notifications: friend request + acceptance
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, payload)
    VALUES (NEW.addressee_id, NEW.requester_id, 'friend_request',
      jsonb_build_object('friendship_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS friendships_notify_insert ON public.friendships;
CREATE TRIGGER friendships_notify_insert
AFTER INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

CREATE OR REPLACE FUNCTION public.notify_friend_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, payload)
    VALUES (NEW.requester_id, NEW.addressee_id, 'friend_accepted',
      jsonb_build_object('friendship_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS friendships_notify_update ON public.friendships;
CREATE TRIGGER friendships_notify_update
AFTER UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_accept();

-- Update can_view_forest to respect blocks
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
    ELSE EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _owner
        AND (p.forest_visibility = 'public'
          OR (p.forest_visibility = 'friends' AND public.are_friends(_viewer, _owner)))
    )
  END;
$$;

-- Secure server function to fetch a visitable forest.
-- Returns only tree-rendering fields; habit name only when owner or habit is public.
CREATE OR REPLACE FUNCTION public.get_visible_forest(_owner_id uuid)
RETURNS TABLE (
  id uuid,
  position_x real,
  position_z real,
  rotation_y real,
  scale real,
  planted_at timestamptz,
  tree_species_id uuid,
  species_slug text,
  species_name text,
  habit_name text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_view_forest(v_uid, _owner_id) THEN
    RAISE EXCEPTION 'forest_not_visible' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      t.id,
      t.position_x,
      t.position_z,
      t.rotation_y,
      t.scale,
      t.planted_at,
      t.tree_species_id,
      ts.slug::text,
      ts.name::text,
      CASE
        WHEN v_uid = t.owner_id THEN h.name
        WHEN h.visibility = 'public' THEN h.name
        ELSE NULL
      END AS habit_name
    FROM public.forest_trees t
    JOIN public.tree_species ts ON ts.id = t.tree_species_id
    JOIN public.habit_logs hl ON hl.id = t.habit_log_id
    JOIN public.habits h ON h.id = hl.habit_id
    WHERE t.owner_id = _owner_id
    ORDER BY t.planted_at ASC;
END; $$;

REVOKE ALL ON FUNCTION public.get_visible_forest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_forest(uuid) TO authenticated;

-- Block / unblock helpers
CREATE OR REPLACE FUNCTION public.block_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR v_uid = _target THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Remove any pending/accepted friendship in either direction
  DELETE FROM public.friendships
   WHERE status <> 'blocked'
     AND ((requester_id = v_uid AND addressee_id = _target)
       OR (requester_id = _target AND addressee_id = v_uid));
  -- Upsert a directional block from viewer -> target
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_uid, _target, 'blocked')
  ON CONFLICT (requester_id, addressee_id)
  DO UPDATE SET status = 'blocked', responded_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_user(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.friendships
   WHERE status = 'blocked'
     AND requester_id = v_uid
     AND addressee_id = _target;
END; $$;

REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- Refine friendship UPDATE policy: only addressee accepts pending; blocker cannot flip via UPDATE
DROP POLICY IF EXISTS "Addressee responds to pending" ON public.friendships;
CREATE POLICY "Addressee accepts pending" ON public.friendships
FOR UPDATE TO authenticated
USING (auth.uid() = addressee_id AND status = 'pending')
WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted','pending'));

-- Ensure blocked rows cannot be deleted by the blockee
DROP POLICY IF EXISTS "Participants can cancel" ON public.friendships;
CREATE POLICY "Participants can cancel" ON public.friendships
FOR DELETE TO authenticated
USING (
  (status <> 'blocked' AND (auth.uid() = requester_id OR auth.uid() = addressee_id))
  OR (status = 'blocked' AND auth.uid() = requester_id)
);
