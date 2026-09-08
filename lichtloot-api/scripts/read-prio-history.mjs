// Server-side support tool: DATABASE_URL is required; no public history endpoint.
import 'dotenv/config';
import {pool,query} from '../src/db.js';
const [guildId,characterName,raidId]=process.argv.slice(2);
if(!guildId||!characterName){console.error('Usage: node scripts/read-prio-history.mjs <guild UUID> <character name> [raid UUID]');process.exitCode=1;}
else try {
  const result=await query(`select id,recorded_at,operation,source,prio_id,old_state,new_state
    from prio_history where guild_id=$1
      and (lower(old_state->>'characterName')=lower($2) or lower(new_state->>'characterName')=lower($2))
      and ($3::uuid is null or raid_id=$3::uuid)
    order by id desc limit 500`,[guildId,characterName,raidId||null]);
  console.log(JSON.stringify(result.rows,null,2));
}finally{await pool.end();}
