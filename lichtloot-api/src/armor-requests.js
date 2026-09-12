import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const catalog=JSON.parse(readFileSync(new URL('./armor-catalog.json',import.meta.url),'utf8'));
const masks={krieger:1,warrior:1,paladin:2,jäger:4,hunter:4,schurke:8,rogue:8,priester:16,priest:16,schamane:64,shaman:64,magier:128,mage:128,hexenmeister:256,warlock:256,druide:1024,druid:1024};
export const ARMOR_TIERS=['T3','T2,5','AQ20','Skarabäen & Götzen'];
export const ARMOR_REQUEST_STATUSES=['pending','approved','rejected'];
const clean=value=>String(value??'').trim();
const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean(value));
function fail(message,statusCode=400){throw Object.assign(new Error(message),{statusCode});}
export function armorForClass(className){const mask=masks[clean(className).toLowerCase()]||0;return catalog.filter(item=>(item.classMask&mask)!==0);}
export function validateArmorSelection(className,params){
 const item=armorForClass(className).find(item=>item.itemId===String(params.itemId));
 if(!item)fail('Bitte ein gültiges Rüstungsteil deiner Klasse auswählen.');
 if(!Array.isArray(params.materials)||!params.materials.length||params.materials.length>item.requirements.length)fail('Bitte benötigte Gildenbank-Materialien auswählen.');
 const seen=new Set();
 const materials=params.materials.map(selected=>{
  const material=item.requirements.find(material=>String(material.itemId)===String(selected.itemId));
  const quantity=Number(selected.quantity);
  if(!material||seen.has(material.itemId)||!Number.isInteger(quantity)||quantity<1||quantity>material.quantity)fail('Ungültige Materialauswahl oder Menge.');
  seen.add(material.itemId);return {...material,quantity};
 }).sort((a,b)=>a.itemId-b.itemId);
 return {item,materials};
}
export const ARMOR_REQUESTS_SCHEMA=`create table if not exists armor_requests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  player_id uuid,
  character_id uuid,
  character_name text not null,
  server text not null default '',
  class_name text not null default '',
  tier text not null default '',
  item_id text not null,
  item_name text not null,
  token jsonb,
  materials jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  review_note text not null default '',
  reviewed_at timestamptz,
  queue_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_armor_requests_guild on armor_requests(guild_id,status,created_at desc);`;
