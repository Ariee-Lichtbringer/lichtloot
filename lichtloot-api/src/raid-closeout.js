import { loadRaidCompletion } from './raid-completion.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

const yes = value => ['ja','true','1','p0','po','p0+'].includes(String(value ?? '').trim().toLowerCase());
const metaOf = value => { try { return typeof value === 'object' && value ? value : JSON.parse(value || '{}'); } catch { return {}; } };
const fail = (message, statusCode=409) => Object.assign(new Error(message), {statusCode});
const inactive = new Set(['abgesagt','cancelled','canceled','deleted','gelöscht','geloescht']);

export function createRaidCloseoutService({pool, secret, authorize, configuration, resolveTarget, plusEnabled, itemPlus, staffBenchSql, reminderQueueSql}) {
  const token = value => createHmac('sha256',secret).update(JSON.stringify(value)).digest('hex');
  const tokenMatches = (a,b) => typeof a==='string' && /^[a-f0-9]{64}$/.test(a) && timingSafeEqual(Buffer.from(a),Buffer.from(b));

  async function build(client,guild,params,write=false) {
    if (!params.raidId) throw fail('Bitte einen konkreten Raid auswählen.',400);
    const raid=(await client.query(`select r.*,r.raid_date::text as date_text,
      case when coalesce(r.raid_time,'') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
        then ((r.raid_date+r.raid_time::time) at time zone 'Europe/Berlin') <= now() else false end as has_started
      from raids r where r.guild_id=$1 and (r.id::text=$2 or r.external_raid_id=$2)
      ${write?'for update of r':''}`, [guild.id,String(params.raidId)])).rows[0];
    if(!raid) throw fail('Raid wurde in dieser Gilde nicht gefunden.',404);
    await authorize(guild,params,raid,write);
    const config=await configuration(client,guild);
    const enabled=plusEnabled(config.layout,raid.raid_type);
    const completion=await loadRaidCompletion(client,guild.id,raid,{enabled});
    const raidActive=completion!=='cancelled' && !raid.deleted_at && !inactive.has(String(raid.status||'').toLowerCase());
    let targetRaid=raid.raid_type,targetError='';
    try { targetRaid=await resolveTarget(client,guild.id,raid,params.targetRaid||''); }
    catch(error) { targetRaid='';targetError=error.message; }
    // Only aliases of the same occurrence: another time on the same day is a separate raid.
    const related=(await client.query(`select id,external_raid_id,raid_pin,p0plus_transfer_reset_at
      from raids where guild_id=$1 and lower(raid_type)=lower($2) and raid_date=$3
      and coalesce(raid_time,'')=coalesce($4,'') order by id`,[guild.id,raid.raid_type,raid.date_text,raid.raid_time])).rows;
    const raidIds=related.map(r=>r.id);
    const notes=[...new Set(related.flatMap(r=>[`RaidID: ${r.external_raid_id||r.id}`,`RaidID: ${r.id}`,r.raid_pin?`RaidID: ${r.raid_pin}`:'']).filter(Boolean))];
    const rows=(await client.query(`select pr.id,pr.raid_id,pr.character_id,pr.comment,pr.updated_at,pr.p1_item_id,pr.p2_item_id,pr.p3_item_id,
      c.name player,c.server,i.name item,i.item_id game_id,${staffBenchSql()} staff_benched,
      (select s.status from raid_signups s where s.raid_id=pr.raid_id and s.character_id=pr.character_id limit 1) signup_status
      from prios pr join characters c on c.id=pr.character_id join players p on p.id=c.player_id and p.guild_id=$1
      left join items i on i.id=pr.p1_item_id where pr.raid_id=any($2::uuid[])
      order by case when pr.raid_id=$3 then 0 else 1 end,pr.updated_at desc,pr.id`,[guild.id,raidIds,raid.id])).rows;
    const ledger=(await client.query(`select pp.id,pp.character_id,pp.item_id,pp.points,pp.created_at,pp.note,i.name item,i.raid_type
      from p0plus_points pp join items i on i.id=pp.item_id
      where pp.guild_id=$1 and pp.source='Raidlead Transfer' and pp.note=any($2::text[]) order by pp.id`,[guild.id,notes])).rows;
    const audits=(await client.query(`select a.* from p0plus_point_audit a left join raids r on r.id=a.raid_id
      where a.guild_id=$1 and (a.raid_id=any($2::uuid[]) or (a.raid_id is null and lower(a.raid_type)=lower($3)
        and (a.created_at at time zone 'Europe/Berlin')::date=$4::date and a.action in ('item_received_pending','item_received_clear'))) and
      (a.action <> 'raid_transfer' or r.p0plus_transfer_reset_at is null or a.created_at>=r.p0plus_transfer_reset_at)
      order by a.id`,[guild.id,raidIds,targetRaid,raid.date_text])).rows;
    const queue=(await client.query(`select q.id,q.status,q.payload,q.created_at,${reminderQueueSql()} as current
      from bot_update_queue q where q.guild_id=$1 and q.type='raid_missing_prio_reminder'
      and q.status in ('open','processing') and (q.payload->>'raidId'=any($2::text[])) order by q.id`,
      [guild.id,related.flatMap(r=>[String(r.id),r.external_raid_id||'']).filter(Boolean)])).rows;
    const findings=[],actions=[],seen=new Set();
    const add=(kind,key,title,detail,extra={})=>findings.push({id:`${kind}:${key}`,kind,title,detail,...extra});
    const pending=audits.filter(a=>a.action==='item_received_pending' && !audits.some(b=>b.action==='item_received_clear' && b.character_id===a.character_id && b.item_id===a.item_id && b.raid_id===a.raid_id));
    for(const a of pending) add('received_pending',a.id,'Item-Erhalt noch offen',`${a.player_name} · ${a.item_name}: Die vorgemerkte Punkte-Löschung ist noch nicht abgeschlossen.`,{player:a.player_name,item:a.item_name});
    for(const row of rows) {
      if(seen.has(row.character_id)) continue;
      seen.add(row.character_id);
      const meta=metaOf(row.comment);
      const same=row.p1_item_id && row.p1_item_id===row.p2_item_id && row.p1_item_id===row.p3_item_id;
      const selected=yes(meta.p0Selected)||yes(meta.p0Plus)||Boolean(meta.p0Item)||same;
      if(!selected || !row.item) continue;
      const configured=enabled && Boolean(targetRaid) && await itemPlus(guild.id,row.game_id||row.p1_item_id,row.item,targetRaid,{client,layout:config.layout});
      const plus=yes(meta.p0Plus);
      const receipt=audits.some(a=>a.character_id===row.character_id && ['item_received_pending','item_received_clear'].includes(a.action));
      const awarded=ledger.filter(e=>e.character_id===row.character_id);
      const historical=audits.filter(a=>a.character_id===row.character_id&&a.action==='raid_transfer');
      const target=targetRaid?(await client.query(`select id from items where lower(raid_type)=lower($1)
        and (($2<>'' and item_id=$2) or ($2='' and lower(name)=lower($3))) order by created_at,id limit 1`,[targetRaid,row.game_id||'',row.item])).rows[0]:null;
      const current=target?Number((await client.query(`select coalesce(sum(points),0)::numeric points from p0plus_points where guild_id=$1 and character_id=$2 and item_id=$3`,[guild.id,row.character_id,target.id])).rows[0].points):0;
      const siblingPrios=rows.filter(r=>r.character_id===row.character_id && r.game_id===row.game_id);
      const base={characterId:row.character_id,player:row.player,server:row.server,item:row.item,itemId:target?.id||null,
        prioIds:siblingPrios.map(r=>r.id).sort(),comments:siblingPrios.map(r=>({id:r.id,comment:r.comment})).sort((a,b)=>a.id.localeCompare(b.id)),currentPoints:current};
      if(configured&&!plus) {
        const id=`flag:${row.character_id}`;
        add('missing_flag',row.character_id,'P0+-Kennzeichen fehlt',`${row.player} · ${row.item} ist als P0 ohne Plus gespeichert.`,{...base,actionId:id,before:'P0',after:'P0+'});
        if(raid.has_started&&raidActive)actions.push({...base,id,type:'flag',label:`${row.player}: P0 → P0+`,points:0});
      }
      const absent=['absent','declined','rejected','abgemeldet','abwesend','nein'].includes(String(row.signup_status||'').toLowerCase());
      if(completion!=='manual' && !absent && Number(config.rules.p0Plus.raidTransferPoints||0)>0 && (plus||configured) && enabled && raid.has_started && raidActive && !receipt && !awarded.length && !historical.length) {
        const points=Number(config.rules.p0Plus.raidTransferPoints||0),id=`points:${row.character_id}`;
        const canCorrect=Boolean(target) && points>0 && !absent && (plus||configured);
        add('missing_points',row.character_id,'P0+-Übertragung fehlt',`${row.player} · ${row.item}: Für diesen Raid ist keine Punktebuchung vorhanden.`,
          {...base,actionId:canCorrect?id:null,before:current,after:current+points,points,bench:row.staff_benched===true,attendance:absent?'abgemeldet':row.staff_benched?'Bank':row.signup_status?'angemeldet':'nicht bestätigt',requiresAttendance:true});
        if(canCorrect)actions.push({...base,id,type:'points',label:`${row.player}: ${current} → ${current+points} Punkte`,points,repairFlag:configured&&!plus});
      }
    }
    const groups=new Map();
    for(const e of ledger){if(!groups.has(e.character_id))groups.set(e.character_id,[]);groups.get(e.character_id).push(e);}
    for(const [characterId,entries] of groups)if(entries.length>1){
      const player=rows.find(r=>r.character_id===characterId)?.player||audits.find(a=>a.character_id===characterId)?.player_name||'Spieler';
      add('duplicate_points',characterId,'Mehrere Punktebuchungen prüfen',`${player}: ${entries.length} Transferbuchungen für denselben Raid.`,
        {player,entries:entries.map(e=>({id:e.id,item:e.item,points:Number(e.points)})),total:entries.reduce((s,e)=>s+Number(e.points),0)});
    }
    for(const q of queue.filter(q=>!q.current)){
      const id=`reminder:${q.id}`;
      add('stale_reminder',q.id,'Veraltete Erinnerung wartet',`Eine Erinnerung vom ${String(q.payload.raidDate||'unbekannten Termin')} ist noch ${q.status==='processing'?'in Bearbeitung':'offen'}.`,{actionId:id,before:'Wartend',after:'Erledigt'});
      actions.push({id,type:'reminder',queueId:q.id,label:'Veraltete Erinnerung als erledigt markieren',payload:q.payload,points:0});
    }
    findings.sort((a,b)=>a.id.localeCompare(b.id));actions.sort((a,b)=>a.id.localeCompare(b.id));
    const counts={missingFlags:findings.filter(f=>f.kind==='missing_flag').length,missingPoints:findings.filter(f=>f.kind==='missing_points').length,
      duplicates:findings.filter(f=>f.kind==='duplicate_points').length,reminders:findings.filter(f=>f.kind==='stale_reminder').length,pendingReceipts:pending.length};
    const snapshot={guildId:guild.id,raidId:raid.id,targetRaid,raidActive,hasStarted:raid.has_started,findings,actions,ledger,audits};
    return {raid,actions,report:{success:true,raid:{id:raid.id,name:raid.name,type:raid.raid_type,date:raid.date_text,time:raid.raid_time},targetRaid,targetError,
      completion,hasStarted:raid.has_started,canApply:raidActive||actions.some(a=>a.type==='reminder'),status:!raidActive?'inactive':targetError?'attention':!raid.has_started?'upcoming':findings.length?'attention':'clear',
      checkedAt:new Date().toISOString(),counts,findings,actions:actions.map(({comments,payload,...a})=>a),reviewToken:token(snapshot)}};
  }

  async function review(guild,params) {
    const client=await pool.connect();
    try {await client.query('begin isolation level repeatable read read only');const data=await build(client,guild,params);await client.query('rollback');return data.report;}
    catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}
  }
  async function apply(guild,params) {
    const client=await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))',[String(guild.id),'p0plus-review']);
      const {raid,report,actions}=await build(client,guild,params,true);
      if(!report.canApply)throw fail('Dieser Raid ist abgesagt oder gelöscht.');
      if(!tokenMatches(params.reviewToken,report.reviewToken))throw fail('Prios oder Punktestände haben sich geändert. Bitte den Abschlusscheck neu laden.');
      const selected=params.actionIds;
      if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(id=>!actions.some(a=>a.id===id)))throw fail('Bitte gültige Korrekturen auswählen.',400);
      const chosen=actions.filter(a=>selected.includes(a.id));
      if(chosen.some(a=>a.type==='points')&&params.attendanceConfirmed!==true)throw fail('Bitte Teilnahme und erhaltene Items vor der Punktebuchung bestätigen.',400);
      const repaired=new Set(),results=[];
      for(const a of chosen){
        if(a.type==='reminder'){
          const done=await client.query(`update bot_update_queue set status='done',resolved_at=now(),payload=payload||'{"skipReason":"raid_closeout"}'::jsonb
            where id=$1 and guild_id=$2 and status in ('open','processing')`,[a.queueId,guild.id]);
          if(done.rowCount!==1)throw fail('Die Erinnerung wurde inzwischen verarbeitet. Bitte neu prüfen.');
        }else{
          if(a.type==='flag'||a.repairFlag)for(const before of a.comments){
            if(repaired.has(before.id))continue;
            const old=metaOf(before.comment),next={...old,p0Selected:'ja',p0Plus:'ja',p0Item:a.item};
            const changed=await client.query(`update prios set comment=$1,updated_at=now() where id=$2 and comment is not distinct from $3`,[JSON.stringify(next),before.id,before.comment]);
            if(changed.rowCount!==1)throw fail('Ein Prio-Eintrag wurde inzwischen geändert. Bitte neu prüfen.');
            repaired.add(before.id);
          }
          if(a.type==='points')await client.query(`insert into p0plus_points(guild_id,character_id,item_id,points,source,note)
            values($1,$2,$3,$4,'Raidlead Transfer',$5)`,[guild.id,a.characterId,a.itemId,a.points,`RaidID: ${raid.external_raid_id||raid.id}`]);
          await client.query(`insert into p0plus_point_audit(guild_id,character_id,item_id,raid_id,raid_type,player_name,server,item_name,old_points,new_points,delta_points,action,source,note)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Raid-Abschlusscheck',$13)`,
            [guild.id,a.characterId,a.itemId,raid.id,report.targetRaid,a.player,a.server,a.item,a.currentPoints,a.currentPoints+a.points,a.points,
             a.type==='points'?'raid_transfer':'p0_flag_repair',a.type==='points'?'Teilnahme und Item-Erhalt durch Raidleitung bestätigt.':`P0+-Kennzeichen korrigiert. Vorher: ${JSON.stringify(a.comments)}`]);
        }
        results.push({id:a.id,label:a.label,points:a.points});
      }
      await client.query('commit');return {success:true,applied:results.length,points:results.reduce((s,a)=>s+a.points,0),results};
    }catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}
  }
  return {review,apply};
}
