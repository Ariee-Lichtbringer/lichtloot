import { randomUUID } from 'node:crypto';
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
const validToken=t=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(t||''));
export const reportSchema=`create table if not exists player_analysis_reports (
 token uuid primary key, guild_id uuid not null references guilds(id) on delete cascade,
 payload jsonb not null, created_at timestamptz not null default now(),
 delivery_status text not null default '', delivery_error text not null default '',
 discord_user_id text, discord_name text, queue_id uuid, discord_message_id text,
 sent_at timestamptz
)`;
let ready;
export async function ensureReportSchema(query){if(!ready)ready=query(reportSchema).catch(e=>{ready=null;throw e;});await ready;}
export async function saveReport(query,guild,analysis){
 await ensureReportSchema(query);
 const token=randomUUID();
 const payload={...analysis,guildName:guild.name||guild.slug,guildLogoUrl:guild.logo_url||guild.logoUrl||''};
 await query('insert into player_analysis_reports(token,guild_id,payload) values($1,$2,$3)',[token,guild.id,JSON.stringify(payload)]);
 return {reportToken:token,analysis:payload};
}
export async function getReport(query,guildId,token,privateFields=false){
 if(!validToken(token))fail('Ungültiger Berichtslink.');await ensureReportSchema(query);
 const result=await query('select * from player_analysis_reports where guild_id=$1 and token=$2',[guildId,token]);
 const row=result.rows[0];if(!row)fail('Dieser Bericht wurde nicht gefunden.',404);
 return privateFields?row:{success:true,analysis:row.payload};
}
export function makeReportUrl(guildSlug,token){return `https://lichtloot.de/spieler-analyse.html?guild=${encodeURIComponent(guildSlug)}&report=${encodeURIComponent(token)}`;}
export function uniqueRecipient(rows){
 const ids=[...new Set(rows.map(x=>x.discord_user_id).filter(x=>/^\d{15,22}$/.test(String(x||''))))];
 if(ids.length===0)fail('Für diesen Charakter und Server ist kein Discord-Konto verknüpft. Bitte zuerst die Charakterzuordnung über den P0-Bot oder SpielerLogin herstellen.');
 if(ids.length!==1)fail('Mehrere Discord-Konten sind diesem Charakter und Server zugeordnet. Bitte die Zuordnung vor dem Senden klären.');
 return rows.find(x=>x.discord_user_id===ids[0]);
}
export async function queueReportDm({pool,query,guild,token,authorize,retry=false,recipientId=null}){
 await ensureReportSchema(query);if(!validToken(token))fail('Ungültiger Bericht.');
 if(recipientId&&!validToken(recipientId))fail('Ungültiger Empfänger.');
 const client=await pool.connect();
 try{
  await client.query('begin');
  const found=await client.query('select * from player_analysis_reports where guild_id=$1 and token=$2 for update',[guild.id,token]);
  const row=found.rows[0];if(!row)fail('Bericht wurde nicht gefunden.',404);
  await authorize(row.payload.className);
  if(row.delivery_status && !(row.delivery_status==='failed' && retry===true)){await client.query('commit');return {success:true,status:row.delivery_status,error:row.delivery_error,recipient:row.discord_name||row.payload.name,reportUrl:makeReportUrl(guild.slug,token)};}
  const a=row.payload;
  const linked=await client.query(`select d.discord_user_id,d.discord_name,c.name,c.server from characters c
    join players p on p.id=c.player_id
    join discord_player_links d on d.guild_id=p.guild_id and d.character_id=c.id
    where p.guild_id=$1 and (($4::uuid is null and lower(btrim(c.name))=lower($2) and lower(btrim(c.server))=lower($3)) or c.id=$4)
      and coalesce(p.is_blocked,false)=false
    order by d.updated_at desc`,[guild.id,a.name,a.server,recipientId||null]);
  const recipient=uniqueRecipient(linked.rows);
  const payload={guildId:guild.id,guildSlug:guild.slug,guildName:guild.name||guild.slug,reportToken:token,reportUrl:makeReportUrl(guild.slug,token),discordUserId:recipient.discord_user_id,character:a.name,server:a.server,raid:a.raid,count:a.count,fromDate:a.raids[0].date,toDate:a.raids.at(-1).date};
  const queued=await client.query(`insert into bot_update_queue(guild_id,type,payload) values($1,'player_analysis_dm',$2) returning id`,[guild.id,JSON.stringify(payload)]);
  await client.query(`update player_analysis_reports set delivery_status='queued',discord_user_id=$3,discord_name=$4,queue_id=$5 where guild_id=$1 and token=$2`,[guild.id,token,recipient.discord_user_id,recipient.discord_name||'',queued.rows[0].id]);
  await client.query('commit');return {success:true,status:'queued',recipient:recipient.discord_name||recipient.name,reportUrl:payload.reportUrl};
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
}
export async function completeReportDm(query,guildId,params){
 await ensureReportSchema(query);if(!validToken(params.reportToken)||!validToken(params.queueId))fail('Ungültiger Bericht oder Auftrag.');
 if(!['sent','failed'].includes(params.status))fail('Ungültiger Versandstatus.');
 const error=params.status==='failed'?String(params.error||'Discord-Zustellung fehlgeschlagen.').slice(0,300):'';
 const result=await query(`with updated as (
  update player_analysis_reports set delivery_status=$3,delivery_error=$4,discord_message_id=$5,
  sent_at=case when $3='sent' then now() else sent_at end
  where guild_id=$1 and token=$2 and queue_id=$6 and delivery_status='queued' returning queue_id
 ) update bot_update_queue set status='done',resolved_at=now() where guild_id=$1 and id in(select queue_id from updated)`,[guildId,params.reportToken,params.status,error,String(params.messageId||''),params.queueId]);
 return {success:true};
}

export async function reportRecipients(query,guildId){
 const result=await query(`select c.id,c.name,c.server,
    exists(select 1 from discord_player_links d where d.guild_id=p.guild_id and d.character_id=c.id) as discord
    from characters c join players p on p.id=c.player_id
    where p.guild_id=$1 and coalesce(p.is_blocked,false)=false
    order by lower(c.name),lower(c.server)`,[guildId]);
 return {success:true,recipients:result.rows};
}
