const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const text=(v,max=120)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f<>]/.test(v))throw fail('Ungültiger Berufseintrag.');return v.trim();};
const number=(v,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)throw fail('Ungültiger Fertigkeitswert.');return v;};
export function validateProfessionSnapshot(value,now=Math.floor(Date.now()/1000)){
 if(!value||value.schema!==1)throw fail('Unbekanntes Berufe-Format.');
 const observedAt=number(value.observedAt,1,now+300);
 if(!Array.isArray(value.professions)||value.professions.length>13||!Array.isArray(value.skills)||value.skills.length>200)throw fail('Zu viele Fertigkeiten.');
 const seen=new Set();let recipes=0;
 const professions=value.professions.map(p=>{
  const id=number(p.id,1,13);if(seen.has(id))throw fail('Doppelter Beruf.');seen.add(id);
  const maxRank=number(p.maxRank,1,300),rank=number(p.rank,0,maxRank),scannedAt=number(p.scannedAt||0,0,observedAt);
  if(!Array.isArray(p.recipes)||p.recipes.length>1500||(recipes+=p.recipes.length)>5000)throw fail('Zu viele Rezepte.');
  const keys=new Set();const rows=p.recipes.map(r=>{
   const spellId=number(r.spellId||0,0,1000000),itemId=number(r.itemId||0,0,1000000),name=text(r.name);
   const key=spellId||name+':'+itemId;if(keys.has(key))throw fail('Doppeltes Rezept.');keys.add(key);
   return {spellId,itemId,name};
  });
  return {id,name:text(p.name),rank,maxRank,scannedAt,recipes:rows};
 });
 const skills=value.skills.map(s=>{const maxRank=number(s.maxRank,1,1000);return {name:text(s.name),rank:number(s.rank,0,maxRank),maxRank};});
 return {schema:1,observedAt,professions,skills};
}
export function mergeProfessionSnapshots(previous,incoming){
 if(previous&&previous.observedAt>incoming.observedAt)return previous;
 return {...incoming,professions:incoming.professions.map(p=>{
  const old=previous?.professions?.find(o=>o.id===p.id);
  return old&&old.scannedAt>p.scannedAt?{...p,scannedAt:old.scannedAt,recipes:old.recipes}:p;
 })};
}
export function createCharacterProfessions({query,pool,getCharactersByPin}){
 let schema;
 const ensure=()=>schema||(schema=query(`create table if not exists character_profession_snapshots (
  guild_id uuid not null references guilds(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  snapshot jsonb not null, updated_at timestamptz not null default now(),
  primary key(guild_id,character_id))`).catch(e=>{schema=null;throw e;}));
 return async(guild,params,write=false)=>{
  const pin=params.pin||params.playerPin||params.characterPin;
  if(typeof pin!=='string'||!pin.trim()||pin.length>100)throw fail('SpielerLogin fehlt.',403);
  const owned=await getCharactersByPin(guild.id,pin);if(!owned.length)throw fail('SpielerLogin nicht freigegeben.',403);
  await ensure();
  if(write){
   const name=text(params.player),realm=text(params.server);
   const character=owned.find(c=>c.name.toLowerCase()===name.toLowerCase()&&c.server.toLowerCase()===realm.toLowerCase());
   if(!character)throw fail('Charakter gehört nicht zu diesem SpielerLogin.',403);
   const snapshot=validateProfessionSnapshot(params.snapshot);
   const db=await pool.connect();
   try{
    await db.query('begin');
    await db.query('select pg_advisory_xact_lock(hashtext($1))',[guild.id+':professions:'+character.id]);
    const old=await db.query('select snapshot from character_profession_snapshots where guild_id=$1 and character_id=$2 for update',[guild.id,character.id]);
    const merged=mergeProfessionSnapshots(old.rows[0]?.snapshot,snapshot);
    await db.query(`insert into character_profession_snapshots(guild_id,character_id,snapshot) values($1,$2,$3::jsonb)
     on conflict(guild_id,character_id) do update set snapshot=excluded.snapshot,updated_at=now()`,[guild.id,character.id,JSON.stringify(merged)]);
    await db.query('commit');return {success:true,guild:guild.slug,player:character.name,server:character.server,observedAt:merged.observedAt};
   }catch(e){await db.query('rollback');throw e;}finally{db.release();}
  }
  const result=await query('select character_id,snapshot from character_profession_snapshots where guild_id=$1 and character_id=any($2::uuid[])',[guild.id,owned.map(c=>c.id)]);
  return {success:true,guild:guild.slug,characters:owned.map(c=>({player:c.name,realm:c.server,className:c.className||'',snapshot:result.rows.find(r=>r.character_id===c.id)?.snapshot||null}))};
 };
}
