BEGIN;
-- Install before cleanup jobs; the lock also makes the initial snapshot gap-free.
LOCK TABLE prios IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS prio_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  operation text NOT NULL CHECK (operation IN ('BASELINE','INSERT','UPDATE','DELETE')),
  prio_id uuid NOT NULL,
  guild_id uuid,
  raid_id uuid NOT NULL,
  character_id uuid NOT NULL,
  source text NOT NULL,
  old_state jsonb,
  new_state jsonb
);
-- No cascading foreign keys: history must survive deletion of a raid/character.
CREATE INDEX IF NOT EXISTS prio_history_guild_raid ON prio_history(guild_id,raid_id,id DESC);
CREATE INDEX IF NOT EXISTS prio_history_character ON prio_history(character_id,id DESC);
CREATE INDEX IF NOT EXISTS prio_history_prio ON prio_history(prio_id,id DESC);
CREATE TABLE IF NOT EXISTS prio_history_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION prio_history_snapshot(row_data jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE result jsonb; metadata jsonb; previous jsonb;
BEGIN
  BEGIN metadata := (row_data->>'comment')::jsonb;
  EXCEPTION WHEN others THEN metadata := '{}'::jsonb; END;
  SELECT coalesce(new_state,old_state) INTO previous FROM prio_history
    WHERE prio_id=(row_data->>'id')::uuid ORDER BY id DESC LIMIT 1;
  SELECT jsonb_build_object(
    'guildId',coalesce(to_jsonb(r.guild_id),previous->'guildId'),
    'raidId',row_data->'raid_id','raidName',coalesce(to_jsonb(r.name),previous->'raidName'),
    'raidDate',coalesce(to_jsonb(r.raid_date),previous->'raidDate'),
    'raidTime',coalesce(to_jsonb(r.raid_time),previous->'raidTime'),
    'characterId',row_data->'character_id',
    'characterName',coalesce(to_jsonb(c.name),previous->'characterName'),
    'server',coalesce(to_jsonb(c.server),previous->'server'),
    'p1',jsonb_build_object('id',row_data->'p1_item_id','name',coalesce(to_jsonb(i1.name),CASE WHEN row_data->>'p1_item_id'=previous#>>'{p1,id}' THEN previous#>'{p1,name}' END)),
    'p2',jsonb_build_object('id',row_data->'p2_item_id','name',coalesce(to_jsonb(i2.name),CASE WHEN row_data->>'p2_item_id'=previous#>>'{p2,id}' THEN previous#>'{p2,name}' END)),
    'p3',jsonb_build_object('id',row_data->'p3_item_id','name',coalesce(to_jsonb(i3.name),CASE WHEN row_data->>'p3_item_id'=previous#>>'{p3,id}' THEN previous#>'{p3,name}' END)),
    'bench',row_data->'bench','createdAt',row_data->'created_at','updatedAt',row_data->'updated_at',
    'selection',jsonb_build_object('p0Selected',metadata->'p0Selected','p0Plus',metadata->'p0Plus','p0Item',metadata->'p0Item','source',metadata->'source')
  ) INTO result
  FROM (SELECT 1) anchor
  LEFT JOIN raids r ON r.id=(row_data->>'raid_id')::uuid
  LEFT JOIN characters c ON c.id=(row_data->>'character_id')::uuid
  LEFT JOIN items i1 ON i1.id=(row_data->>'p1_item_id')::uuid
  LEFT JOIN items i2 ON i2.id=(row_data->>'p2_item_id')::uuid
  LEFT JOIN items i3 ON i3.id=(row_data->>'p3_item_id')::uuid;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION record_prio_history() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE before_state jsonb; after_state jsonb; state jsonb; origin text;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_state := prio_history_snapshot(to_jsonb(OLD)); END IF;
  IF TG_OP <> 'DELETE' THEN after_state := prio_history_snapshot(to_jsonb(NEW)); END IF;
  state := coalesce(after_state,before_state);
  -- Only an explicit static label is retained, never SQL, PINs or request bodies.
  origin := substring(current_query() from '/\* prio-audit:([A-Za-z0-9_.-]+) \*/');
  INSERT INTO prio_history(operation,prio_id,guild_id,raid_id,character_id,source,old_state,new_state)
  VALUES(TG_OP,coalesce(NEW.id,OLD.id),(state->>'guildId')::uuid,
    (state->>'raidId')::uuid,(state->>'characterId')::uuid,
    coalesce(origin,'database_or_cascade'),before_state,after_state);
  RETURN coalesce(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS prio_history_change ON prios;
CREATE TRIGGER prio_history_change AFTER INSERT OR UPDATE OR DELETE ON prios
FOR EACH ROW EXECUTE FUNCTION record_prio_history();

-- Existing entries are a baseline, not evidence of historical save events.
INSERT INTO prio_history(operation,prio_id,guild_id,raid_id,character_id,source,new_state)
SELECT 'BASELINE',p.id,r.guild_id,p.raid_id,p.character_id,'initial_snapshot',prio_history_snapshot(to_jsonb(p))
FROM prios p LEFT JOIN raids r ON r.id=p.raid_id
WHERE NOT EXISTS(SELECT 1 FROM prio_history_installation);
INSERT INTO prio_history_installation(singleton) VALUES(true) ON CONFLICT DO NOTHING;
COMMIT;
