import {createHash} from 'node:crypto';

export const receiptKey = (sessionId, id) => sessionId && id
  ? createHash('sha256').update(JSON.stringify([String(sessionId), String(id)])).digest('hex') : '';
const fail = (message, statusCode=400) => Object.assign(new Error(message), {statusCode});
const clean = value => String(value ?? '').normalize('NFC').trim();
export function assignmentInput(body) {
  const key=clean(body.receiptKey), revision=Number(body.revision);
  if(!/^[a-f0-9]{64}$/.test(key) || !Number.isSafeInteger(revision) || revision<0) throw fail('Ungültiger Looteintrag. Bitte neu laden.');
  const characterId=clean(body.characterId), name=clean(body.name), server=clean(body.server);
  if(characterId && !/^[a-f0-9-]{36}$/i.test(characterId)) throw fail('Ungültiger Spieler.');
  if(body.clear!==true && !characterId && (!name || name.length>80 || server.length>80 || /[\u0000-\u001f\u007f]/.test(name+server))) throw fail('Bitte einen gültigen Spielernamen eingeben (maximal 80 Zeichen).');
  return {key,revision,characterId,name,server,clear:body.clear===true};
}
export const assignmentSchema = `
create table if not exists raid_loot_assignments (
 guild_id uuid not null references guilds(id), raid_id uuid not null references raids(id), receipt_key text not null,
 character_id uuid, player_name text not null default '', server text not null default '',
 revision integer not null default 1, updated_at timestamptz not null default now(),
 primary key(guild_id,raid_id,receipt_key)
);
create table if not exists raid_loot_assignment_history (
 id bigserial primary key, guild_id uuid not null, raid_id uuid not null, receipt_key text not null,
 character_id uuid, player_name text not null, server text not null, revision integer not null,
 changed_at timestamptz not null default now(), changed_by text not null default 'Gildenleitung'
);`;

export function installRaidLootAssignments(app,{pool,query,requireGuild,resolveGuildSlug,authorize}) {
 let schema;
 const ensure=()=>schema ||= query(assignmentSchema).catch(error=>{schema=null;throw error;});
 app.post('/api/leadership/raid-archive',async(req,res,next)=>{
  try {
   const body=req.body||{}, guild=await requireGuild(resolveGuildSlug(body.guild));
   await authorize(guild,body.masterCode);
   res.setHeader('Cache-Control','no-store');
   if(body.action==='access')return res.json({success:true});
   if(body.action==='players') {
    const term=clean(body.search).slice(0,80);
    const found=await query(`select c.id,c.name,coalesce(c.server,'') as server,coalesce(c.class_name,'') as "className"
     from characters c join players p on p.id=c.player_id where p.guild_id=$1
     and strpos(lower(c.name||' '||coalesce(c.server,'')),lower($2))>0 order by c.name,c.server,c.id limit 30`,[guild.id,term]);
    return res.json({success:true,players:found.rows});
   }
   if(body.action!=='assign')throw fail('Unbekannte Aktion.');
   const input=assignmentInput(body);
   const raids=await query(`select id from raids where guild_id=$1 and (id::text=$2 or external_raid_id=$2) and deleted_at is null`,[guild.id,clean(body.raidId)]);
   if(raids.rows.length!==1)throw fail('Raid nicht gefunden.',404);
   const raidId=raids.rows[0].id;
   const logs=await query('select payload from guildloot_era_logs where guild_id=$1 and raid_id=$2',[guild.id,raidId]);
   const found=logs.rows.some(({payload})=>(payload.receipts||[]).some(row=>receiptKey(payload.sessionId,row.id)===input.key));
   if(!found)throw fail('Lootmeldung nicht gefunden. Bitte das Raidarchiv neu laden.',404);
   let characterId=null,name=input.name,server=input.server;
   if(input.clear){name='';server='';}
   else if(input.characterId){
    const players=await query(`select c.id,c.name,coalesce(c.server,'') as server from characters c join players p on p.id=c.player_id where p.guild_id=$1 and c.id=$2`,[guild.id,input.characterId]);
    if(players.rows.length!==1)throw fail('Dieser Spieler gehört nicht zur ausgewählten Gilde.',404);
    ({id:characterId,name,server}=players.rows[0]);
   }
   await ensure();
   const client=await pool.connect();let saved;
   try {
    await client.query('BEGIN');
    // Serializes edits even before the first assignment exists; recheck the raid inside the transaction.
    const locked=await client.query('select id from raids where guild_id=$1 and id=$2 and deleted_at is null for update',[guild.id,raidId]);
    if(!locked.rows.length)throw fail('Raid nicht mehr verfügbar.',404);
    const previous=await client.query('select revision from raid_loot_assignments where guild_id=$1 and raid_id=$2 and receipt_key=$3',[guild.id,raidId,input.key]);
    if((previous.rows[0]?.revision||0)!==input.revision)throw fail('Die Zuweisung wurde inzwischen geändert. Bitte neu laden und erneut prüfen.',409);
    const values=[guild.id,raidId,input.key,characterId,name,server,input.revision+1];
    saved=(await client.query(`insert into raid_loot_assignments (guild_id,raid_id,receipt_key,character_id,player_name,server,revision)
     values($1,$2,$3,$4,$5,$6,$7) on conflict(guild_id,raid_id,receipt_key) do update set
     character_id=excluded.character_id,player_name=excluded.player_name,server=excluded.server,revision=excluded.revision,updated_at=now()
     returning player_name as name,server,revision,updated_at as "updatedAt"`,values)).rows[0];
    await client.query(`insert into raid_loot_assignment_history(guild_id,raid_id,receipt_key,character_id,player_name,server,revision) values($1,$2,$3,$4,$5,$6,$7)`,values);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   res.json({success:true,assignment:saved});
  }catch(error){next(error);}
 });
}
