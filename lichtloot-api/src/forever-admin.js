import {readForeverLayout,saveForeverLayout} from './forever-layout.js';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const roles=['member','raidoffiziere','gildenoffiziere','gildenleitung'];
export function foreverSettingsInput(body){
 const name=String(body.name||'').trim(),rules=String(body.rules||'').trim(),discord=String(body.discordUrl||'').trim();
 if(!name||name.length>100||rules.length>12000)throw fail('Bitte Gildenname (maximal 100 Zeichen) und Regeln (maximal 12.000 Zeichen) prüfen.');
 if(discord){let url;try{url=new URL(discord);}catch{throw fail('Bitte einen gültigen Discord-Einladungslink eingeben.');}if(url.protocol!=='https:'||url.username||url.password||!((url.hostname==='discord.gg'&&/^\/[A-Za-z0-9-]+\/?$/.test(url.pathname))||(url.hostname==='discord.com'&&/^\/invite\/[A-Za-z0-9-]+\/?$/.test(url.pathname))))throw fail('Bitte einen HTTPS-Einladungslink von discord.gg oder discord.com/invite verwenden.');}
 return {name,rules,discordUrl:discord};
}
export function createForeverAdmin({pool,query}){
 async function tx(work){const db=await pool.connect();try{await db.query('begin');const result=await work(db);await db.query('commit');return result;}catch(e){await db.query('rollback');throw e;}finally{db.release();}}
 const audit=(db,guild,actor,action,detail)=>db.query('insert into forever_audit(guild_id,action,actor,detail) values($1,$2,$3,$4)',[guild.id,action,actor.label,detail]);
 return {async run(guild,actor,body){
  if(!(actor.canAdmin||(body.action==='adminOverview'&&actor.canManage)))throw fail('Nur die Forever-Gildenleitung darf Spielerzugänge und Gildeneinstellungen verwalten.',403);
  if(body.action==='adminLayout')return saveForeverLayout(pool,guild,actor,body);
  if(body.action==='adminOverview'){
   const players=await query(`select p.id,p.role,p.approval_status,coalesce(p.is_blocked,false) as is_blocked,p.created_at,
    coalesce((select json_agg(json_build_object('id',c.id,'name',c.name,'className',c.class_name,'role',c.role) order by c.name) from forever_characters c where c.guild_id=p.guild_id and c.player_id=p.id),'[]'::json) as characters
    from players p where p.guild_id=$1 order by case when p.approval_status='pending' then 0 else 1 end,p.created_at desc`,[guild.id]);
   const config=await query("select coalesce(layout_json->'forever','{}'::jsonb) as config from guild_settings where guild_id=$1",[guild.id]);
   const groups=await query('select g.id,g.name,g.discord_channel_id,(select count(*)::int from forever_raids r where r.guild_id=g.guild_id and r.group_id=g.id) as raid_count from forever_groups g where g.guild_id=$1 order by g.name',[guild.id]);
   const counts=await query("select count(*) filter(where status in ('open','closed','running'))::int as upcoming,count(*) filter(where status in ('completed','cancelled','archived'))::int as archived from forever_raids where guild_id=$1",[guild.id]);
   const history=await query('select action,actor,detail,created_at from forever_audit where guild_id=$1 order by id desc limit 40',[guild.id]);
   const c=config.rows[0]?.config||{};
   const discord=(await query('select discord_guild_id,channel_id from forever_discord_channels where guild_id=$1',[guild.id])).rows[0]||null;
   return {success:true,layout:await readForeverLayout(query,guild.id),actor:{canAdmin:!!actor.canAdmin,canManage:!!actor.canManage},discord,guild:{slug:guild.slug,name:guild.name},players:players.rows,groups:groups.rows,counts:counts.rows[0],settings:{rules:c.rules||'',discordUrl:c.discordUrl||'',revision:c.revision||0},history:history.rows};
  }
  if(body.action==='adminPlayer'){
   if(!/^[0-9a-f-]{36}$/i.test(String(body.playerId)))throw fail('Ungültiger Spieler.');
   if(actor.playerId===body.playerId)throw fail('Den eigenen Zugang bitte über einen anderen Leitungszugang verwalten.');
   const operation=body.operation;if(!['approve','reject','block','unblock','role','reopen','resetCode'].includes(operation))throw fail('Ungültige Änderung.');
   if(operation==='role'&&!roles.includes(body.role))throw fail('Ungültige Rolle.');
   return tx(async db=>{
    const found=await db.query('select id,approval_status from players where guild_id=$1 and id=$2 for update',[guild.id,body.playerId]);if(!found.rows.length)throw fail('Spieler dieser Gilde nicht gefunden.',404);
    if(['approve','reject'].includes(operation)&&found.rows[0].approval_status!=='pending')throw fail('Diese Anfrage wurde bereits bearbeitet. Bitte aktualisieren.',409);
    if(operation==='resetCode'){const code=String(body.newCode||'').trim().toUpperCase();if(!/^[A-Z0-9]{8,32}$/.test(code))throw fail('Neuer Code: 8–32 Buchstaben und Ziffern.');await db.query('update players set player_pin=$3,updated_at=now() where guild_id=$1 and id=$2',[guild.id,body.playerId,code]);}
    if(operation==='reopen'){if(found.rows[0].approval_status!=='rejected')throw fail('Nur abgelehnte Zugänge können erneut geöffnet werden.',409);await db.query("update players set approval_status='pending',updated_at=now() where guild_id=$1 and id=$2",[guild.id,body.playerId]);}
    if(operation==='approve')await db.query("update players set approval_status='approved',approved_at=now(),approved_by=$3,updated_at=now() where guild_id=$1 and id=$2",[guild.id,body.playerId,actor.label]);
    if(operation==='reject')await db.query("update players set approval_status='rejected',updated_at=now() where guild_id=$1 and id=$2",[guild.id,body.playerId]);
    if(operation==='block'||operation==='unblock')await db.query("update players set is_blocked=$3,blocked_at=case when $3 then now() else null end,blocked_reason=case when $3 then 'Durch Forever-Gildenleitung gesperrt' else '' end,updated_at=now() where guild_id=$1 and id=$2",[guild.id,body.playerId,operation==='block']);
    if(operation==='role')await db.query('update players set role=$3,updated_at=now() where guild_id=$1 and id=$2',[guild.id,body.playerId,body.role]);
    const name=await db.query('select name from forever_characters where guild_id=$1 and player_id=$2 order by created_at limit 1',[guild.id,body.playerId]);
    await audit(db,guild,actor,'player_'+operation,(name.rows[0]?.name||'Spieler')+(operation==='role'?' · '+body.role:''));return {success:true};
   });
  }
  if(body.action==='adminSettings'){
   const values=foreverSettingsInput(body);
   return tx(async db=>{const row=await db.query('select layout_json from guild_settings where guild_id=$1 for update',[guild.id]);if(!row.rows.length)throw fail('Gildeneinstellungen nicht gefunden.',404);const layout=row.rows[0].layout_json||{},previous=layout.forever||{};
    if(Number(body.revision)!==Number(previous.revision||0))throw fail('Die Einstellungen wurden zwischenzeitlich geändert. Bitte neu laden.',409);
    layout.forever={...previous,rules:values.rules,discordUrl:values.discordUrl,revision:Number(previous.revision||0)+1};
    await db.query('update guild_settings set layout_json=$2::jsonb,updated_at=now() where guild_id=$1',[guild.id,JSON.stringify(layout)]);await db.query('update guilds set name=$2,updated_at=now() where id=$1',[guild.id,values.name]);await audit(db,guild,actor,'guild_settings','Gildenname, Raidregeln und Discord-Link aktualisiert');return {success:true};
   });
  }
  throw fail('Unbekannte Verwaltungsaktion.');
 }};
}
