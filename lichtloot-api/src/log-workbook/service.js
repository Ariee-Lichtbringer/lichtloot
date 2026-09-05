import path from 'node:path';
import {buildRaidWorkbook} from './workbook.js';
import {sourceDigest,workbookLinks,buildPostPayload,clean} from './model.js';
export function createRaidWorkbookService({query,getWeb,resolveChannel,publicBaseUrl,apiBaseUrl,publicDir=path.resolve('public'),build=buildRaidWorkbook}) {
  let schemaPromise;const running=new Map();
  function ensureSchema(){return schemaPromise ||= (async()=>{
    await query(`create table if not exists log_analysis_workbooks (
      analysis_id uuid primary key references log_analyses(id) on delete cascade,
      guild_id uuid not null references guilds(id) on delete cascade,
      source_hash text not null,file_name text not null,content bytea not null,
      generated_at timestamptz not null default now())`);
    await query(`create unique index if not exists bot_queue_raid_workbook_unique
      on bot_update_queue (guild_id,type,(payload->>'analysisId')) where type='raid_workbook_post'`);
  })().catch(error=>{schemaPromise=null;throw error;});}
  async function context(guildId,analysisId){
    const r=await query(`select la.*,g.slug as guild_slug,g.name as guild_name,g.logo_url,
      g.discord_guild_id,coalesce(gs.layout_json,'{}'::jsonb) as guild_layout
      from log_analyses la join guilds g on g.id=la.guild_id
      left join guild_settings gs on gs.guild_id=g.id
      where la.guild_id=$1 and la.id=$2 limit 1`,[guildId,analysisId]);
    if(!r.rows[0])throw Object.assign(new Error('Loganalyse wurde in dieser Gilde nicht gefunden.'),{statusCode:404});
    const row=r.rows[0],guild={id:guildId,slug:row.guild_slug,name:row.guild_name,logoUrl:row.logo_url||'',discordGuildId:row.discord_guild_id||''};
    return {analysis:row,guild,layout:row.guild_layout||{}};
  }
  function generate(guildId,analysisId,web){const key=`${guildId}:${analysisId}`;if(running.has(key))return running.get(key);const job=(async()=>{
    await ensureSchema();const ctx=await context(guildId,analysisId);
    const data=web||(await getWeb({guildId,query:{id:analysisId,type:'combined'}})).webAnalysis;
    if(!data || data.refreshPending || data.rpb?.refreshPending)throw Object.assign(new Error('Die Loganalyse wird noch berechnet.'),{statusCode:409});
    const links=workbookLinks({...ctx,publicBaseUrl,apiBaseUrl}),hash=sourceDigest(data,ctx.guild);
    const old=await query('select file_name,content,source_hash,generated_at from log_analysis_workbooks where guild_id=$1 and analysis_id=$2',[guildId,analysisId]);
    if(old.rows[0]?.source_hash===hash)return {...ctx,web:data,links,buffer:old.rows[0].content,fileName:old.rows[0].file_name};
    const file=await build({web:data,...ctx,links,publicDir,publicBaseUrl});
    await query(`insert into log_analysis_workbooks (analysis_id,guild_id,source_hash,file_name,content) values ($1,$2,$3,$4,$5)
      on conflict (analysis_id) do update set source_hash=excluded.source_hash,file_name=excluded.file_name,content=excluded.content,generated_at=now()
      where log_analysis_workbooks.guild_id=excluded.guild_id`,[analysisId,guildId,hash,file.fileName,file.buffer]);
    await query(`update log_analyses set summary=coalesce(summary,'{}'::jsonb)||$3::jsonb where guild_id=$1 and id=$2`,[guildId,analysisId,JSON.stringify({workbookUrl:links.sheetUrl,workbookGeneratedAt:new Date().toISOString(),workbookError:null})]);
    return {...ctx,web:data,links,...file};
  })().finally(()=>running.delete(key));running.set(key,job);return job;}
  async function afterAnalysis({guildId,analysisId,web}){
    const ctx=await context(guildId,analysisId);
    const enabled=v=>v===true||['true','1','yes','ja'].includes(clean(v).toLowerCase());
    // Refresh a file that was already shared, even when future automatic posts are disabled.
    await ensureSchema();const old=await query('select analysis_id from log_analysis_workbooks where guild_id=$1 and analysis_id=$2',[guildId,analysisId]);
    if(!enabled(ctx.layout.logWorkbookAutoPost)&&!old.rows.length)return {skipped:true,reason:'disabled'};
    const result=await generate(guildId,analysisId,web);
    if(!enabled(ctx.layout.logWorkbookAutoPost))return {updated:true,posted:false};
    const channelId=await resolveChannel(guildId,web.report?.raid||ctx.analysis.raid);
    if(!/^\d{17,20}$/.test(clean(channelId)))throw new Error('Kein gültiger Analyse-Zielchannel für diese Gilde und diesen Raid eingestellt.');
    if(!/^\d{17,20}$/.test(clean(ctx.guild.discordGuildId)))throw new Error('Der Discord-Server der Gilde ist nicht konfiguriert.');
    const payload=buildPostPayload({...result,channelId});
    await query(`insert into bot_update_queue (guild_id,type,payload) values ($1,'raid_workbook_post',$2::jsonb)
      on conflict (guild_id,type,(payload->>'analysisId')) where type='raid_workbook_post'
      do update set payload=excluded.payload where bot_update_queue.status='open'`,[guildId,JSON.stringify(payload)]);
    return {queued:true,sheetUrl:result.links.sheetUrl};
  }
  return {generate,afterAnalysis,ensureSchema};
}