export function mapArmorRequestRow(row){
 return {id:row.id,characterId:row.character_id,characterName:row.character_name,server:row.server,className:row.class_name,tier:row.tier,itemId:row.item_id,itemName:row.item_name,token:row.token||null,materials:Array.isArray(row.materials)?row.materials:[],status:row.status,reviewNote:row.review_note||'',reviewedAt:row.reviewed_at,createdAt:row.created_at};
}
export function createArmorRequests({pool,query}){
 let schemaReady=null;
 const ensureSchema=()=>{if(!schemaReady)schemaReady=query(ARMOR_REQUESTS_SCHEMA).catch(error=>{schemaReady=null;throw error;});return schemaReady;};
 return {
  async handle(guild,params){
   const pin=clean(params.pin).toUpperCase(),name=clean(params.character),server=clean(params.server);
   if(!pin||!name)fail('Bitte zuerst mit deinem SpielerLogin anmelden.',401);
   const result=await query(`select c.id,c.name,c.server,c.class_name,p.id as player_id from players p join characters c on c.player_id=p.id where p.guild_id=$1 and p.player_pin=$2 and lower(c.name)=lower($3) and ($4='' or lower(c.server)=lower($4)) and coalesce(p.is_blocked,false)=false`,[guild.id,pin,name,server]);
   if(result.rows.length!==1)fail('Charakter nicht eindeutig gefunden. Bitte erneut auswählen.',403);
   const character=result.rows[0];
   if(params.action==='getArmorRequestStatus'){
    const row=await query(`select status from bot_update_queue where guild_id=$1 and type='armor_request_notice' and id::text=$2 and payload->>'characterId'=$3`,[guild.id,clean(params.requestId),String(character.id)]);
    if(!row.rows[0])fail('Anfrage nicht gefunden.',404);return {success:true,status:row.rows[0].status};
   }
   if(params.action==='getMyArmorRequests'){
    await ensureSchema();
    const rows=await query(`select * from armor_requests where guild_id=$1 and (player_id=$2 or character_id=$3) order by created_at desc limit 50`,[guild.id,character.player_id,character.id]);
    return {success:true,entries:rows.rows.map(mapArmorRequestRow)};
   }
   const settings=await query(`select layout_json from guild_settings where guild_id=$1`,[guild.id]);
   const layout=settings.rows[0]?.layout_json||{};
   const channelId=clean(layout.armorRequestChannelId??(guild.slug==='lichtloot'?'1390681277992272024':''));
   if(params.action==='getArmorRequestCatalog')return {success:true,character:{name:character.name,server:character.server,className:character.class_name},items:armorForClass(character.class_name),tiers:ARMOR_TIERS,configured:/^\d{15,22}$/.test(channelId)};
   if(!/^\d{15,22}$/.test(channelId))fail('Die Gildenleitung muss unter Layout → Discordchannel „Rüstungsteile beantragen“ einstellen.');
   const channel=await query(`select channel_id from discord_bot_channels where guild_id=$1 and channel_id=$2 and can_send=true`,[guild.id,channelId]);
   if(!channel.rows.length)fail('Der eingestellte Antragschannel ist für den Bot nicht verfügbar. Bitte die Gildenleitung informieren.');
   const {item,materials}=validateArmorSelection(character.class_name,params);
   await ensureSchema();
   const fingerprint=createHash('sha256').update(JSON.stringify([character.id,item.itemId,materials,channelId])).digest('hex');
   const token=item.tokenId?item.requirements.find(r=>r.itemId===item.tokenId)||null:null;
   const payload={channelId,characterId:String(character.id),character:character.name,server:character.server,className:character.class_name,itemId:item.itemId,itemName:item.name,tier:item.tier,token,materials,fingerprint};
   const client=await pool.connect();
   try{
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))',[`armor:${guild.id}:${character.player_id}`]);
    const existing=await client.query(`select id,status from bot_update_queue where guild_id=$1 and type='armor_request_notice' and payload->>'fingerprint'=$2 and created_at>now()-interval '10 minutes' order by created_at desc limit 1`,[guild.id,fingerprint]);
    if(existing.rows.length){await client.query('commit');return {success:true,requestId:existing.rows[0].id,status:existing.rows[0].status,duplicate:true};}
    const count=await client.query(`select count(*)::int as n from bot_update_queue where guild_id=$1 and type='armor_request_notice' and payload->>'characterId'=$2 and created_at>now()-interval '1 minute'`,[guild.id,String(character.id)]);
    if(count.rows[0].n>=5)fail('Bitte kurz warten, bevor du weitere Anträge sendest.',429);
    const saved=await client.query(`insert into bot_update_queue(guild_id,type,payload) values($1,'armor_request_notice',$2::jsonb) returning id,status`,[guild.id,JSON.stringify(payload)]);
    const request=await client.query(`insert into armor_requests(guild_id,player_id,character_id,character_name,server,class_name,tier,item_id,item_name,token,materials,queue_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12) returning id`,[guild.id,character.player_id,character.id,character.name,character.server||'',character.class_name||'',item.tier,item.itemId,item.name,token?JSON.stringify(token):null,JSON.stringify(materials),saved.rows[0].id]);
    await client.query('commit');return {success:true,requestId:saved.rows[0].id,armorRequestId:request.rows[0].id,status:saved.rows[0].status};
   }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  },
  async manage(guild,action,params){
   await ensureSchema();
   if(action==='guildGetArmorRequests'){
    const rows=await query(`select * from armor_requests where guild_id=$1 order by (status='pending') desc,created_at desc limit 300`,[guild.id]);
    return {success:true,entries:rows.rows.map(mapArmorRequestRow)};
   }
   const requestId=clean(params.requestId);
   if(!isUuid(requestId))fail('Antrag fehlt.');
   if(action==='guildReviewArmorRequest'){
    const decision=clean(params.decision||params.status).toLowerCase();
    if(!ARMOR_REQUEST_STATUSES.includes(decision))fail('Bitte eine gültige Entscheidung wählen.');
    const note=clean(params.note||params.reviewNote).slice(0,500);
    const updated=await query(`update armor_requests set status=$3,review_note=$4,reviewed_at=case when $3='pending' then null else now() end where id=$1 and guild_id=$2 returning *`,[requestId,guild.id,decision,note]);
    if(!updated.rows.length)fail('Antrag nicht gefunden.',404);
    return {success:true,entry:mapArmorRequestRow(updated.rows[0])};
   }
   if(action==='guildDeleteArmorRequest'){
    const deleted=await query(`delete from armor_requests where id=$1 and guild_id=$2`,[requestId,guild.id]);
    return {success:true,deleted:deleted.rowCount||0};
   }
   fail('Unbekannte Aktion.',404);
  }
 };
}
