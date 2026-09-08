BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS p0plus_notice_audit_unique ON bot_update_queue ((payload->>'auditId')) WHERE type='p0plus_points_notice';
CREATE OR REPLACE FUNCTION queue_p0plus_player_notice() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient text; raid_label text; day text; raid_time_value text;
BEGIN
  IF NEW.action NOT IN ('raid_transfer','item_received_clear') OR NEW.character_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action='raid_transfer' AND NEW.delta_points<=0 THEN RETURN NEW; END IF;
  SELECT d.discord_user_id INTO recipient FROM discord_player_links d
    JOIN characters linked ON linked.id=d.character_id
    JOIN characters target ON target.id=NEW.character_id AND target.player_id=linked.player_id
    WHERE d.guild_id=NEW.guild_id
    ORDER BY (d.character_id=NEW.character_id) DESC,d.updated_at DESC LIMIT 1;
  SELECT name,raid_date::text,raid_time INTO raid_label,day,raid_time_value FROM raids WHERE id=NEW.raid_id AND guild_id=NEW.guild_id;
  INSERT INTO bot_update_queue(guild_id,type,status,payload)
  VALUES(NEW.guild_id,'p0plus_points_notice',CASE WHEN recipient IS NULL THEN 'failed' ELSE 'open' END,
    jsonb_build_object('auditId',NEW.id,'discordUserId',recipient,'player',NEW.player_name,'server',NEW.server,
      'raidName',coalesce(raid_label,NEW.raid_type),'raidDate',day,'raidTime',raid_time_value,'item',NEW.item_name,
      'event',NEW.action,'points',NEW.delta_points,'oldPoints',NEW.old_points,'newPoints',NEW.new_points,
      'failureReason',CASE WHEN recipient IS NULL THEN 'Kein verknüpftes Discord-Konto für diesen Spieler.' ELSE null END))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS p0plus_player_notice ON p0plus_point_audit;
CREATE TRIGGER p0plus_player_notice AFTER INSERT ON p0plus_point_audit FOR EACH ROW EXECUTE FUNCTION queue_p0plus_player_notice();
COMMIT;
