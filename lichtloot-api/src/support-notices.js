export const SEARCH_NEWS_VERSION='2026-09-09-archive-professions';
export const SUPPORT_NEWS_VERSION='2026-09-06-support';
export const SUPPORT_NOTICE_TEXT='🛟 **Fehler oder Probleme mit GuildLoot?**\n\nBitte nutzt den Button **„Support · Fehler melden“** unten auf der jeweiligen GuildLoot-Seite. Beschreibt kurz, was ihr tun wolltet und was passiert ist. Einen Screenshot könnt ihr direkt anhängen. Gebt eine E-Mail-Adresse oder euren Discord-Namen an, damit wir euch antworten können.\n\nSo landet eure Meldung direkt beim Support und geht nicht im Channel unter. Danke!\nhttps://lichtloot.de';
export function createSupportNotices({query,env=process.env}){
 let schema;
 async function ensure(){if(!schema)schema=(async()=>{
  await query(`create table if not exists player_support_news_seen(player_id uuid not null references players(id) on delete cascade,version text not null,seen_at timestamptz not null default now(),primary key(player_id,version))`);
  await query(`alter table platform_support_tickets add column if not exists discord_notice_pending boolean not null default false`);
  await query(`create unique index if not exists support_notice_queue_unique on bot_update_queue((payload->>'noticeKey')) where type='po_support_notice'`);
 })().catch(e=>{schema=null;throw e});return schema;}
 async function claimNews(playerId,version=SUPPORT_NEWS_VERSION){await ensure();const r=await query(`insert into player_support_news_seen(player_id,version) values($1,$2) on conflict do nothing returning player_id`,[playerId,version]);return {success:true,show:r.rows.length>0,version};}
 async function queueDMs(){await ensure();const target=String(env.SUPPORT_DISCORD_USER_ID||'').trim();if(!/^\d{15,22}$/.test(target))return {configured:false,queued:0};
 const r=await query(`with candidates as (select id,guild_id from platform_support_tickets where discord_notice_pending=true order by created_at limit 50), inserted as (
 insert into bot_update_queue(guild_id,type,payload,status) select guild_id,'po_support_notice',jsonb_build_object('noticeKey','ticket:'||id::text,'kind','ticket','targetUserId',$1::text,'ticketId',id::text),'open' from candidates on conflict do nothing returning id)
 update platform_support_tickets set discord_notice_pending=false where id in(select id from candidates) returning id`,[target]);return {configured:true,queued:r.rows.length};}
 async function queueBroadcast(targets){await ensure();let queued=0;for(const t of targets){const payload={noticeKey:SUPPORT_NEWS_VERSION+':channel:'+t.channelId,kind:'announcement',channelId:t.channelId,discordGuildId:t.discordGuildId,proofMessageId:t.proofMessageId,proofMessageIds:t.proofMessageIds||[t.proofMessageId]};const r=await query(`insert into bot_update_queue(guild_id,type,payload,status) values($1,'po_support_notice',$2::jsonb,'open') on conflict do nothing returning id`,[t.guildId,JSON.stringify(payload)]);queued+=r.rows.length;}return {success:true,queued,targets:targets.length};}
 // A persisted claim before Discord I/O prevents duplicate messages after a crash.
 // An uncertain delivery is kept for review and is never sent again automatically.
 async function claimDelivery(id){await ensure();const r=await query(`update bot_update_queue set payload=payload||jsonb_build_object('deliveryState','sending','deliveryStartedAt',now()::text) where id=$1 and type='po_support_notice' and not(payload ? 'deliveryState') returning payload`,[id]);return {success:true,claimed:!!r.rows[0],payload:r.rows[0]?.payload};}
 async function finishDelivery(id,state,messageId='',error=''){if(!['sent','failed'].includes(state))throw Error('Ungültiger Zustellstatus');await query(`update bot_update_queue set status='done',resolved_at=now(),payload=payload||jsonb_build_object('deliveryState',$2::text,'messageId',$3::text,'deliveryError',$4::text) where id=$1 and type='po_support_notice' and payload->>'deliveryState'='sending'`,[id,state,String(messageId).slice(0,30),String(error).slice(0,160)]);return {success:true};}
 return {ensure,claimNews,queueDMs,queueBroadcast,claimDelivery,finishDelivery};
}
