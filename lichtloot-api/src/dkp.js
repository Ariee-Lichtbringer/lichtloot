import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const text = value => String(value ?? '').trim();
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text(value));
export function lootSystem(value = 'prio') {
  if (!['prio', 'dkp'].includes(value)) fail('Lootsystem muss Prio oder DKP sein.');
  return value;
}
export function dkpAmount(value) {
  const raw = text(value).replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) fail('Bitte positive DKP mit höchstens zwei Nachkommastellen eingeben.');
  return Number(raw).toFixed(2);
}

export function createDkpService({ pool, query, authorize, authorizeMode }) {
  let schema;
  async function ensure() {
    if (!schema) schema = readFile(new URL('../migrations/040_dkp.sql', import.meta.url), 'utf8')
      .then(sql => query(sql)).catch(error => { schema = null; throw error; });
    return schema;
  }
  async function mode(client, guildId) {
    const r = await client.query('select layout_json from guild_settings where guild_id=$1', [guildId]);
    return r.rows[0]?.layout_json?.lootSystem === 'dkp' ? 'dkp' : 'prio';
  }
  async function assertPrio(guildId) {
    if (await mode({query}, guildId) === 'dkp') fail('Diese Gilde verwendet DKP. Bitte die DKP-Lootvergabe öffnen.', 409);
  }
  async function validateMode(client, guildId, value) {
    lootSystem(value);
    if (value !== 'dkp') {
      await ensure();
      const open = await client.query("select id from dkp_auctions where guild_id=$1 and status='open' limit 1", [guildId]);
      if (open.rows.length) fail('Vor dem Wechsel zu Prio bitte alle DKP-Auktionen abschließen oder abbrechen.', 409);
    }
  }
  async function authenticate(client, guild, params, write = false) {
    if (text(params.masterCode)) {
      authorize(guild, params);
      return { manager: true, own: [] };
    }
    if (write && !['bid','saveStartBids'].includes(params.action)) fail('Für diese Änderung ist der Leitungscode erforderlich.', 403);
    const result = await client.query(
      `select c.id from characters c join players p on p.id=c.player_id
       where p.guild_id=$1 and p.player_pin=$2`, [guild.id, text(params.playerPin).toUpperCase()]);
    if (!result.rows.length) fail('SpielerLogin gehört nicht zu dieser Gilde.', 403);
    return { manager: false, own: result.rows.map(row => row.id) };
  }
  async function balance(client, guildId, characterId, excludeAuction = null) {
    const r = await client.query(
      `select coalesce((select sum(amount) from dkp_ledger where guild_id=$1 and character_id=$2),0) as balance,
       coalesce((select sum(high_bid) from dkp_auctions where guild_id=$1 and winner_id=$2 and status='open'
         and ($3::uuid is null or id<>$3)),0) as reserved`, [guildId, characterId, excludeAuction]);
    return { balance: Number(r.rows[0].balance), reserved: Number(r.rows[0].reserved) };
  }
  const defaultRules = {attendance:0,bench:0,punctual:0,minimum:1,fixedPrice:0,decayPercent:0,pricing:'manual'};
  async function rulesFor(client,guildId) {
    const found=await client.query('select rules,revision from dkp_rules where guild_id=$1',[guildId]);
    return {rules:{...defaultRules,...found.rows[0]?.rules},revision:found.rows[0]?.revision || 0};
  }
  async function state(guild, params) {
    await ensure();
    const client = await pool.connect();
    try {
      await client.query('begin isolation level repeatable read read only');
      const auth = await authenticate(client, guild, params);
      const accounts = await client.query(
        `select c.id,c.name,c.server,c.class_name,
          coalesce(l.balance,0) as balance,coalesce(a.reserved,0) as reserved
         from characters c join players p on p.id=c.player_id
         left join (select character_id,sum(amount) as balance from dkp_ledger where guild_id=$1 group by character_id) l on l.character_id=c.id
         left join (select winner_id,sum(high_bid) as reserved from dkp_auctions where guild_id=$1 and status='open' group by winner_id) a on a.winner_id=c.id
         where p.guild_id=$1 order by coalesce(l.balance,0) desc,lower(c.name),lower(c.server)`, [guild.id]);
      const auctions = await client.query(
        `select a.id,a.item,a.raid,a.min_bid,a.high_bid,a.status,a.winner_id,a.created_at,a.closed_at,
         c.name as winner_name,c.server as winner_server
         from dkp_auctions a left join characters c on c.id=a.winner_id
         where a.guild_id=$1 order by (a.status='open') desc,a.created_at desc limit 100`, [guild.id]);
      const offset = Math.max(0, Math.min(1000000, Math.trunc(Number(params.offset) || 0)));
      const ledger = await client.query(
        `select l.id,l.character_id,c.name,c.server,l.amount,l.kind,l.reason,l.item,l.raid,l.created_at,l.actor_role
         from dkp_ledger l left join characters c on c.id=l.character_id
         where l.guild_id=$1 and ($3::text='' or l.item=$3) and ($4::boolean=false or l.kind in ('loot','auction')) order by l.created_at desc,l.id desc limit 101 offset $2`, [guild.id, offset,text(params.item),params.lootOnly===true]);
      const result = {success:true,lootSystem:await mode(client,guild.id),manager:auth.manager,own:auth.own,
        accounts:accounts.rows.map(r=>({...r,balance:Number(r.balance),reserved:Number(r.reserved)})),auctions:auctions.rows,
        ledger:ledger.rows.slice(0,100),hasMore:ledger.rows.length>100,offset};
      if(params.includeStartBids === true && result.lootSystem === 'dkp') {
        result.startBids=(await client.query(`select b.character_id,b.raid,b.bids,b.revision,b.updated_at,c.name,c.server
          from dkp_start_bids b join characters c on c.id=b.character_id join players p on p.id=c.player_id
          where b.guild_id=$1 and p.guild_id=$1 and b.raid=$2 order by lower(c.name),lower(c.server)`,[guild.id,text(params.raid).toLowerCase()])).rows;
      }
      Object.assign(result,await rulesFor(client,guild.id));
      if(params.includeRaids && auth.manager && result.lootSystem==='dkp') {
        result.raids=(await client.query(`select id,name,raid_type,raid_date::text from raids where guild_id=$1 and raid_date<=current_date order by raid_date desc limit 100`,[guild.id])).rows;
        result.channels=(await client.query('select channel_id,channel_name from discord_bot_channels where guild_id=$1 and can_send=true order by channel_name',[guild.id])).rows;
        if(uuid(params.raidId)) {
          result.roster=(await client.query(`select c.id,c.name,c.server,s.status from raid_signups s join raids r on r.id=s.raid_id join characters c on c.id=s.character_id join players p on p.id=c.player_id where r.guild_id=$1 and p.guild_id=$1 and r.id=$2 order by c.name`,[guild.id,params.raidId])).rows;
          result.awarded=(await client.query('select details from dkp_awards where guild_id=$1 and award_key=$2',[guild.id,'raid:'+params.raidId])).rows[0]?.details || null;
        }
      }
      await client.query('commit');
      return result;
    } catch(error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
  async function change(guild, params) {
    await ensure();
    if (!uuid(params.requestId)) fail('Eine gültige Vorgangs-ID ist erforderlich.');
    const action = text(params.action);
    if (!['book','openAuction','bid','closeAuction','cancelAuction','setMode','setBalance','saveRules','awardRaid','decay','postDiscord','saveStartBids'].includes(action)) fail('Unbekannte DKP-Aktion.');
    // Credentials never enter the journal or idempotency records.
    const payload = {action,characterIds:params.characterIds,characterId:params.characterId,amount:params.amount,
      kind:params.kind,reason:params.reason,item:params.item,raid:params.raid,auctionId:params.auctionId,lootSystem:params.lootSystem,expectedBalance:params.expectedBalance,rules:params.rules,revision:params.revision,raidId:params.raidId,roster:params.roster,confirmed:params.confirmed,channelId:params.channelId,description:params.description,period:params.period,balances:params.balances,bids:params.bids};
    const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('begin');
      // Serialize bookings, bids, settlement and mode changes across server instances.
      await client.query('select id from guilds where id=$1 for update',[guild.id]);
      const auth = await authenticate(client,guild,params,true);
      if(action==='setMode') authorizeMode(guild,params);
      if(['bid','saveStartBids'].includes(action) && (!uuid(params.characterId) || (!auth.manager && !auth.own.includes(params.characterId)))) fail('Dieser Charakter gehört nicht zu deinem SpielerLogin.',403);
      const previous = await client.query('select fingerprint,result from dkp_requests where guild_id=$1 and request_id=$2',[guild.id,params.requestId]);
      if(previous.rows.length){
        if(previous.rows[0].fingerprint!==fingerprint) fail('Diese Vorgangs-ID wurde bereits für andere Daten verwendet.',409);
        await client.query('commit');return {...previous.rows[0].result,replayed:true};
      }
      if(action!=='setMode' && await mode(client,guild.id)!=='dkp') fail('DKP ist für diese Gilde noch nicht aktiviert.',409);
      let result={success:true};
      const character = async id => {
        if(!uuid(id)) fail('Ungültiger Charakter.');
        const r=await client.query('select c.id from characters c join players p on p.id=c.player_id where c.id=$1 and p.guild_id=$2',[id,guild.id]);
        if(!r.rows.length) fail('Charakter gehört nicht zu dieser Gilde.',403);
      };
      const entry = async (id,amount,kind,reason,item,raid,auctionId=null) => {
        await client.query(`insert into dkp_ledger(id,guild_id,character_id,amount,kind,reason,item,raid,auction_id,actor_role)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,'Leitung')`,[randomUUID(),guild.id,id,amount,kind,reason,item,raid,auctionId]);
      };
      if(action==='saveStartBids'){
        await character(params.characterId);
        const raid=text(params.raid).toLowerCase();
        if(!/^[a-z0-9_-]{1,32}$/.test(raid)) fail('Bitte einen gültigen Raid auswählen.');
        if(!Array.isArray(params.bids) || params.bids.length>3) fail('Maximal drei Startgebote pro Charakter und Raid sind möglich.');
        const bids=params.bids.map(b=>{
          const item=text(b?.item);
          if(!item || item.length>200) fail('Bitte ein gültiges Item auswählen.');
          return {item,amount:dkpAmount(b.amount)};
        });
        if(new Set(bids.map(b=>b.item.toLocaleLowerCase('de-DE'))).size!==bids.length) fail('Jedes Item darf nur einmal vorgemerkt werden.');
        const old=(await client.query('select revision from dkp_start_bids where guild_id=$1 and character_id=$2 and raid=$3',[guild.id,params.characterId,raid])).rows[0];
        if(!Number.isInteger(params.revision) || params.revision!==(old?.revision || 0)) fail('Startgebote wurden inzwischen geändert. Bitte neu laden.',409);
        // Non-binding wishes: no auction, reservation or ledger entry is created here.
        await client.query(`insert into dkp_start_bids(guild_id,character_id,raid,bids,revision) values($1,$2,$3,$4,1)
          on conflict(guild_id,character_id,raid) do update set bids=$4,revision=dkp_start_bids.revision+1,updated_at=now()`,[guild.id,params.characterId,raid,JSON.stringify(bids)]);
        result.revision=(old?.revision || 0)+1;
      } else if(action==='setMode'){
        await validateMode(client,guild.id,params.lootSystem);
        await client.query(`insert into guild_settings(guild_id,layout_json) values($1,jsonb_build_object('lootSystem',$2::text))
          on conflict(guild_id) do update set layout_json=jsonb_set(coalesce(guild_settings.layout_json,'{}'::jsonb),'{lootSystem}',to_jsonb($2::text)),updated_at=now()`,[guild.id,params.lootSystem]);
        result.lootSystem=params.lootSystem;
      } else if(action==='saveRules'){
        authorizeMode(guild,params);
        const previousRules=await rulesFor(client,guild.id);
        if(params.revision!==previousRules.revision) fail('Regeln wurden inzwischen geändert. Bitte neu laden.',409);
        const rules={};
        for(const key of ['attendance','bench','punctual','minimum','fixedPrice','decayPercent']){
          const raw=text(params.rules?.[key]);
          if(!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) fail('Regeln benötigen nichtnegative Zahlen mit maximal zwei Nachkommastellen.');
          rules[key]=Number(raw);
        }
        rules.pricing=params.rules?.pricing;
        if(!['manual','fixed'].includes(rules.pricing) || rules.minimum<=0 || rules.decayPercent>100 || (rules.pricing==='fixed' && rules.fixedPrice<=0)) fail('Bitte Mindestgebot, Festpreis und Verfall prüfen.');
        await client.query(`insert into dkp_rules(guild_id,rules,revision) values($1,$2,1) on conflict(guild_id) do update set rules=$2,revision=dkp_rules.revision+1`,[guild.id,JSON.stringify(rules)]);
      } else if(action==='awardRaid'){
        if(!uuid(params.raidId) || params.confirmed!==true) fail('Bitte die tatsächliche Teilnahme bestätigen.');
        const raid=(await client.query('select name,raid_type,raid_date::text from raids where id=$1 and guild_id=$2 and raid_date<=current_date',[params.raidId,guild.id])).rows[0];
        if(!raid) fail('Vergangener Raid dieser Gilde nicht gefunden.',404);
        const roster=params.roster;
        if(!Array.isArray(roster)||!roster.length||roster.length>80||new Set(roster.map(x=>x.id)).size!==roster.length) fail('Bitte eine eindeutige Teilnehmerliste mit 1–80 Charakteren bestätigen.');
        const {rules,revision}=await rulesFor(client,guild.id);
        if(params.revision!==revision) fail('Die DKP-Regeln haben sich geändert. Bitte Vorschau neu laden.',409);
        const key='raid:'+params.raidId;
        if((await client.query('select 1 from dkp_awards where guild_id=$1 and award_key=$2',[guild.id,key])).rows.length) fail('Für diesen Raid wurden bereits DKP vergeben. Korrekturen bitte mit Begründung buchen.',409);
        let count=0;
        for(const row of roster){
          await character(row.id);
          if(!['attended','bench','absent'].includes(row.status)||typeof row.punctual!=='boolean') fail('Ungültiger Teilnahmestatus.');
          const amount=row.status==='absent'?0:(row.status==='bench'?rules.bench:rules.attendance)+(row.punctual?rules.punctual:0);
          if(amount>0){await entry(row.id,amount.toFixed(2),'credit',(row.status==='bench'?'Ersatzbank':'Raidteilnahme')+(row.punctual?' + pünktlich':''),'',text(raid.raid_type+' · '+raid.raid_date).slice(0,120));count++;}
        }
        if(!count) fail('Die Vorschau enthält keine Gutschrift. Bitte Regeln und Teilnehmer prüfen.');
        await client.query('insert into dkp_awards(guild_id,award_key,details) values($1,$2,$3)',[guild.id,key,JSON.stringify({roster,rules,count})]);
        result.count=count;
      } else if(action==='decay'){
        authorizeMode(guild,params);
        const {rules,revision}=await rulesFor(client,guild.id);
        const period=(await client.query("select to_char(current_date,'YYYY-MM') as period")).rows[0].period;
        if(params.period!==period || params.confirmed!==true || params.revision!==revision || rules.decayPercent<=0) fail('Bitte aktuellen Monat und Verfallsvorschau bestätigen.',409);
        if((await client.query("select 1 from dkp_auctions where guild_id=$1 and status='open' limit 1",[guild.id])).rows.length) fail('Bitte vor dem Verfall alle Auktionen beenden.',409);
        if((await client.query('select 1 from dkp_awards where guild_id=$1 and award_key=$2',[guild.id,'decay:'+period])).rows.length) fail('Der Verfall wurde diesen Monat bereits gebucht.',409);
        const accounts=(await client.query('select character_id,sum(amount) as balance from dkp_ledger where guild_id=$1 group by character_id having sum(amount)>0',[guild.id])).rows;
        if(!Array.isArray(params.balances) || accounts.some(a=>!params.balances.some(b=>b.id===a.character_id && Number(b.balance)===Number(a.balance)))) fail('Kontostände wurden seit der Vorschau geändert. Bitte neu laden.',409);
        let count=0;
        for(const a of accounts){const amount=Math.round(Number(a.balance)*rules.decayPercent)/100;if(amount>0){await entry(a.character_id,-amount,'adjustment',`Monatlicher DKP-Verfall ${rules.decayPercent}% · ${period}`,'','');count++;}}
        await client.query('insert into dkp_awards(guild_id,award_key,details) values($1,$2,$3)',[guild.id,'decay:'+period,JSON.stringify({rules,count})]);result.count=count;
      } else if(action==='postDiscord'){
        const channel=text(params.channelId),description=text(params.description);
        if(!description || description.length>3800) fail('Discord-Text muss 1–3800 Zeichen enthalten.');
        const allowed=await client.query('select channel_id from discord_bot_channels where guild_id=$1 and channel_id=$2 and can_send=true',[guild.id,channel]);
        if(!allowed.rows.length) fail('Bitte einen verfügbaren Discord-Kanal dieser Gilde wählen.',403);
        await client.query(`insert into bot_update_queue(id,guild_id,type,status,payload) values($1,$2,'dkp_discord_post','open',$3)`,[randomUUID(),guild.id,JSON.stringify({embedType:'custom',title:'GuildLoot · DKP',description,channelId:channel,color:'gold'})]);
        result.queued=true;
      } else if(action==='setBalance'){
        await character(params.characterId);
        const raw=text(params.amount).replace(',','.');
        if(!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) fail('Der neue DKP-Stand muss mindestens 0 sein und darf höchstens zwei Nachkommastellen haben.');
        const target=Number(raw),reason=text(params.reason);
        if(!reason || reason.length>500) fail('Bitte einen Korrekturgrund angeben (max. 500 Zeichen).');
        const funds=await balance(client,guild.id,params.characterId);
        if(params.expectedBalance===undefined || !Number.isFinite(Number(params.expectedBalance)) || Math.round(Number(params.expectedBalance)*100)!==Math.round(funds.balance*100)) fail('Der DKP-Stand wurde inzwischen geändert. Bitte neu laden und die Korrektur prüfen.',409);
        if(Math.round(target*100)<Math.round(funds.reserved*100)) fail('Der neue Stand darf reservierte Gebote nicht unterschreiten.',409);
        const delta=(Math.round(target*100)-Math.round(funds.balance*100))/100;
        if(delta) await entry(params.characterId,delta.toFixed(2),'adjustment',reason,'','');
        result.balance=target;
      } else if(action==='book'){
        const amount=dkpAmount(params.amount),kind=text(params.kind),reason=text(params.reason),item=text(params.item),raid=text(params.raid);
        if(!['credit','loot','adjustment'].includes(kind)) fail('Ungültige Buchungsart.');
        if(!reason || reason.length>500 || item.length>200 || raid.length>120) fail('Bitte einen Grund (max. 500 Zeichen) und gültige Loot-/Raidangaben eintragen.');
        if(kind==='loot' && !item) fail('Bitte das vergebene Item eintragen.');
        const {rules}=await rulesFor(client,guild.id);
        if(kind==='loot' && rules.pricing==='fixed' && Number(amount)!==rules.fixedPrice) fail('Diese Gilde verwendet einen Festpreis von '+rules.fixedPrice+' DKP.',409);
        const ids=Array.isArray(params.characterIds)?[...new Set(params.characterIds)]:[];
        if(!ids.length || ids.length>80 || (kind!=='credit' && ids.length!==1)) fail('Gutschrift: 1–80 Charaktere; Abzug: genau ein Charakter.');
        for(const id of ids){
          await character(id);
          if(kind!=='credit'){
            const funds=await balance(client,guild.id,id);
            if(Math.round((funds.balance-funds.reserved)*100)<Math.round(Number(amount)*100)) fail('Nicht genügend freie DKP. Führende Gebote reservieren Punkte.',409);
          }
          await entry(id,kind==='credit'?amount:'-'+amount,kind,reason,item,raid);
        }
        result.count=ids.length;
      } else if(action==='openAuction'){
        const item=text(params.item),raid=text(params.raid),minimum=dkpAmount(params.amount);
        if(!item || item.length>200 || raid.length>120) fail('Bitte Item (max. 200 Zeichen) und gültigen Raid angeben.');
        const {rules}=await rulesFor(client,guild.id);
        if(Number(minimum)<rules.minimum) fail('Das Mindestgebot der Gilde beträgt '+rules.minimum+' DKP.',409);
        const openCount=await client.query("select count(*) as count from dkp_auctions where guild_id=$1 and status='open'",[guild.id]);
        if(Number(openCount.rows[0].count)>=50) fail('Bitte zuerst eine offene Auktion abschließen. Maximal 50 Auktionen können gleichzeitig offen sein.',409);
        const id=randomUUID();
        await client.query(`insert into dkp_auctions(id,guild_id,item,raid,min_bid) values($1,$2,$3,$4,$5)`,[id,guild.id,item,raid,minimum]);
        result.auctionId=id;
      } else {
        if(!uuid(params.auctionId)) fail('Ungültige Auktion.');
        const found=await client.query('select * from dkp_auctions where guild_id=$1 and id=$2 for update',[guild.id,params.auctionId]);
        const auction=found.rows[0];
        if(!auction) fail('Auktion nicht gefunden.',404);
        if(auction.status!=='open') fail('Diese Auktion ist bereits beendet.',409);
        if(action==='bid'){
          await character(params.characterId);
          const amount=dkpAmount(params.amount);
          if(Number(amount)<Number(auction.min_bid) || Number(amount)<=Number(auction.high_bid)) fail('Das Gebot muss mindestens das Mindestgebot erreichen und höher als das bisherige Höchstgebot sein.',409);
          const funds=await balance(client,guild.id,params.characterId,auction.id);
          if(Math.round((funds.balance-funds.reserved)*100)<Math.round(Number(amount)*100)) fail('Nicht genügend freie DKP für dieses Gebot.',409);
          await client.query('insert into dkp_bids(id,guild_id,auction_id,character_id,amount) values($1,$2,$3,$4,$5)',[randomUUID(),guild.id,auction.id,params.characterId,amount]);
          await client.query('update dkp_auctions set high_bid=$3,winner_id=$4 where guild_id=$1 and id=$2',[guild.id,auction.id,amount,params.characterId]);
        } else {
          if(action==='closeAuction' && auction.winner_id){
            const funds=await balance(client,guild.id,auction.winner_id,auction.id);
            if(Math.round((funds.balance-funds.reserved)*100)<Math.round(Number(auction.high_bid)*100)) fail('Der Gewinner hat nicht genügend DKP.',409);
            await entry(auction.winner_id,'-'+auction.high_bid,'auction','Loot aus DKP-Auktion',auction.item,auction.raid,auction.id);
          }
          await client.query('update dkp_auctions set status=$3,closed_at=now() where guild_id=$1 and id=$2',[guild.id,auction.id,action==='closeAuction'?'closed':'cancelled']);
        }
      }
      await client.query('insert into dkp_requests(guild_id,request_id,fingerprint,result) values($1,$2,$3,$4::jsonb)',[guild.id,params.requestId,fingerprint,JSON.stringify(result)]);
      await client.query('commit');return result;
    } catch(error){await client.query('rollback').catch(()=>{});throw error;}
    finally{client.release();}
  }
  return {ensure,state,change,validateMode,assertPrio};
}
