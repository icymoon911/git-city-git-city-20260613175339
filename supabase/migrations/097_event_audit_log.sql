-- ─── Event admin audit log + state machine guard ───────────
-- Append-only record of who changed what (multi-admin safety + "what did
-- I do at 3am" for solo). Plus a guard trigger enforcing field-locking and
-- terminal-status immutability — the invariant layer the research flagged.

BEGIN;

CREATE TABLE IF NOT EXISTS event_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid REFERENCES event_instances(id) ON DELETE SET NULL,
  actor       text NOT NULL,            -- admin github_login / 'system'
  action      text NOT NULL,            -- create | start | end | cancel | edit
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_audit_event ON event_audit_log(event_id, created_at DESC);

ALTER TABLE event_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON event_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON event_audit_log TO authenticated;
DROP POLICY IF EXISTS event_audit_read ON event_audit_log;
CREATE POLICY event_audit_read ON event_audit_log
  FOR SELECT TO authenticated USING (true);

-- ─── State machine guard: field-locking + terminal immutability ──
CREATE OR REPLACE FUNCTION event_instances_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Start time & boss config freeze once the event leaves editable states.
  IF OLD.status NOT IN ('scheduled') THEN
    IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
       OR NEW.boss_max_hp IS DISTINCT FROM OLD.boss_max_hp THEN
      RAISE EXCEPTION 'event %: start/boss config is locked once live', OLD.id;
    END IF;
  END IF;
  -- Terminal states are immutable.
  IF OLD.status = 'archived' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'event %: archived status is immutable', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_instances_guard ON event_instances;
CREATE TRIGGER trg_event_instances_guard
  BEFORE UPDATE ON event_instances
  FOR EACH ROW EXECUTE FUNCTION event_instances_guard();

COMMIT;
