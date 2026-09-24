// Community discoveries live exclusively in the injected Forever database.
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export const addonLootSchema=`create table if not exists forever_item_discoveries (
 guild_id uuid not null references guilds(id), source_guid text not null,
 item_id bigint not null, quantity integer not null check(quantity>0),
 item_name text not null,item_link text not null,source_name text not null,
 zone_name text not null,instance_id integer not null,client_build text not null,
 metadata jsonb not null,observed_at timestamptz not null,
 imported_at timestamptz not null default now(),
 primary key(guild_id,source_guid,item_id,client_build)
);`;
const str=(value,max,required=true)=>{
 if(typeof value!=='string'||value.length>max||(required&&!value.trim())||/[\u0000-\u001f\u007f]/.test(value))throw fail('Ungültiger Text im Itemfund.');
 return value;
};
export function validateLootEvents(events){
 if(!Array.isArray(events)||!events.length||events.length>250)throw fail('Bitte 1 bis 250 Itemfunde senden.');
 return events.map(e=>{
  if(!e||e.version!==1||e.game!=='forever')throw fail('Kein Forever-Itemfund.');
  const sourceGuid=str(e.sourceGuid,160),itemName=str(e.itemName,200),itemLink=str(e.itemLink,1000),sourceName=str(e.sourceName,200,false);
  if(!/^(Creature|Vehicle|GameObject)-[A-Za-z0-9-]+$/.test(sourceGuid))throw fail('Keine eindeutige Lootquelle.');
  if(!Number.isSafeInteger(e.itemId)||e.itemId<1||e.itemId>2147483647||!Number.isInteger(e.quantity)||e.quantity<1||e.quantity>10000)throw fail('Ungültiger Gegenstand oder Menge.');
  if(Number(itemLink.match(/item:(\d+)/)?.[1])!==e.itemId)throw fail('Itemlink und Item-ID stimmen nicht überein.');
  if(!Number.isSafeInteger(e.observedAt)||e.observedAt<1577836800||e.observedAt>Date.now()/1000+86400)throw fail('Ungültiger Zeitpunkt.');
  if(!Number.isInteger(e.instanceId)||e.instanceId<0||e.instanceId>1000000)throw fail('Ungültiger Fundort.');
  const metadata={};
  for(const key of ['quality','itemLevel','requiredLevel','classId','subclassId','iconId'])if(e.metadata?.[key]!==undefined){const n=e.metadata[key];if(!Number.isSafeInteger(n)||n<0||n>2147483647)throw fail('Ungültige Itemdaten.');metadata[key]=n;}
  for(const key of ['itemType','itemSubType','equipLoc','locale'])if(e.metadata?.[key]!==undefined)metadata[key]=str(e.metadata[key],100,false);
  return {...e,sourceGuid,itemName,itemLink,sourceName,zoneName:str(e.zoneName,200,false),clientBuild:str(e.clientBuild,40),metadata};
 });
}
export async function discoveredItems(query){
 // Never publish account, character, guild identity or credentials.
 return {success:true,items:(await query(`select distinct on(item_id) item_id,item_name,item_link,source_name,zone_name,instance_id,client_build,metadata,observed_at
 from forever_item_discoveries order by item_id,observed_at desc limit 5000`)).rows};
}
export async function runAddonLoot({pool,query},guild,actor,body){
 if(body.action==='addonLootList')return discoveredItems(query);
 const events=validateLootEvents(body.events);
 const db=await pool.connect();
 try{
  await db.query('begin');let changed=0;
  for(const e of events){
   const r=await db.query(`insert into forever_item_discoveries(guild_id,source_guid,item_id,quantity,item_name,item_link,source_name,zone_name,instance_id,client_build,metadata,observed_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,to_timestamp($12))
    on conflict(guild_id,source_guid,item_id,client_build) do update set
    quantity=greatest(forever_item_discoveries.quantity,excluded.quantity),metadata=forever_item_discoveries.metadata||excluded.metadata
    where forever_item_discoveries.quantity<excluded.quantity or not forever_item_discoveries.metadata @> excluded.metadata returning item_id`,[guild.id,e.sourceGuid,e.itemId,e.quantity,e.itemName,e.itemLink,e.sourceName,e.zoneName,e.instanceId,e.clientBuild,JSON.stringify(e.metadata),e.observedAt]);
   changed+=r.rows.length;
  }
  if(changed)await db.query('insert into forever_audit(guild_id,action,actor,detail) values($1,$2,$3,$4)',[guild.id,'addon_discovery',actor.label,`${changed} Itemfunde ergänzt.`]);
  await db.query('commit');return {success:true,received:events.length,changed};
 }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
