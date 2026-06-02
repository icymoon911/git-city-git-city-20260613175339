-- ─── Bug Invasion Live Event System ────────────────────────
-- Server-authoritative live boss event.
-- Boss HP lives in PartyKit (real-time). This schema persists the
-- event config, per-player damage tallies (for rewards/leaderboard),
-- and a forensic damage log (idempotency + anti-cheat audit).
--
-- Damage is credited in CHUNKS via HMAC-signed tokens issued by the
-- PartyKit server (mirrors the Force Push kill-token pattern). The DB
-- never trusts a raw client amount — only token-validated chunks.
--
-- Also seeds the "companion_duck" cosmetic — the participation gift.

BEGIN;

-- ─── Event instances ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  kind            text NOT NULL DEFAULT 'boss_raid',
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'scheduled',
  boss_max_hp     bigint NOT NULL DEFAULT 50000,
  -- Brand-swappable config blobs (theme, boss params, reward tiers)
  theme_config    jsonb NOT NULL DEFAULT '{}'::jsonb,
  boss_config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewards_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Sponsor (null = house event)
  sponsor_brand          text,
  sponsor_advertiser_id  text,
  -- Aggregates
  outcome             text,
  total_participants  int NOT NULL DEFAULT 0,
  total_damage        bigint NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  archived_at         timestamptz,
  CONSTRAINT event_status_valid CHECK (status IN ('scheduled','live','wrap','archived')),
  CONSTRAINT event_window_valid CHECK (ends_at > starts_at),
  CONSTRAINT event_outcome_valid CHECK (outcome IS NULL OR outcome IN ('victory','defeat'))
);

CREATE INDEX IF NOT EXISTS idx_event_instances_status
  ON event_instances(status) WHERE status IN ('scheduled','live','wrap');
CREATE INDEX IF NOT EXISTS idx_event_instances_starts
  ON event_instances(starts_at);

-- ─── Per-player participation tally ─────────────────────────
CREATE TABLE IF NOT EXISTS event_participations (
  event_id          uuid NOT NULL REFERENCES event_instances(id) ON DELETE CASCADE,
  developer_id      bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  damage_dealt      bigint NOT NULL DEFAULT 0,
  minions_killed    int NOT NULL DEFAULT 0,
  deaths            int NOT NULL DEFAULT 0,
  joined_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  final_rank        int,
  reward_tier       text,
  reward_item_id    text,
  reward_granted_at timestamptz,
  PRIMARY KEY (event_id, developer_id),
  CONSTRAINT event_part_damage_nonneg CHECK (damage_dealt >= 0),
  CONSTRAINT event_part_tier_valid CHECK (reward_tier IS NULL OR reward_tier IN ('bystander','combatant','slayer'))
);

CREATE INDEX IF NOT EXISTS idx_event_part_leaderboard
  ON event_participations(event_id, damage_dealt DESC);

-- ─── Append-only damage log (idempotency + forensics) ───────
CREATE TABLE IF NOT EXISTS event_damage_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES event_instances(id) ON DELETE CASCADE,
  developer_id  bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  amount        bigint NOT NULL,
  minions       int NOT NULL DEFAULT 0,
  source        text NOT NULL DEFAULT 'boss_shot',
  damage_token  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_damage_amount_bounds CHECK (amount > 0 AND amount <= 100000),
  CONSTRAINT event_damage_token_nonempty CHECK (damage_token <> ''),
  CONSTRAINT event_damage_token_unique UNIQUE (damage_token)
);

CREATE INDEX IF NOT EXISTS idx_event_damage_event ON event_damage_log(event_id, created_at);

-- ─── Access control ─────────────────────────────────────────
-- event_instances + participations: public READ (event card + leaderboard).
-- Writes go only through SECURITY DEFINER RPCs called by the admin client.
-- damage_log: fully locked (forensic).
ALTER TABLE event_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_damage_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON event_instances FROM PUBLIC, anon, authenticated;
REVOKE ALL ON event_participations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON event_damage_log FROM PUBLIC, anon, authenticated;

