import { buildPlayerAnalysis } from './model.js';
export async function getStoredPlayerAnalysis({query,guildId,params}) {
  // Validate before performing any database work.
  buildPlayerAnalysis([], {playerName:params.playerName,server:params.server});
  const result=await query(`
    select la.id, la.raid, la.raid_date, la.report_code, c.payload, c.generated_at
    from log_analysis_web_cache c
    join log_analyses la on la.id=c.analysis_id
    where la.guild_id=$1
      and exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(c.payload->'players')='array' then c.payload->'players' else '[]'::jsonb end
        ) p
        where lower(btrim(p->>'name'))=lower($2)
          and lower(btrim(p->>'server'))=lower($3)
      )
    order by la.raid_date desc nulls last, c.generated_at desc
  `,[guildId,String(params.playerName).trim().normalize('NFC'),String(params.server).trim().normalize('NFC')]);
  return {success:true,...buildPlayerAnalysis(result.rows,params)};
}
