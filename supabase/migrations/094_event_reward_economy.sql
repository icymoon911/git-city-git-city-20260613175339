-- ─── Event Reward Economy (3-rail, idempotent, audited) ─────
-- Generalizes the hardcoded single-duck grant into a professional
-- 3-rail system: participation / milestone / ranked. All grants flow
-- through a single idempotent claim ledger (claim_key UNIQUE) which is
-- simultaneously the dedup primitive AND the audit trail.
--
-- Rewards are config-driven via event_instances.rewards_config (jsonb).
-- Backward-compatible: events that only set {"gift_item": "..."} still
-- distribute via the participation rail.
--
-- Builds on 092 (keeps its idempotent damage log + cron lifecycle intact).

BEGIN;

-- ─── Item rarity (consistency with arcade_shop_items.rarity) ──
ALTER TABLE items ADD COLUMN IF NOT EXISTS rarity text
  CHECK (rarity IS NULL OR rarity IN ('common','rare','epic','legendary'));

-- ─── Relax the hardcoded tier CHECK — tiers are now config-driven ──
ALTER TABLE event_participations DROP CONSTRAINT IF EXISTS event_part_tier_valid;
ALTER TABLE event_participations ADD COLUMN IF NOT EXISTS flagged_outlier boolean NOT NULL DEFAULT false;

-- ─── Reward claim ledger: one immutable, idempotent row per grant ──
CREATE TABLE IF NOT EXISTS event_reward_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES event_instances(id) ON DELETE CASCADE,
  developer_id  bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  rail          text NOT NULL CHECK (rail IN ('participation','milestone','ranked')),
  tier          text NOT NULL,
  item_id       text REFERENCES items(id),
  xp_amount     int NOT NULL DEFAULT 0,
  claim_key     text NOT NULL,
  status        text NOT NULL DEFAULT 'granted' CHECK (status IN ('granted','claimed')),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  claimed_at    timestamptz,
  CONSTRAINT event_reward_claim_key_unique UNIQUE (claim_key)
);
CREATE INDEX IF NOT EXISTS idx_reward_claims_dev ON event_reward_claims(developer_id, status);
CREATE INDEX IF NOT EXISTS idx_reward_claims_event ON event_reward_claims(event_id);

ALTER TABLE event_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON event_reward_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON event_reward_claims TO anon, authenticated;
DROP POLICY IF EXISTS reward_claims_read ON event_reward_claims;
CREATE POLICY reward_claims_read ON event_reward_claims
  FOR SELECT TO anon, authenticated USING (true);

