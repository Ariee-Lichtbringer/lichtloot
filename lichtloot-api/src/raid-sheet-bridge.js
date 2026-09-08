import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
export const RAID_SHEET_TYPES=['mc','bwl','aq40','naxx','ony','zg','aq20','zg-mittwoch','zg-prime','zg-late'];
export function validateSheetSnapshot(input,expectedId){
 if(!input||input.spreadsheetId!==expectedId||!Array.isArray(input.tabs)||!input.tabs.length||input.tabs.length>30)throw Error('Unerwartete Tabelle oder Tabellenblätter.');
 let cells=0,imageBytes=0;
 const tabs=input.tabs.map(tab=>{
  if(!tab||typeof tab.name!=='string'||!Array.isArray(tab.rows)||tab.rows.length>1000)throw Error('Ungültiges Tabellenblatt.');
  const rows=tab.rows.map(row=>{if(!Array.isArray(row)||row.length>150)throw Error('Zu viele Spalten.');cells+=row.length;return row.map(cell=>{if(typeof cell!=='string'||cell.length>2000)throw Error('Ungültiger Zelltext.');return cell;});});
  const colors=matrix=>rows.map((row,r)=>row.map((_,c)=>/^#[0-9a-f]{6}$/i.test(matrix?.[r]?.[c]||'')?matrix[r][c]:''));
  const images=tab.images===undefined?undefined:tab.images.map(image=>{
   if(!image||!Number.isInteger(image.row)||image.row<1||image.row>1000||!Number.isInteger(image.col)||image.col<1||image.col>150||typeof image.data!=='string'||image.data.length>12000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(image.data))throw Error('Ungültiges Bild.');
   imageBytes+=image.data.length;const bytes=Buffer.from(image.data,'base64');
   if(!(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.subarray(0,3).equals(Buffer.from([255,216,255]))))throw Error('Bildformat nicht unterstützt.');
   return {row:image.row,col:image.col,width:Math.max(1,Math.min(20000,Number(image.width)||1)),height:Math.max(1,Math.min(20000,Number(image.height)||1)),hash:createHash('sha256').update(bytes).digest('hex'),data:image.data};
  });
  if(images&&images.length>100)throw Error('Zu viele Bilder.');
  const notes=rows.map((row,r)=>row.map((_,c)=>String(tab.notes?.[r]?.[c]||'').slice(0,2000)));
  const merges=(Array.isArray(tab.merges)?tab.merges:[]).slice(0,5000).filter(m=>[m.r,m.c,m.h,m.w].every(Number.isInteger)&&m.r>0&&m.c>0&&m.h>0&&m.w>0&&m.r+m.h<=1001&&m.c+m.w<=151).map(({r,c,h,w})=>({r,c,h,w}));
  const widths=Array.from({length:Math.max(0,...rows.map(r=>r.length))},(_,c)=>Math.max(8,Math.min(2000,Number(tab.widths?.[c])||100)));
  const heights=rows.map((_,r)=>Math.max(8,Math.min(2000,Number(tab.heights?.[r])||24)));
  return {merges,widths,heights,images,notes,name:tab.name.slice(0,100),gid:String(tab.gid||'').slice(0,20),rows,backgrounds:colors(tab.backgrounds),fontColors:colors(tab.fontColors)};
 });
 if(imageBytes>50000000)throw Error('Bilder zu groß.');
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
   await ensure();const found=await query('select spreadsheet_id,token_hash,snapshot from addon_raid_sheet_bridge where guild_id=$1 and raid_type=$2',[String(guild.id),raid]);const row=found.rows[0];
   if(!row||!timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(row.token_hash,'hex')))throw Error('Verbindungsschlüssel ungültig.');
   const snapshot=validateSheetSnapshot(payload,row.spreadsheet_id);for(const tab of snapshot.tabs){if(tab.images===undefined)tab.images=(row.snapshot?.tabs||[]).find(old=>old.gid===tab.gid)?.images||[];}snapshot.exportedAt=Math.floor(Date.now()/1000);
   const saved=await query('update addon_raid_sheet_bridge set snapshot=$3::jsonb,received_at=now() where guild_id=$1 and raid_type=$2 and token_hash=$4 returning raid_type',[String(guild.id),raid,JSON.stringify(snapshot),row.token_hash]);
   if(!saved.rows.length)throw Error('Verbindungsschlüssel wurde erneuert.');return snapshot.exportedAt;
  },
  async read(guildId,withImages=false){await ensure();const r=await query('select raid_type,snapshot from addon_raid_sheet_bridge where guild_id=$1 and snapshot is not null',[String(guildId)]);return Object.fromEntries(r.rows.map(x=>[x.raid_type,withImages?x.snapshot:{...x.snapshot,tabs:x.snapshot.tabs.map(t=>({...t,images:(t.images||[]).map(({data,...meta})=>meta)}))}]));}
 };
}