GRANT SELECT ON event_instances TO anon, authenticated;
GRANT SELECT ON event_participations TO anon, authenticated;

DROP POLICY IF EXISTS event_instances_read ON event_instances;
CREATE POLICY event_instances_read ON event_instances
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS event_participations_read ON event_participations;
CREATE POLICY event_participations_read ON event_participations
  FOR SELECT TO anon, authenticated USING (true);

-- ─── RPC: register participation (idempotent) ───────────────
CREATE OR REPLACE FUNCTION register_event_participation(
  p_event_id     uuid,
  p_developer_id bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO event_participations (event_id, developer_id)
  VALUES (p_event_id, p_developer_id)
  ON CONFLICT (event_id, developer_id) DO UPDATE SET last_seen_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION register_event_participation(uuid, bigint) FROM PUBLIC;

-- ─── RPC: credit damage chunk (token-idempotent) ────────────
-- Called by /api/events/credit-damage after validating an HMAC token.
-- Accumulates damage onto the participation; never decrements boss HP
-- (PartyKit is authoritative for the live HP).
CREATE OR REPLACE FUNCTION credit_event_damage(
  p_event_id     uuid,
  p_developer_id bigint,
  p_amount       bigint,
  p_minions      int,
  p_source       text,
  p_token        text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inserted uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 512 THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  -- Idempotency: damage_token is unique. Replays are no-ops.
  INSERT INTO event_damage_log (event_id, developer_id, amount, minions, source, damage_token)
  VALUES (p_event_id, p_developer_id, p_amount, COALESCE(p_minions, 0), COALESCE(p_source, 'boss_shot'), p_token)
  ON CONFLICT (damage_token) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'already_credited');
  END IF;

  -- Accumulate onto the player's OWN row only. We intentionally do NOT
  -- update event_instances.total_damage here — that would serialize every
  -- concurrent player on a single hot row. total_damage is computed once
  -- at wrap time via SUM(damage_dealt).
  INSERT INTO event_participations (event_id, developer_id, damage_dealt, minions_killed)
  VALUES (p_event_id, p_developer_id, p_amount, COALESCE(p_minions, 0))
  ON CONFLICT (event_id, developer_id) DO UPDATE
    SET damage_dealt   = event_participations.damage_dealt + p_amount,
        minions_killed = event_participations.minions_killed + COALESCE(p_minions, 0),
        last_seen_at   = now();

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION credit_event_damage(uuid, bigint, bigint, int, text, text) FROM PUBLIC;

-- ─── RPC: complete event wrap (rank + tier + reward grant) ──
-- Called by the lifecycle cron when an event window closes.
-- Computes ranks, assigns tiers, grants the gift item to every
-- participant (idempotent), and credits event XP proportional to damage.
CREATE OR REPLACE FUNCTION complete_event_wrap(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total        int;
  v_total_damage bigint;
  v_max_hp       bigint;
  v_reward_item  text;
  v_slayer_cut   int;
  v_combat_cut   int;
  v_outcome      text;
  r              record;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(damage_dealt), 0)
    INTO v_total, v_total_damage
  FROM event_participations
  WHERE event_id = p_event_id AND damage_dealt > 0;

  SELECT boss_max_hp, COALESCE(rewards_config->>'gift_item', 'companion_duck')
    INTO v_max_hp, v_reward_item
  FROM event_instances WHERE id = p_event_id;

  -- Outcome is derived from collective damage vs the boss HP pool.
  v_outcome := CASE WHEN v_total_damage >= COALESCE(v_max_hp, 0) THEN 'victory' ELSE 'defeat' END;

  IF v_total = 0 THEN
    UPDATE event_instances
      SET status = 'archived', archived_at = now(),
          total_participants = 0, total_damage = 0, outcome = v_outcome
      WHERE id = p_event_id;
    RETURN json_build_object('ok', true, 'participants', 0, 'outcome', v_outcome);
  END IF;

  v_slayer_cut := GREATEST(1, (v_total * 0.10)::int);
  v_combat_cut := GREATEST(1, (v_total * 0.50)::int);

  -- 1. Rank + tier + reward in a SINGLE set-based UPDATE (no per-row loop).
  WITH ranked AS (
    SELECT developer_id,
           ROW_NUMBER() OVER (ORDER BY damage_dealt DESC) AS rn
    FROM event_participations
    WHERE event_id = p_event_id AND damage_dealt > 0
  )
  UPDATE event_participations ep
    SET final_rank = ranked.rn,
        reward_tier = CASE
          WHEN ranked.rn <= v_slayer_cut THEN 'slayer'
          WHEN ranked.rn <= v_combat_cut THEN 'combatant'
          ELSE 'bystander' END,
        reward_item_id = v_reward_item,
        reward_granted_at = now()
  FROM ranked
  WHERE ep.event_id = p_event_id AND ep.developer_id = ranked.developer_id;

  -- 2. Gift the item to every participant who does NOT already own it.
  --    WHERE NOT EXISTS respects the partial unique index
  --    idx_purchases_unique_completed(developer_id,item_id) WHERE status='completed'
  --    so re-runs and pre-owners never raise a conflict. ON CONFLICT on the
  --    per-event tx id makes a re-run a clean no-op too.
  INSERT INTO purchases (developer_id, item_id, provider, provider_tx_id, amount_cents, currency, status)
  SELECT ep.developer_id, v_reward_item, 'event',
         'event_' || p_event_id::text || '_' || ep.developer_id::text,
         0, 'usd', 'completed'
  FROM event_participations ep
  WHERE ep.event_id = p_event_id AND ep.damage_dealt > 0
    AND NOT EXISTS (
      SELECT 1 FROM purchases p2
      WHERE p2.developer_id = ep.developer_id
        AND p2.item_id = v_reward_item
        AND p2.status = 'completed'
    )
  ON CONFLICT (provider_tx_id) DO NOTHING;

  -- 3. Event XP per participant. grant_xp has per-developer side effects
  --    (level recompute + xp_log insert) so it must run per row. Touches
  --    each developer's own row only — no shared-row contention. For very
  --    large events this is the slowest step; acceptable as a one-shot wrap.
  FOR r IN
    SELECT developer_id, damage_dealt
    FROM event_participations
    WHERE event_id = p_event_id AND damage_dealt > 0
  LOOP
    PERFORM grant_xp(r.developer_id, 'event_boss_raid', LEAST(1000, GREATEST(10, (r.damage_dealt / 50)::int)));
  END LOOP;

  UPDATE event_instances
    SET status = 'archived', archived_at = now(),
        total_participants = v_total, total_damage = v_total_damage, outcome = v_outcome
    WHERE id = p_event_id;

  RETURN json_build_object('ok', true, 'participants', v_total, 'outcome', v_outcome, 'reward_item', v_reward_item);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_event_wrap(uuid) FROM PUBLIC;

-- ─── Retention helper for the append-only damage log ───────
CREATE OR REPLACE FUNCTION event_damage_log_prune(p_keep_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM event_damage_log
  WHERE created_at < (now() - make_interval(days => p_keep_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION event_damage_log_prune(integer) FROM PUBLIC;

-- ─── Seed: Companion Duck cosmetic (the participation gift) ──
-- A crown-zone pet that orbits your building. Granted free to every
-- Bug Invasion participant. Also purchasable in the shop afterwards.
INSERT INTO items (id, category, name, description, price_usd_cents, price_brl_cents, zone, metadata, is_active, price_pixels)
VALUES (
  'companion_duck',
  'structure',
  'Companion Duck',
  'A loyal rubber duck that orbits your building. Earned by defending Git City during a Bug Invasion.',
  300, 1490, 'crown', '{"event_reward": true}'::jsonb, true, 300
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
