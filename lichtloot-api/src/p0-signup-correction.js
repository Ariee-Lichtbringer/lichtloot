const fail=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});
// Canonical P0 signups have their own identity; never fall back to legacy posts.
export function createP0SignupCorrection({pool,query,p0Query,authorize,resolveEvent,raidTypes,requireItem,requiresRelease,refresh}) {
 return async function correct({guildId,query:params}) {
  authorize(params);
  const separate=params.storage==='separate-p0-database';
  if(!separate&&params.storage!=='raid-database')throw fail('Speicherkennung der P0-Anmeldung fehlt.',400);
  const read=separate?p0Query:query, table=separate?'p0_only_signups':'p0_discord_signups';
  const source=(await read(`select *,updated_at::text as correction_version from ${table} where guild_id=$1 and id=$2`,[guildId,params.id])).rows[0];
  if(!source)throw fail('P0-Anmeldung wurde nicht gefunden.',404);
  const raid=await resolveEvent(guildId,source,separate);
  if(!raid)throw fail('Der verknüpfte Raid fehlt. Bitte zuerst die Raidzuordnung prüfen.');
  const character=(await query(`select c.* from characters c join players p on p.id=c.player_id where c.id=$1 and p.guild_id=$2 and p.approval_status='approved' and coalesce(p.is_blocked,false)=false`,[params.characterId,guildId])).rows[0];
  if(!character)throw fail('Freigegebener Spielerlogin/Charakter wurde nicht gefunden.',404);
  const item=(await query(`select id,name from items where lower(raid_type)=any($1) and lower(name)=lower($2)`,[raidTypes(raid.raid_type),String(params.correctedItem||'').trim()])).rows;
  if(item.length!==1)throw fail('Das Item ist für diesen Raid nicht eindeutig zugeordnet.',400);
  await requireItem(guildId,item[0].id,item[0].name,raid.raid_type);
  const plus=await requiresRelease(guildId,item[0].id,item[0].name,raid.raid_type);
  const client=await pool.connect();let saved;
  try {
   await client.query('begin');
   await client.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))',[guildId,'p0plus-review']);
   const locked=(await client.query('select * from raids where guild_id=$1 and id=$2 for update',[guildId,raid.id])).rows[0];
   if(!locked||locked.deleted_at||locked.p0plus_transferred_at||['archiviert','archive','archived','abgesagt','cancelled','canceled'].includes(String(locked.status).toLowerCase()))throw fail('Dieser Raid ist bereits abgeschlossen. Die P0-Korrektur wurde nicht gespeichert.');
   if((await client.query("select 1 from p0plus_point_audit where guild_id=$1 and raid_id=$2 and (action='raid_transfer' or (character_id=$3 and action in ('item_received_clear','item_received_pending'))) limit 1",[guildId,raid.id,source.character_id])).rows.length)throw fail('Für diesen Raid wurden bereits Punkte übertragen oder das P0-Item als erhalten markiert. Bitte zuerst die Lootvergabe prüfen.');
   const existing=(await client.query('select * from prios where raid_id=$1 and character_id=$2 for update',[raid.id,source.character_id])).rows[0];
   let meta={};try{meta=JSON.parse(existing?.comment||'{}')}catch{}
   if(meta.p0ItemReceived===true||meta.p0ItemReceived==='ja')throw fail('Das bisherige P0-Item wurde bereits als erhalten markiert. Bitte zuerst die Lootvergabe prüfen.');
   if(source.character_id!==character.id&&existing)throw fail('Für den bisherigen Charakter besteht bereits eine Raidprio. Bitte die Charakterzuordnung zuerst in der Raidverwaltung korrigieren.');
   // Update the authoritative signup with optimistic concurrency. A retry can
   // safely repair the raid mirror if the second database was unavailable.
   const writer=separate?p0Query:client.query.bind(client);
   const result=await writer(`update ${table} set character_id=$3,player_name=$4,item_id=$5,item_name=$6,server=$8,updated_at=now() where guild_id=$1 and id=$2 and updated_at is not distinct from $7 returning *`,[guildId,source.id,character.id,character.name,item[0].id,item[0].name,source.correction_version,character.server||source.server||'']);
   saved=result.rows[0];if(!saved)throw fail('Die Anmeldung wurde zwischenzeitlich geändert. Bitte neu laden.');
   if(source.approval_status==='approved'){
    meta={...meta,p0Selected:'ja',p0Plus:plus?'ja':'nein',p0Item:item[0].name,source:'discord-p0',discordUserId:source.discord_user_id||'',...(separate?{p0OnlySignupId:source.id,p0OnlyEventId:source.event_id}:{})};
    await client.query(`/* prio-audit:correctP0Signup */ insert into prios(raid_id,character_id,p1_item_id,p2_item_id,p3_item_id,comment) values($1,$2,$3,$3,$3,$4) on conflict(raid_id,character_id) do update set p1_item_id=excluded.p1_item_id,p2_item_id=excluded.p2_item_id,p3_item_id=excluded.p3_item_id,comment=excluded.comment,updated_at=now()`,[raid.id,character.id,item[0].id,JSON.stringify(meta)]);
   }
   await client.query('commit');
  }catch(error){
   await client.query('rollback');
   if(separate&&saved)throw fail('P0-Anmeldung gespeichert, aber Raidprio nicht aktualisiert. Bitte „Korrigieren“ erneut ausführen. '+error.message,503);
   throw error;
  }finally{client.release()}
  await refresh(guildId,raid,'p0_correction').catch(()=>{});
  return {success:true,entry:{id:source.id,player:character.name,className:character.class_name,item:item[0].name,itemId:item[0].id,storage:params.storage,entrySource:'p0_database'},prioSync:source.approval_status==='approved'?{success:true}:null};
 };
}
