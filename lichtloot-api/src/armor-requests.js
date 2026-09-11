import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const catalog=JSON.parse(readFileSync(new URL('./armor-catalog.json',import.meta.url),'utf8'));
const masks={krieger:1,warrior:1,paladin:2,jäger:4,hunter:4,schurke:8,rogue:8,priester:16,priest:16,schamane:64,shaman:64,magier:128,mage:128,hexenmeister:256,warlock:256,druide:1024,druid:1024};
const clean=value=>String(value??'').trim();
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
export function createArmorRequests({pool,query}){
 return {async handle(guild,params){
  const pin=clean(params.pin).toUpperCase(),name=clean(params.character),server=clean(params.server);
  if(!pin||!name)fail('Bitte zuerst mit deinem SpielerLogin anmelden.',401);
  const result=await query(`select c.id,c.name,c.server,c.class_name,p.id as player_id from players p join characters c on c.player_id=p.id where p.guild_id=$1 and p.player_pin=$2 and lower(c.name)=lower($3) and ($4='' or lower(c.server)=lower($4)) and coalesce(p.is_blocked,false)=false`,[guild.id,pin,name,server]);
  if(result.rows.length!==1)fail('Charakter nicht eindeutig gefunden. Bitte erneut auswählen.',403);
  const character=result.rows[0];
  if(params.action==='getArmorRequestStatus'){
   const row=await query(`select status from bot_update_queue where guild_id=$1 and type='armor_request_notice' and id::text=$2 and payload->>'characterId'=$3`,[guild.id,clean(params.requestId),String(character.id)]);
   if(!row.rows[0])fail('Anfrage nicht gefunden.',404);return {success:true,status:row.rows[0].status};
  }
  const settings=await query(`select layout_json from guild_settings where guild_id=$1`,[guild.id]);
  const layout=settings.rows[0]?.layout_json||{};
  const channelId=clean(layout.armorRequestChannelId??(guild.slug==='lichtloot'?'1390681277992272024':''));
  if(params.action==='getArmorRequestCatalog')return {success:true,character:{name:character.name,server:character.server,className:character.class_name},items:armorForClass(character.class_name),configured:/^\d{15,22}$/.test(channelId)};
  if(!/^\d{15,22}$/.test(channelId))fail('Die Gildenleitung muss unter Layout → Discordchannel „Rüstungsteile beantragen“ einstellen.');
  const channel=await query(`select channel_id from discord_bot_channels where guild_id=$1 and channel_id=$2 and can_send=true`,[guild.id,channelId]);
  if(!channel.rows.length)fail('Der eingestellte Antragschannel ist für den Bot nicht verfügbar. Bitte die Gildenleitung informieren.');
  const {item,materials}=validateArmorSelection(character.class_name,params);
  const fingerprint=createHash('sha256').update(JSON.stringify([character.id,item.itemId,materials,channelId])).digest('hex');
  const payload={channelId,characterId:String(character.id),character:character.name,server:character.server,className:character.class_name,itemId:item.itemId,itemName:item.name,tier:item.tier,token:item.requirements.find(r=>r.itemId===item.tokenId),materials,fingerprint};
  const client=await pool.connect();
  try{
   await client.query('begin');
   await client.query('select pg_advisory_xact_lock(hashtext($1))',[`armor:${guild.id}:${character.player_id}`]);
   const existing=await client.query(`select id,status from bot_update_queue where guild_id=$1 and type='armor_request_notice' and payload->>'fingerprint'=$2 and created_at>now()-interval '10 minutes' order by created_at desc limit 1`,[guild.id,fingerprint]);
   if(existing.rows.length){await client.query('commit');return {success:true,requestId:existing.rows[0].id,status:existing.rows[0].status,duplicate:true};}
   const count=await client.query(`select count(*)::int as n from bot_update_queue where guild_id=$1 and type='armor_request_notice' and payload->>'characterId'=$2 and created_at>now()-interval '1 minute'`,[guild.id,String(character.id)]);
   if(count.rows[0].n>=5)fail('Bitte kurz warten, bevor du weitere Anträge sendest.',429);
   const saved=await client.query(`insert into bot_update_queue(guild_id,type,payload) values($1,'armor_request_notice',$2::jsonb) returning id,status`,[guild.id,JSON.stringify(payload)]);
   await client.query('commit');return {success:true,requestId:saved.rows[0].id,status:saved.rows[0].status};
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
 }};
}
