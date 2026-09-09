// Public raid overview: explicit field allowlists, no credentials or raw exports.
export function archiveLoot(payloads) {
  const seen = new Set(), receipts = [];
  for (const payload of payloads) for (const row of payload.receipts || []) {
    const key = `${payload.sessionId}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    receipts.push({player:row.recipient,itemId:row.itemId,item:row.itemName,
      quantity:row.quantity,time:row.observedAt});
  }
  return receipts.sort((a,b)=>a.time-b.time);
}
const norm = value => String(value||'').normalize('NFC').trim().toLocaleLowerCase('de-DE');
export function decorateLoot(loot, priorities, metadata = new Map()) {
  const awards = priorities.filter(p=>p.p0ItemReceived === true && p.p0Item);
  return loot.map(row=>{
    const item = metadata.get(String(row.itemId)) || {};
    const award = awards.find(p=>norm(`${p.player}-${p.server}`) === norm(row.player)
      && (String(p.p0ItemId||'') === String(row.itemId) || norm(p.p0Item) === norm(row.item)));
    const kind = `${item.type||''} ${item.category||''} ${item.slot||''}`.toLowerCase();
    const category = [2,4].includes(item.itemClass) ? 'equipment' : [5,7].includes(item.itemClass) ? 'materials' : item.itemClass !== undefined ? 'other' : /trade goods|reagen|material|handwerks|handelsware/.test(kind) ? 'materials'
      : /armor|weapon|rüstung|waffe|kopf|head|chest|brust|hands|hände|finger|trinket|schmuck|neck|hals|feet|füße|legs|beine|shoulder|schulter|wrist|handgelenk|waist|taille|back|rücken|off.hand|shield|schild/.test(kind) ? 'equipment' : 'other';
    return {...row,iconUrl:item.iconUrl||'',quality:item.quality??'',category,
      p0Received:Boolean(award),p0Recipient:award?`${award.player}-${award.server}`:''};
  });
}
export function installRaidArchive(app, {query, requireGuild, resolveGuildSlug, getPublishedPrios, getItemMetadata=async()=>new Map()}) {
  app.get('/api/public/raid-archive', async(req,res,next)=>{
    try {
      const guild = await requireGuild(resolveGuildSlug(req.query.guild));
      const raidId = String(req.query.raidId || '');
      const current = req.query.scope === 'current';
      const offset = Math.max(0, Math.min(100000, Number.parseInt(req.query.offset,10)||0));
      const result = await query(`select id, external_raid_id, name, raid_type, raid_date, raid_time, (raid_date < timezone('Europe/Berlin',now())::date) as past
        from raids where guild_id=$1 and deleted_at is null
        and ($2<>'' or ($4=false and raid_date < timezone('Europe/Berlin',now())::date)
          or ($4=true and raid_date >= timezone('Europe/Berlin',now())::date and lower(coalesce(status,'')) not in ('archiviert','archive','archived','abgesagt','cancelled','canceled')))
        and lower(coalesce(status,'')) not in ('gelöscht','geloescht','deleted')
        and ($2='' or external_raid_id=$2 or id::text=$2)
        order by raid_date desc, raid_time desc, id limit 101 offset $3`,[guild.id,raidId,raidId?0:offset,current]);
      const raids = result.rows.slice(0,100).map(row=>({id:row.external_raid_id||row.id,
        title:row.name||row.raid_type,type:row.raid_type,
        date:row.raid_date instanceof Date?row.raid_date.toISOString().slice(0,10):String(row.raid_date).slice(0,10),time:row.raid_time}));
      if (!raidId) {
        const exists = await query("select to_regclass('guildloot_era_logs') as logs");
        const recorded = exists.rows[0]?.logs && result.rows.length ? await query(
          'select distinct raid_id from guildloot_era_logs where guild_id=$1 and raid_id=any($2::uuid[])',
          [guild.id,result.rows.slice(0,100).map(row=>row.id)]) : {rows:[]};
        const ids = new Set(recorded.rows.map(row=>String(row.raid_id)));
        raids.forEach((raid,i)=>raid.hasLootLog=ids.has(String(result.rows[i].id)));
        return res.json({success:true,raids,hasMore:result.rows.length>100});
      }
      if (!raids.length) return res.status(404).json({success:false,error:'Raid nicht gefunden.'});
      const exists = await query("select to_regclass('guildloot_era_logs') as logs");
      const logs = exists.rows[0]?.logs ? await query('select payload from guildloot_era_logs where guild_id=$1 and raid_id=$2 order by created_at',[guild.id,result.rows[0].id]) : {rows:[]};
      const priorities = await getPublishedPrios({guildId:guild.id,query:{raidId:raids[0].id}});
      const priosVisible = result.rows[0].past === true || priorities.published === true;
      const prio = value => priosVisible ? value : (value ? 'gesetzt' : '–');
      const prios = (priorities.prios||[]).map(p=>({player:p.player,server:p.server,className:p.className,
        p1:prio(p.p1),p2:prio(p.p2),p3:prio(p.p3),p0:p.p0Item}));
      const receipts=archiveLoot(logs.rows.map(row=>row.payload));
      const metadata=await getItemMetadata([...new Set(receipts.map(row=>row.itemId))]);
      const loot=decorateLoot(receipts,priorities.prios||[],metadata);
      res.setHeader('Cache-Control','no-store');
      res.json({success:true,raid:raids[0],prios,priosVisible,hasLootLog:logs.rows.length>0,loot});
    } catch(error) { next(error); }
  });
}
