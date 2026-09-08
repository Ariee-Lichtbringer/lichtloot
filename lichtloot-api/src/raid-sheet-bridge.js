import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
export const RAID_SHEET_TYPES=['mc','bwl','aq40','naxx','ony','zg','aq20','zg-mittwoch','zg-prime','zg-late'];
export function validateSheetSnapshot(input,expectedId){
 if(!input||input.spreadsheetId!==expectedId||!Array.isArray(input.tabs)||!input.tabs.length||input.tabs.length>30)throw Error('Unerwartete Tabelle oder Tabellenblätter.');
 let cells=0;
 const tabs=input.tabs.map(tab=>{
  if(!tab||typeof tab.name!=='string'||!Array.isArray(tab.rows)||tab.rows.length>1000)throw Error('Ungültiges Tabellenblatt.');
  const rows=tab.rows.map(row=>{if(!Array.isArray(row)||row.length>150)throw Error('Zu viele Spalten.');cells+=row.length;return row.map(cell=>{if(typeof cell!=='string'||cell.length>2000)throw Error('Ungültiger Zelltext.');return cell;});});
  const colors=matrix=>rows.map((row,r)=>row.map((_,c)=>/^#[0-9a-f]{6}$/i.test(matrix?.[r]?.[c]||'')?matrix[r][c]:''));
  return {name:tab.name.slice(0,100),gid:String(tab.gid||'').slice(0,20),rows,backgrounds:colors(tab.backgrounds),fontColors:colors(tab.fontColors)};
 });
 if(cells>100000)throw Error('Zu viele Zellen.');
 return {available:1,source:'apps-script',spreadsheetId:expectedId,tabs,rows:tabs[0].rows};
}
export function createRaidSheetBridge(query){
 let schema;
 const ensure=()=>schema||(schema=query(`create table if not exists addon_raid_sheet_bridge(guild_id text not null,raid_type text not null,spreadsheet_id text not null,token_hash text not null,snapshot jsonb,received_at timestamptz,primary key(guild_id,raid_type))`).catch(e=>{schema=null;throw e;}));
 const hash=value=>createHash('sha256').update(value).digest('hex');
 return {
  async create(guild,raid,url){
   if(!RAID_SHEET_TYPES.includes(raid))throw Error('Ungültiger Raidtyp.');
   const u=new URL(url);const id=u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/(?:edit|view)?$/)?.[1];
   if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||!id||u.username||u.password)throw Error('Bitte die Google-Sheet-Adresse dieses Raids eintragen.');
   await ensure();const token=randomBytes(32).toString('hex');
   await query(`insert into addon_raid_sheet_bridge(guild_id,raid_type,spreadsheet_id,token_hash) values($1,$2,$3,$4) on conflict(guild_id,raid_type) do update set token_hash=excluded.token_hash,spreadsheet_id=excluded.spreadsheet_id,snapshot=case when addon_raid_sheet_bridge.spreadsheet_id=excluded.spreadsheet_id then addon_raid_sheet_bridge.snapshot else null end`,[String(guild.id),raid,id,hash(token)]);
   return {guild:guild.slug,raid,spreadsheetId:id,token};
  },
  async receive(guild,raid,token,payload){
   if(!RAID_SHEET_TYPES.includes(raid)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('Verbindungsschlüssel ungültig.');
   await ensure();const found=await query('select spreadsheet_id,token_hash from addon_raid_sheet_bridge where guild_id=$1 and raid_type=$2',[String(guild.id),raid]);const row=found.rows[0];
   if(!row||!timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(row.token_hash,'hex')))throw Error('Verbindungsschlüssel ungültig.');
   const snapshot=validateSheetSnapshot(payload,row.spreadsheet_id);snapshot.exportedAt=Math.floor(Date.now()/1000);
   const saved=await query('update addon_raid_sheet_bridge set snapshot=$3::jsonb,received_at=now() where guild_id=$1 and raid_type=$2 and token_hash=$4 returning raid_type',[String(guild.id),raid,JSON.stringify(snapshot),row.token_hash]);
   if(!saved.rows.length)throw Error('Verbindungsschlüssel wurde erneuert.');return snapshot.exportedAt;
  },
  async read(guildId){await ensure();const r=await query('select raid_type,snapshot from addon_raid_sheet_bridge where guild_id=$1 and snapshot is not null',[String(guildId)]);return Object.fromEntries(r.rows.map(x=>[x.raid_type,x.snapshot]));}
 };
}