-- ─── grant_event_reward: idempotent + atomic + audited ──────
-- One row per (rail,tier) via deterministic claim_key. Re-runs and
-- double-fires are clean no-ops. Item + XP grant in the same transaction.
CREATE OR REPLACE FUNCTION grant_event_reward(
  p_event_id     uuid,
  p_developer_id bigint,
  p_rail         text,
  p_tier         text,
  p_item_id      text,
  p_xp           int,
  p_claim_key    text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_new uuid;
BEGIN
  -- Serialize a single player's concurrent claims (re-entrant within a tx).
  PERFORM pg_advisory_xact_lock(p_developer_id);

  INSERT INTO event_reward_claims
    (event_id, developer_id, rail, tier, item_id, xp_amount, claim_key, status)
  VALUES (p_event_id, p_developer_id, p_rail, p_tier, p_item_id, COALESCE(p_xp, 0), p_claim_key, 'granted')
  ON CONFLICT (claim_key) DO NOTHING
  RETURNING id INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  -- Grant the cosmetic (skips pre-owners via the partial unique completed idx).
  IF p_item_id IS NOT NULL AND p_item_id <> '' THEN
    INSERT INTO purchases (developer_id, item_id, provider, provider_tx_id, amount_cents, currency, status)
    SELECT p_developer_id, p_item_id, 'event', 'claim_' || p_claim_key, 0, 'usd', 'completed'
    WHERE NOT EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.developer_id = p_developer_id AND p.item_id = p_item_id AND p.status = 'completed'
    )
    ON CONFLICT (provider_tx_id) DO NOTHING;
  END IF;

  IF COALESCE(p_xp, 0) > 0 THEN
    PERFORM grant_xp(p_developer_id, 'event_reward', p_xp);
  END IF;

  RETURN jsonb_build_object('ok', true, 'granted', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_event_reward(uuid, bigint, text, text, text, int, text) FROM PUBLIC;

-- ─── complete_event_wrap: evaluate all 3 rails ──────────────
-- Replaces the 092 version. Reads rewards_config and grants per rail.
-- Backward compat: {"gift_item":"x"} → treated as participation item.
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
  v_outcome      text;
  v_cfg          jsonb;
  v_part         jsonb;
  v_milestones   jsonb;
  v_ranked       jsonb;
  v_min_damage   bigint;
  v_median       numeric;
  r              record;
  m              jsonb;
  rk             jsonb;
  v_ckey         text;
  v_ranked_tier  text;
  v_cut          int;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(damage_dealt), 0)
    INTO v_total, v_total_damage
  FROM event_participations WHERE event_id = p_event_id AND damage_dealt > 0;

  SELECT boss_max_hp, rewards_config INTO v_max_hp, v_cfg FROM event_instances WHERE id = p_event_id;
  v_outcome := CASE WHEN v_total_damage >= COALESCE(v_max_hp, 0) THEN 'victory' ELSE 'defeat' END;

  IF v_total = 0 THEN
    UPDATE event_instances SET status='archived', archived_at=now(),
      total_participants=0, total_damage=0, outcome=v_outcome WHERE id=p_event_id;
    RETURN json_build_object('ok', true, 'participants', 0, 'outcome', v_outcome);
  END IF;

  v_part       := v_cfg->'participation';
  v_milestones := v_cfg->'milestone'->'tiers';
  v_ranked     := v_cfg->'ranked'->'tiers';

  -- Backward compat: bare gift_item → participation rail
  IF v_part IS NULL AND (v_cfg ? 'gift_item') THEN
    v_part := jsonb_build_object('item_id', v_cfg->>'gift_item', 'xp', 50, 'min_damage', 1);
  END IF;
  v_min_damage := COALESCE((v_part->>'min_damage')::bigint, 1);

  -- Rank everyone (single set-based UPDATE)
  WITH ranked AS (
    SELECT developer_id, ROW_NUMBER() OVER (ORDER BY damage_dealt DESC) AS rn
    FROM event_participations WHERE event_id = p_event_id AND damage_dealt > 0
  )
  UPDATE event_participations ep SET final_rank = ranked.rn
  FROM ranked WHERE ep.event_id = p_event_id AND ep.developer_id = ranked.developer_id;

  -- Outlier flag (soft, for manual review — never blocks): damage > 5x median
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY damage_dealt)
    INTO v_median FROM event_participations WHERE event_id = p_event_id AND damage_dealt > 0;
  IF v_median IS NOT NULL AND v_median > 0 THEN
    UPDATE event_participations SET flagged_outlier = true
    WHERE event_id = p_event_id AND damage_dealt > 5 * v_median;
  END IF;

  -- Evaluate rails per participant
  FOR r IN
    SELECT developer_id, damage_dealt, final_rank
    FROM event_participations WHERE event_id = p_event_id AND damage_dealt > 0
    ORDER BY final_rank
  LOOP
    -- PARTICIPATION
    IF v_part IS NOT NULL AND r.damage_dealt >= v_min_damage THEN
      v_ckey := p_event_id::text || ':' || r.developer_id::text || ':participation';
      PERFORM grant_event_reward(p_event_id, r.developer_id, 'participation', 'participation',
        v_part->>'item_id', COALESCE((v_part->>'xp')::int, 0), v_ckey);
    END IF;

    -- MILESTONE (cumulative — all tiers at or below the player's damage)
    IF v_milestones IS NOT NULL AND jsonb_typeof(v_milestones) = 'array' THEN
      FOR m IN SELECT jsonb_array_elements(v_milestones) LOOP
        IF r.damage_dealt >= COALESCE((m->>'threshold')::bigint, 0) THEN
          v_ckey := p_event_id::text || ':' || r.developer_id::text || ':milestone:' || (m->>'id');
          PERFORM grant_event_reward(p_event_id, r.developer_id, 'milestone', m->>'id',
            m->>'item_id', COALESCE((m->>'xp')::int, 0), v_ckey);
        END IF;
      END LOOP;
    END IF;

    -- RANKED (best single tier; config ordered best-first)
    v_ranked_tier := NULL;
    IF v_ranked IS NOT NULL AND jsonb_typeof(v_ranked) = 'array' THEN
      FOR rk IN SELECT jsonb_array_elements(v_ranked) LOOP
        v_cut := GREATEST(
          COALESCE((rk->>'min_rank')::int, 0),
          CEIL(v_total * COALESCE((rk->>'cutoff_pct')::numeric, 0))::int
        );
        IF v_ranked_tier IS NULL AND r.final_rank <= v_cut THEN
          v_ranked_tier := rk->>'id';
          v_ckey := p_event_id::text || ':' || r.developer_id::text || ':ranked:' || (rk->>'id');
          PERFORM grant_event_reward(p_event_id, r.developer_id, 'ranked', rk->>'id',
            rk->>'item_id', COALESCE((rk->>'xp')::int, 0), v_ckey);
        END IF;
      END LOOP;
    END IF;

    -- Headline tier on the participation row
    UPDATE event_participations
      SET reward_tier = COALESCE(v_ranked_tier, 'bystander'),
          reward_item_id = COALESCE(v_ranked_tier, v_part->>'item_id'),
          reward_granted_at = now()
      WHERE event_id = p_event_id AND developer_id = r.developer_id;
  END LOOP;

  UPDATE event_instances SET status='archived', archived_at=now(),
    total_participants=v_total, total_damage=v_total_damage, outcome=v_outcome WHERE id=p_event_id;

  RETURN json_build_object('ok', true, 'participants', v_total, 'outcome', v_outcome);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_event_wrap(uuid) FROM PUBLIC;

COMMIT;
