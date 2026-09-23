const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export const foreverLayoutRaids=['hyjal','barrow','onyxia','dungeon','other'];
const sectionKeys=['raidSignup','poReleases','p0Plus','miniRaids','gearPlanner'];
const managementKeys=['dashboard','raidorga','loot','bank','members','analyses','raidSheet','loganalysen','lootMaster','p0Items','backup','mailbox','admin'];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
function imageUrl(v){const s=String(v||'').trim();if(!s)return '';if(s.length>2000)throw fail('Bildadresse ist zu lang.');if(/^(?:\/?images\/)[a-z0-9_./% -]+$/i.test(s)&&!s.includes('..'))return s;let u;try{u=new URL(s);}catch{throw fail('Bitte eine HTTPS-Bildadresse oder einen Pfad unter images/ verwenden.');}if(u.protocol!=='https:'||u.username||u.password)throw fail('Bildadressen müssen HTTPS verwenden.');return u.href;}
const toggles=(raw,keys,defaultOn=true)=>Object.fromEntries(keys.map(k=>[k,object(raw)[k]===undefined?defaultOn:object(raw)[k]===true]));
export function normalizeForeverLayout(input={}) {
 const v=object(input),start=object(v.startPageSections),display=object(v.prioListDisplay);
 const color=(v,fallback)=>{if(v==null||v==='')return fallback;if(!/^#[a-f0-9]{6}$/i.test(v))throw fail('Bitte eine gültige Farbe wählen.');return v;};
 const supported=v.supportedRaids===undefined?[...foreverLayoutRaids]:v.supportedRaids;
 if(!Array.isArray(supported)||!supported.length||supported.some(k=>!foreverLayoutRaids.includes(k)))throw fail('Bitte mindestens einen Forever-Raidtyp auswählen.');
 const levels=[1,2,3].map(priority=>{const value=(Array.isArray(v.priorityLevels)?v.priorityLevels:[]).find(x=>x.priority===priority)||{};const label=String(value.label||'P'+priority).trim();if(!label||label.length>20)throw fail('Prioritätsnamen dürfen höchstens 20 Zeichen haben.');return {priority,label,enabled:value.enabled!==false};});
 if(!levels.some(l=>l.enabled))throw fail('Bitte mindestens eine Prioritätsstufe aktivieren.');
 const days=String(start.raidCardDays||'all');if(!['7','14','30','60','all'].includes(days))throw fail('Ungültiger Zeitraum für Raidkacheln.');
 return {revision:Number.isInteger(v.revision)?v.revision:0,logoUrl:imageUrl(v.logoUrl),backgroundUrl:imageUrl(v.backgroundUrl),primaryColor:color(v.primaryColor,'#facc15'),accentColor:color(v.accentColor,'#60a5fa'),
  raidImages:Object.fromEntries(foreverLayoutRaids.map(k=>[k,imageUrl(object(v.raidImages)[k])])),supportedRaids:[...new Set(supported)],priorityLevels:levels,
  lootPageSections:toggles(v.lootPageSections,sectionKeys),
  lootPageSectionsByRaid:Object.fromEntries(foreverLayoutRaids.map(k=>[k,toggles(object(v.lootPageSectionsByRaid)[k],[...sectionKeys,'prioRequiresSignup'])])),
  lootPagePoReleaseScope:v.lootPagePoReleaseScope==='raid'?'raid':'all',
  prioListDisplay:{prioEntryUnderName:display.prioEntryUnderName===true,attendanceUnderName:display.attendanceUnderName===true},
  startPageSections:{navigation:toggles(start.navigation,['dashboard','raidinfos','raidorga','bank','members','tools']),poReleaseRequest:start.poReleaseRequest!==false,raidRecords:start.raidRecords!==false,raidCardDays:days},
  guildManagementSections:toggles(v.guildManagementSections,managementKeys)};
}
export async function readForeverLayout(query,guildId) {
 const result=await query('select g.logo_url,g.background_url,s.primary_color,s.accent_color,s.layout_json from guilds g join guild_settings s on s.guild_id=g.id where g.id=$1',[guildId]);
 const row=result.rows[0];if(!row)throw fail('Gildenlayout nicht gefunden.',404);
 return normalizeForeverLayout({...object(row.layout_json?.foreverLayout),logoUrl:row.logo_url||'',backgroundUrl:row.background_url||'',primaryColor:row.primary_color,accentColor:row.accent_color});
}
export async function saveForeverLayout(pool,guild,actor,body) {
 if(!actor.canAdmin)throw fail('Nur die Gildenleitung darf das Layout ändern.',403);
 const next=normalizeForeverLayout(body.layout),db=await pool.connect();
 try{await db.query('begin');const row=(await db.query('select layout_json from guild_settings where guild_id=$1 for update',[guild.id])).rows[0];if(!row)throw fail('Gildenlayout nicht gefunden.',404);
 const stored=row.layout_json||{};if(next.revision!==Number(stored.foreverLayout?.revision||0))throw fail('Das Layout wurde zwischenzeitlich geändert. Bitte neu laden.',409);
 next.revision++;stored.foreverLayout=next;
 await db.query('update guilds set logo_url=$2,background_url=$3,updated_at=now() where id=$1',[guild.id,next.logoUrl,next.backgroundUrl]);
 await db.query('update guild_settings set primary_color=$2,accent_color=$3,layout_json=$4::jsonb,updated_at=now() where guild_id=$1',[guild.id,next.primaryColor,next.accentColor,JSON.stringify(stored)]);
 await db.query("insert into forever_audit(guild_id,actor,action,detail) values($1,$2,'guild_layout','Gildendesign, Raidbilder und sichtbare Bereiche aktualisiert')",[guild.id,actor.label]);
 await db.query('commit');return {success:true,layout:next};
 }catch(e){await db.query('rollback');throw e;}finally{db.release();}
}
