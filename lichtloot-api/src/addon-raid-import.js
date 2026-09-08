import {createHash} from 'node:crypto';
const fail=(s,code=400)=>Object.assign(new Error(s),{statusCode:code});
const norm=v=>String(v??'').trim().normalize('NFC').toLowerCase();
export const eraInstances={mc:409,bwl:469,ony:249,zg:309,'zg-mittwoch':309,'zg-prime':309,'zg-late':309,aq20:509,aq40:531,naxx:533};
const str=(v,label,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))throw fail(`${label} ist ungültig.`);return v;};
const num=(v,label,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw fail(`${label} ist ungültig.`);return v;};
export function validateRaidExport(raw,{guild,raidId,instanceId}){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>1500000)throw fail('Export fehlt oder ist zu groß.');
  let p;try{p=JSON.parse(raw);}catch{throw fail('Der Export enthält kein gültiges JSON.');}
  if(!p||!['guildloot.raid.v1','guildloot.raid.v2','guildloot.raid.v3'].includes(p.schema)||!Array.isArray(p.drops)||p.drops.length>5000)throw fail('Unbekanntes Exportformat.');
  if(p.guild!==guild||p.raidId!==raidId||p.instanceId!==instanceId)throw fail('Der Export gehört zu einer anderen Gilde, Raid-ID oder Instanz.');
  const now=Math.floor(Date.now()/1000)+86400;
  const out={schema:p.schema,addonVersion:str(p.addonVersion,'Addonversion',40),sessionId:str(p.sessionId,'Sitzungs-ID',200),guild,raidId,instanceId,
    raidName:str(p.raidName,'Raidname'),raidDate:str(p.raidDate,'Raiddatum',20),realm:str(p.realm,'Realm'),recorder:str(p.recorder,'Aufzeichner'),
    startedAt:num(p.startedAt,'Raidbeginn',1,now),endedAt:num(p.endedAt,'Raidende',1,now),priorityExportedAt:num(p.priorityExportedAt,'Priostand',1,now),
    unresolvedLoot:p.unresolvedLoot===true,drops:[]};
  if(out.endedAt<out.startedAt||out.endedAt-out.startedAt>7*86400)throw fail('Raidzeitraum ist ungültig.');
  const seen=new Set();
  for(const d of p.drops){
    if(!d||typeof d!=='object')throw fail('Ungültiger Drop.');
    const itemId=num(d.itemId,'Item-ID',1,1000000),sourceGuid=str(d.sourceGuid,'Beutequelle',200);
    if(!/^(Creature|GameObject)-[0-9A-Fa-f-]+$/.test(sourceGuid))throw fail('Ungültige Quellen-GUID.');
    const id=`${sourceGuid}:${itemId}`;
    if(d.id!==id||seen.has(id))throw fail('Doppelte oder ungültige Drop-ID.');seen.add(id);
    if(!['unknown','observed','manual'].includes(d.sourceEvidence))throw fail('Ungültige Quellenzuordnung.');
    const drop={id,itemId,sourceGuid,itemName:str(d.itemName,'Itemname',250),sourceName:str(d.sourceName,'Quellenname'),
      sourceEvidence:d.sourceEvidence,quantity:num(d.quantity,'Anzahl',1,10000),observedAt:num(d.observedAt,'Dropzeit',out.startedAt,out.endedAt)};
    if(p.schema!=='guildloot.raid.v1'){
      const capture=d.capture??'local';if(!['local','shared'].includes(capture))throw fail('Ungültiger Erfassungsweg.');
      drop.capture=capture;
      if(capture==='shared')drop.reportedBy=str(d.reportedBy,'Übermittelnder Spieler');
    }
    out.drops.push(drop);
  }
  if(p.schema!=='guildloot.raid.v1'){
    if(!Array.isArray(p.receipts)||p.receipts.length>5000)throw fail('Ungültige Empfangsmeldungen.');
    out.receipts=[];const receiptIds=new Set();
    for(const e of p.receipts){
      if(!e||typeof e!=='object')throw fail('Ungültige Empfangsmeldung.');
      const id=str(e.id,'Empfangs-ID',240);
      if(!id.startsWith(out.sessionId+':receipt:')||!/^\d+$/.test(id.slice((out.sessionId+':receipt:').length))||receiptIds.has(id))throw fail('Doppelte oder ungültige Empfangs-ID.');
      receiptIds.add(id);
      out.receipts.push({id,recipient:str(e.recipient,'Empfänger'),itemId:num(e.itemId,'Item-ID',1,1000000),itemName:str(e.itemName,'Itemname',250),quantity:num(e.quantity,'Anzahl',1,10000),observedAt:num(e.observedAt,'Empfangszeit',out.startedAt,out.endedAt)});
    }
    out.receipts.sort((a,b)=>a.id.localeCompare(b.id));
    out.syncWarning=p.syncWarning===true;out.captureWarning=p.captureWarning===true;
  }
  if(p.schema==='guildloot.raid.v3'){
    if(!Array.isArray(p.participants)||p.participants.length>200)throw fail('Ungültige Teilnehmerliste.');
    out.participants=p.participants.map(e=>{
      if(!['combat','self'].includes(e.evidence))throw fail('Ungültiger Teilnahmenachweis.');
      const firstSeen=num(e.firstSeen,'Erste Sichtung',out.startedAt,out.endedAt);
      return {guid:str(e.guid,'Spieler-GUID',100),player:str(e.player,'Spieler',100),realm:str(e.realm,'Realm',100),evidence:e.evidence,firstSeen,lastSeen:num(e.lastSeen,'Letzte Sichtung',firstSeen,out.endedAt)};
    });
  }
  for(const key of ['trades','chatEvidence']) {
    if(p[key]===undefined)continue;
    if(!Array.isArray(p[key])||p[key].length>5000)throw fail('Ungültige Zusatznachweise.');
    const ids=new Set();out[key]=p[key].map(e=>{
      if(!e||typeof e!=='object')throw fail('Ungültiger Nachweis.');
      const id=str(e.id,'Nachweis-ID',240),prefix=out.sessionId+(key==='trades'?':trade:':':evidence:');
      if(!id.startsWith(prefix)||!/^\d+$/.test(id.slice(prefix.length))||ids.has(id))throw fail('Ungültige Nachweis-ID.');ids.add(id);
      const row={id,observedAt:num(e.observedAt,'Zeit',out.startedAt,out.endedAt)};
      if(key==='trades')return {...row,giver:str(e.giver,'Geber'),recipient:str(e.recipient,'Empfänger'),itemId:num(e.itemId,'Item-ID',1,1000000),itemName:str(e.itemName,'Item',250),quantity:num(e.quantity,'Menge',1,10000)};
      Object.assign(row,{kind:e.kind,raw:str(e.raw,'Originalmeldung',3000),sender:str(e.sender,'Spieler'),channel:str(e.channel,'Kanal',40)});
      if(e.kind==='priority') {
        if(!['P1','P2','P3'].includes(e.priority)||!['CHAT_MSG_RAID','CHAT_MSG_RAID_LEADER','CHAT_MSG_RAID_WARNING'].includes(e.channel))throw fail('Ungültige Prio-Meldung.');
        return {...row,itemId:num(e.itemId,'Item-ID',1,1000000),itemName:str(e.itemName,'Item',250),priority:e.priority,players:str(e.players,'Spieler',3000)};
      }
      if(e.kind!=='roll'||e.channel!=='CHAT_MSG_SYSTEM')throw fail('Ungültige Würfelmeldung.');
      const minimum=num(e.minimum,'Minimum',0,1000000),maximum=num(e.maximum,'Maximum',minimum,1000000);
      return {...row,minimum,maximum,roll:num(e.roll,'Wurf',minimum,maximum)};
    });
  }
  out.drops.sort((a,b)=>a.id.localeCompare(b.id));
  return out;
}
const identity=(name,realm)=>norm(name)+'-'+norm(realm).replace(/\s/g,'');
const metadata=value=>{try{return typeof value==='object'&&value?value:JSON.parse(value||'{}');}catch{return {};}};
const yes=v=>['ja','true','1'].includes(String(v||'').toLowerCase());
export function planRaidImport(payload,rows){
 const participants=new Set((payload.participants||[]).map(p=>identity(p.player,p.realm)));
 const receipts=new Set();
 for(const r of payload.receipts||[]){
  // Addon records full raid-roster identities. Never resolve a bare name across realms.
  const dash=r.recipient.indexOf('-');if(dash<1)continue;
  const key=identity(r.recipient.slice(0,dash),r.recipient.slice(dash+1));
  participants.add(key);receipts.add(key+':'+r.itemId);
 }
 return rows.map(row=>{
  const meta=metadata(row.comment),key=identity(row.player,row.server);
  const selected=yes(meta.p0Plus)||yes(meta.p0Selected)||Boolean(meta.p0Item)||(row.p1_item_id&&row.p1_item_id===row.p2_item_id&&row.p1_item_id===row.p3_item_id);
  return {...row,meta,participated:participants.has(key),received:Boolean(selected&&receipts.has(key+':'+row.game_id))};
 });
}
export function createAddonRaidImport({pool,authorize,resolveTarget,writeAudit}){
 let schema;
 const ensure=()=>schema||(schema=pool.query(`create table if not exists guildloot_era_logs (
   guild_id uuid not null references guilds(id) on delete cascade,raid_id uuid not null references raids(id) on delete cascade,
   session_id text not null,digest text not null,payload jsonb not null,created_at timestamptz not null default now(),primary key(guild_id,raid_id,session_id))`).catch(e=>{schema=null;throw e;}));
 async function apply(guild,params){
  await authorize(guild,params);await ensure();const client=await pool.connect();
  try{
   await client.query('begin');
   await client.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))',[String(guild.id),'p0plus-review']);
   const raid=(await client.query(`select *,raid_date::text date_text from raids where guild_id=$1 and (id::text=$2 or external_raid_id=$2) for update`,[guild.id,String(params.raidId||'')])).rows[0];
   if(!raid)throw fail('Raid nicht gefunden.',404);
   const payload=validateRaidExport(params.text,{guild:guild.slug,raidId:String(raid.external_raid_id||raid.id),instanceId:eraInstances[raid.raid_type]});
   if(payload.raidDate!==raid.date_text)throw fail('Das Raiddatum des Exports passt nicht zum ausgewählten Raid.');
   const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
   const previous=(await client.query('select digest from guildloot_era_logs where guild_id=$1 and raid_id=$2 and session_id=$3',[guild.id,raid.id,payload.sessionId])).rows[0];
   if(previous){if(previous.digest!==digest)throw fail('Diese Sitzung wurde schon mit anderen Daten importiert.',409);await client.query('commit');return {success:true,duplicate:true,pointsChanged:false};}
   if(raid.p0plus_transferred_at||['abgesagt','cancelled','canceled'].includes(raid.status))throw fail('Dieser Raid ist bereits abgeschlossen oder abgesagt. Keine Markierungen geändert.',409);
   if((await client.query("select 1 from p0plus_point_audit where guild_id=$1 and raid_id=$2 and action='raid_transfer' limit 1",[guild.id,raid.id])).rows.length)throw fail('Die Punkte dieses Raids wurden bereits übertragen.',409);
   const rows=(await client.query(`select pr.id,pr.character_id,pr.comment,pr.p1_item_id,pr.p2_item_id,pr.p3_item_id,
     c.name player,c.server,i.item_id game_id,i.name item from prios pr join characters c on c.id=pr.character_id
     join players p on p.id=c.player_id and p.guild_id=$1 left join items i on i.id=pr.p1_item_id where pr.raid_id=$2 for update of pr`,[guild.id,raid.id])).rows;
   const plan=planRaidImport(payload,rows),target=plan.some(p=>p.received)?await resolveTarget(client,guild.id,raid,params.targetRaid||''):raid.raid_type;
   let marked=0;const seen=new Set();
   for(const row of plan){
    const old=row.meta.addonAttendance;
    const annotation={state:row.participated||old?.state==='participated'?'participated':'unknown',source:'GuildLoot Era',sessionId:payload.sessionId};
    await client.query('/* prio-audit:apply */ update prios set comment=$1 where id=$2',[JSON.stringify({...row.meta,addonAttendance:annotation}),row.id]);
    if(!row.received||seen.has(row.character_id+':'+row.p1_item_id))continue;seen.add(row.character_id+':'+row.p1_item_id);
    const existing=await client.query(`select 1 from p0plus_point_audit where guild_id=$1 and raid_id=$2 and character_id=$3
      and (item_id=$4 or lower(item_name)=lower($5)) and action in ('item_received_pending','item_received_clear')`,[guild.id,raid.id,row.character_id,row.p1_item_id,row.item]);
    if(existing.rows.length)continue;
    const total=Number((await client.query('select coalesce(sum(points),0) points from p0plus_points where guild_id=$1 and character_id=$2 and item_id=$3',[guild.id,row.character_id,row.p1_item_id])).rows[0]?.points||0);
    await writeAudit(client,{guildId:guild.id,characterId:row.character_id,itemId:row.p1_item_id,raidId:raid.id,raidType:target,playerName:row.player,server:row.server,itemName:row.item,oldPoints:total,newPoints:total,action:'item_received_pending',source:'GuildLoot Era Import',note:'Empfangsmeldung aus Sitzung '+payload.sessionId});marked++;
   }
   await client.query('insert into guildloot_era_logs(guild_id,raid_id,session_id,digest,payload) values($1,$2,$3,$4,$5::jsonb)',[guild.id,raid.id,payload.sessionId,digest,JSON.stringify(payload)]);
   await client.query('commit');
   return {success:true,marked,participants:new Set(plan.filter(p=>p.participated).map(p=>p.character_id)).size,unknown:new Set(plan.filter(p=>!p.participated&&p.meta.addonAttendance?.state!=='participated').map(p=>p.character_id)).size,pointsChanged:false,warning:payload.captureWarning||payload.syncWarning||payload.unresolvedLoot};
  }catch(e){await client.query('rollback').catch(()=>{});throw e;}finally{client.release();}
 }
 return {apply};
}
export function compareAttendance(addon,wcl){
 const recorded=addon?.state==='participated';
 const conflict=recorded&&['not_found','bench'].includes(wcl);
 const confirmed=recorded||wcl==='participated';
 const label=(recorded?'Addon: teilgenommen':'Addon: nicht erfasst')+' · '+({participated:'WCL: teilgenommen',bench:'WCL: Bank',not_found:'WCL: nicht gefunden',ambiguous:'WCL: Name nicht eindeutig',no_data:'WCL: kein passendes Log'}[wcl]||'WCL: unbekannt');
 return {confirmed,needsReview:conflict||!confirmed,label:label+(conflict?' — Widerspruch prüfen':!confirmed?' — Teilnahme prüfen':'')};
}
