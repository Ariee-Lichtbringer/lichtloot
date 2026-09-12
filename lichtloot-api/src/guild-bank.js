// Gildenbank: Bankcharaktere je Gilde, Bestandsimport aus dem Addon und Bestandsabfrage.
// Classic Era hat keine echte Gildenbank; die Gildenbank sind die konfigurierten Bankcharaktere.
import { ARMOR_REQUESTS_SCHEMA } from './armor-requests.js';
const clean=value=>String(value??'').trim();
function fail(message,statusCode=400){throw Object.assign(new Error(message),{statusCode});}
const DEFAULT_CHARACTERS={lichtloot:[['Lichtbank','Everlook'],['Raidbankk','Everlook'],['Diambarren','Everlook'],['Lichtleser','Everlook'],['Seiten','Everlook'],['Lichtrunen','Everlook']].map(([name,server])=>({name,server}))};
export const GUILD_BANK_SCHEMA=`create table if not exists guild_bank_stock (
  guild_id uuid not null references guilds(id) on delete cascade,
  character_name text not null,
  server text not null default '',
  item_id integer not null,
  item_name text not null default '',
  quantity integer not null default 0,
  observed_at timestamptz not null default now(),
  primary key(guild_id,character_name,server,item_id)
);
create index if not exists idx_guild_bank_stock_item on guild_bank_stock(guild_id,item_id);
create table if not exists guild_bank_items (
  item_id integer primary key,
  name text not null default '',
  quality text not null default 'common',
  icon text not null default '',
  category text not null default '',
  tooltip text not null default '',
  fetched_at timestamptz not null default now()
);`;
// Kategorie wie in GBankClassic, abgeleitet aus Name und Tooltip.
export function guildBankCategory(name,tooltip){
 const t='\n'+String(tooltip||'')+'\n';const n=String(name||'');
 if(/^(Rezept|Formel|Muster|Plan|Buch|Schema|Technik|Foliant):/i.test(n))return 'Rezept';
 if(/\n(Köcher|Munitionsbeutel)\n/.test(t))return 'Köcher';
 if(/\n(Projektil|Kugel|Pfeil)\n/.test(t)||/\n\d+ Platz(?:\s|\n)/.test(t)&&/Beutel|Tasche|Ranzen|Sack/i.test(n))return /Beutel|Tasche|Ranzen|Sack/i.test(n)?'Behälter':'Projektil';
 if(/\n\d+ Platz\n|\n\d+ Plätze\n|-Tasche\n/.test(t)||/^(Beutel|Tasche|Ranzen)/i.test(n))return 'Behälter';
 if(/\n(Waffenhand|Schildhand|Zweihändig|Einhändig|Distanz|Distanzwaffe|Wurfwaffe|Fernkampf)\n/.test(t))return 'Waffe';
 if(/\n(Kopf|Hals|Schultern|Rücken|Brust|Handgelenke|Hände|Taille|Beine|Füße|Finger|Schmuck|Hemd|Wappenrock|Schild|Nebenhand)\n/.test(t))return 'Rüstung';
 if(/\nQuestgegenstand\n|\nQuest\n/.test(t)||/götze|skarabäus|Götze/i.test(n))return 'Quest';
 if(/\nReagenz\n/.test(t)||/Kerze|Seelensplitter|Symbol des|Ankh|Wildeule|Runenverz\.|Wildkraut|Erdkraut|Sturmkraut|Feuerpulver|Pulver|Wildwurzel/i.test(n))return 'Reagenz';
 if(/\nBenutzen:|\nWird beim Anlegen gebunden\n[^]*?Benutzen:|Trank|Elixier|Fläschchen|Bufffood|Wiederherstellung|Schriftrolle|Öl\b|Wetzstein|Gewicht|Bandage|Stärkung/i.test(t+n))return 'Verbrauchbar';
 if(/Barren|Erz|Stoff|Ballen|Leder|Balg|Fell|Schuppe|Kraut|Blume|Blüte|Wurzel|Splitter|Kristall|Essenz|Staub|Stein|Mondstoff|Faden|Perle|Edelstein|Juwel|Vitriol|Chitin|Knochen|Elementar|Kern\b|Schnitt|Draht|Gift/i.test(n))return 'Handwerkswaren';
 return 'Verschiedenes';
}
const sameName=(a,b)=>clean(a).toLowerCase()===clean(b).toLowerCase();
const sameServer=(a,b)=>clean(a).toLowerCase().replace(/[\s'’-]/g,'')===clean(b).toLowerCase().replace(/[\s'’-]/g,'');
export function normalizeCharacters(input){
 let list=input;
 if(typeof list==='string'){try{list=JSON.parse(list);}catch{fail('Bankcharaktere sind ungültig.');}}
 if(!Array.isArray(list))fail('Bankcharaktere sind ungültig.');
 if(list.length>40)fail('Höchstens 40 Bankcharaktere.');
 const out=[];const seen=new Set();
 for(const entry of list){
  const name=clean(entry?.name).replace(/\s+/g,''),server=clean(entry?.server);
  if(!name)continue;
  if(!/^[\p{L}]{2,24}$/u.test(name))fail('Charaktername ungültig: '+name.slice(0,30));
  if(server.length>40||/[<>|]/.test(server))fail('Servername ungültig.');
  const key=name.toLowerCase()+'@'+server.toLowerCase();if(seen.has(key))continue;seen.add(key);
  out.push({name:name[0].toUpperCase()+name.slice(1),server});
 }
 return out;
}
function parseGuildBankBlock(lines){
 const head=lines[0].split(';');
 if(head[0]!=='GLB1'||head.length<5)fail('Kein gültiger Gildenbank-Export. Im Addon /gle bank ausführen und den Text vollständig kopieren.');
 const guild=clean(head[1]).toLowerCase(),player=clean(decodeURIComponent(head[2])),realm=clean(decodeURIComponent(head[3])),stamp=Number(head[4]);
 if(!player||!Number.isFinite(stamp)||stamp<1)fail('Gildenbank-Export ist unvollständig.');
 const items=new Map();
 for(const line of lines.slice(1)){
  const [id,count,...rest]=line.split(';');const itemId=Number(id),quantity=Number(count);
  if(!Number.isInteger(itemId)||itemId<1||itemId>1000000||!Number.isInteger(quantity)||quantity<0||quantity>100000)fail('Ungültige Zeile im Gildenbank-Export: '+line.slice(0,40));
  const name=clean(decodeURIComponent(rest.join(';'))).slice(0,120);
  const prev=items.get(itemId);items.set(itemId,{itemId,quantity:(prev?.quantity||0)+quantity,name:name||prev?.name||''});
 }
 return {guild,player,realm,observedAt:Math.min(stamp,Math.floor(Date.now()/1000)+300),items:[...items.values()].filter(i=>i.quantity>0)};
}
// Ein Export kann mehrere Charaktere enthalten (z. B. aus GBankClassic): jeder Block beginnt mit GLB1;…
export function parseGuildBankExports(text){
 const lines=String(text||'').replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);
 if(!lines.length||lines.length>20000)fail('Gildenbank-Export fehlt oder ist zu groß.');
 const blocks=[];let current=null;const roster=[];
 for(const line of lines){
  if(line.startsWith('GLBROSTER;')){roster.push(...line.slice(10).split(';').map(x=>clean(decodeURIComponent(x))).filter(Boolean));continue;}
  if(line.startsWith('GLB1;')){current=[line];blocks.push(current);continue;}
  if(!current)fail('Kein gültiger Gildenbank-Export. Im Addon /gle bank ausführen und den Text vollständig kopieren.');
  current.push(line);
 }
 if(!blocks.length||blocks.length>60)fail('Kein gültiger Gildenbank-Export.');
 return {exports:blocks.map(parseGuildBankBlock),roster:[...new Set(roster)].slice(0,60)};
}
export function parseGuildBankExport(text){return parseGuildBankExports(text).exports[0];}
export function createGuildBank({pool,query,getCharactersByPin,lookupItem}){
 let schema=null;
 const ensure=()=>{if(!schema)schema=query(GUILD_BANK_SCHEMA).catch(e=>{schema=null;throw e;});return schema;};
 async function settings(guild){
  const row=await query(`select layout_json->'guildBank' as bank from guild_settings where guild_id=$1`,[guild.id]);
  const stored=row.rows[0]?.bank;
  const characters=Array.isArray(stored?.characters)?normalizeCharacters(stored.characters):(DEFAULT_CHARACTERS[guild.slug]||[]);
  return {characters,hiddenItems:Array.isArray(stored?.hiddenItems)?stored.hiddenItems.map(Number).filter(Number.isInteger).slice(0,500):[],note:clean(stored?.note).slice(0,500),useGBank:stored?.useGBank===true};
 }
 async function saveSettings(guild,params){
  const current=await settings(guild);
  const next={characters:params.characters===undefined?current.characters:normalizeCharacters(params.characters),hiddenItems:params.hiddenItems===undefined?current.hiddenItems:(()=>{let v=params.hiddenItems;if(typeof v==='string'){try{v=JSON.parse(v);}catch{v=[];}}return (Array.isArray(v)?v:[]).map(Number).filter(Number.isInteger).slice(0,500);})(),note:params.note===undefined?current.note:clean(params.note).slice(0,500),useGBank:params.useGBank===undefined?current.useGBank:['1','true','ja','yes'].includes(String(params.useGBank).toLowerCase())};
  await query(`insert into guild_settings(guild_id,layout_json) values($1,jsonb_build_object('guildBank',$2::jsonb)) on conflict(guild_id) do update set layout_json=jsonb_set(coalesce(guild_settings.layout_json,'{}'::jsonb),'{guildBank}',$2::jsonb,true),updated_at=now()`,[guild.id,JSON.stringify(next)]);
  return next;
 }
 function bankCharacter(list,player,realm){return list.find(c=>sameName(c.name,player)&&(!c.server||!realm||sameServer(c.server,realm)));}
 async function importOne(guild,config,parsed){
  if(parsed.guild&&parsed.guild!==guild.slug)fail('Der Export gehört zur Gilde „'+parsed.guild+'“, nicht zu dieser Gilde.');
  const character=bankCharacter(config.characters,parsed.player,parsed.realm);
  if(!character)return null;
  const client=await pool.connect();
  try{
   await client.query('begin');
   await client.query('delete from guild_bank_stock where guild_id=$1 and lower(character_name)=lower($2) and lower(server)=lower($3)',[guild.id,character.name,character.server||parsed.realm]);
   for(const item of parsed.items){
    await client.query('insert into guild_bank_stock(guild_id,character_name,server,item_id,item_name,quantity,observed_at) values($1,$2,$3,$4,$5,$6,to_timestamp($7)) on conflict(guild_id,character_name,server,item_id) do update set item_name=excluded.item_name,quantity=excluded.quantity,observed_at=excluded.observed_at',[guild.id,character.name,character.server||parsed.realm,item.itemId,item.name,item.quantity,parsed.observedAt]);
   }
   await client.query('commit');
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  return {character:character.name,server:character.server||parsed.realm,items:parsed.items.length,observedAt:parsed.observedAt};
 }
 async function importExport(guild,text,{onlyPlayers=null}={}){
  const {exports,roster}=parseGuildBankExports(text);
  await ensure();const config=await settings(guild);
  const imported=[],unknown=[],skipped=[];
  for(const parsed of exports){
   if(onlyPlayers&&!onlyPlayers.some(c=>sameName(c.name,parsed.player)&&(!parsed.realm||!c.server||sameServer(c.server,parsed.realm)))){skipped.push(parsed.player);continue;}
   let result=await importOne(guild,config,parsed);
   const inRoster=roster.some(n=>sameName(n.split('-')[0],parsed.player));
   if(!result&&config.useGBank&&!onlyPlayers&&inRoster){
    // Mit GBankClassic: nur Bankcharaktere aus dessen Roster automatisch eintragen, nie den exportierenden Spieler selbst.
    config.characters=normalizeCharacters([...config.characters,{name:parsed.player,server:parsed.realm}]);
    await saveSettings(guild,{characters:config.characters});
    result=await importOne(guild,config,parsed);
   }
   if(result)imported.push(result);else unknown.push(parsed.player);
  }
  const suggested=[...new Set([...unknown.filter(n=>roster.some(r=>sameName(r.split('-')[0],n))),...roster.map(n=>n.split('-')[0]).filter(n=>!bankCharacter(config.characters,n,''))])];
  const ignored=unknown.filter(n=>!roster.some(r=>sameName(r.split('-')[0],n)));
  if(!imported.length&&unknown.length)fail((unknown.join(', ')+' ist nicht als Bankcharakter eingetragen. Bitte zuerst unter Gildenbank → Einstellungen hinzufügen.'));
  if(!imported.length)fail('Der Export enthält keinen Bestand eines freigegebenen Charakters.');
  return {success:true,character:imported[0].character,server:imported[0].server,items:imported.reduce((n,r)=>n+r.items,0),observedAt:imported[0].observedAt,imported,unknown:suggested,ignored,skipped};
 }
 const enriching=new Set();
 async function enrich(itemIds,{wait=false}={}){
  if(!lookupItem||!itemIds.length)return;
  const known=await query('select item_id from guild_bank_items where item_id=any($1::int[])',[itemIds]);const have=new Set(known.rows.map(r=>r.item_id));
  const missing=itemIds.filter(id=>!have.has(id)&&!enriching.has(id)).slice(0,400);if(!missing.length)return;
  missing.forEach(id=>enriching.add(id));
  const run=(async()=>{
   let index=0;const worker=async()=>{while(index<missing.length){const id=missing[index++];try{const r=await lookupItem(id);const item=r?.item||{};const tooltip=String(item.tooltipText||'').slice(0,4000);
     await query('insert into guild_bank_items(item_id,name,quality,icon,category,tooltip) values($1,$2,$3,$4,$5,$6) on conflict(item_id) do update set name=excluded.name,quality=excluded.quality,icon=excluded.icon,category=excluded.category,tooltip=excluded.tooltip,fetched_at=now()',[id,clean(item.name).slice(0,120),clean(item.quality)||'common',clean(item.icon).slice(0,80),guildBankCategory(item.name,tooltip),tooltip]);
    }catch{}finally{enriching.delete(id);}}};
   await Promise.all([worker(),worker(),worker()]);
  })();
  if(wait)await run;
 }
 async function inventory(guild,{includeHidden=false}={}){
  await ensure();const config=await settings(guild);
  const rows=await query(`select item_id,max(nullif(item_name,'')) as name,sum(quantity)::int as quantity,json_agg(json_build_object('name',character_name,'server',server,'quantity',quantity,'observedAt',extract(epoch from observed_at)::int) order by character_name) as stacks from guild_bank_stock where guild_id=$1 and quantity>0 group by item_id order by 2 nulls last,1`,[guild.id]);
  const scans=await query(`select character_name as name,server,max(observed_at) as observed_at,count(*)::int as items,sum(quantity)::int as quantity from guild_bank_stock where guild_id=$1 group by character_name,server order by character_name`,[guild.id]);
  const hidden=new Set(config.hiddenItems);
  const ids=rows.rows.map(r=>r.item_id);
  const metaRows=ids.length?await query('select item_id,name,quality,icon,category,tooltip from guild_bank_items where item_id=any($1::int[])',[ids]):{rows:[]};
  const meta=new Map(metaRows.rows.map(m=>[m.item_id,m]));
  const missing=ids.filter(id=>!meta.has(id));
  if(missing.length){await enrich(missing.slice(0,30),{wait:true});enrich(missing.slice(30));const again=await query('select item_id,name,quality,icon,category,tooltip from guild_bank_items where item_id=any($1::int[])',[missing.slice(0,30)]);for(const m of again.rows)meta.set(m.item_id,m);}
  const items=rows.rows.map(r=>{const m=meta.get(r.item_id)||{};return {itemId:r.item_id,name:r.name||m.name||('Item #'+r.item_id),quantity:r.quantity,stacks:r.stacks,hidden:hidden.has(r.item_id),icon:m.icon||'',quality:m.quality||'common',category:m.category||guildBankCategory(r.name||m.name,m.tooltip),tooltip:m.tooltip||''};}).filter(i=>includeHidden||!i.hidden);
  return {success:true,items,characters:config.characters.map(c=>{const scan=scans.rows.find(s=>sameName(s.name,c.name)&&(!c.server||sameServer(s.server,c.server)));return {...c,observedAt:scan?Math.floor(new Date(scan.observed_at).getTime()/1000):null,items:scan?.items||0,quantity:scan?.quantity||0};}),note:config.note};
 }
 return {
  async manage(guild,action,params){
   if(action==='guildGetGuildBankSettings')return {success:true,settings:await settings(guild)};
   if(action==='guildSaveGuildBankSettings')return {success:true,settings:await saveSettings(guild,params)};
   if(action==='guildGetGuildBankInventory')return inventory(guild,{includeHidden:true});
   if(action==='guildImportGuildBankExport')return importExport(guild,params.text||params.export);
   if(action==='guildDeleteGuildBankStock'){
    await ensure();const name=clean(params.character),server=clean(params.server);if(!name)fail('Charakter fehlt.');
    const deleted=await query('delete from guild_bank_stock where guild_id=$1 and lower(character_name)=lower($2) and ($3=\'\' or lower(server)=lower($3))',[guild.id,name,server]);
    return {success:true,deleted:deleted.rowCount||0};
   }
   fail('Unbekannte Aktion.',404);
  },
  async player(guild,action,params){
   const pin=clean(params.pin||params.playerPin);if(!pin)fail('Bitte zuerst mit deinem SpielerLogin anmelden.',401);
   const owned=await getCharactersByPin(guild.id,pin);if(!owned.length)fail('SpielerLogin nicht freigegeben.',403);
   if(action==='getGuildBankInventory')return inventory(guild);
   if(action==='submitGuildBankRequest'){
    const name=clean(params.character),server=clean(params.server);
    const character=owned.find(c=>sameName(c.name,name)&&(!server||sameServer(c.server,server)));
    if(!character)fail('Charakter gehört nicht zu diesem SpielerLogin.',403);
    const itemId=Number(params.itemId),quantity=Number(params.quantity);
    if(!Number.isInteger(itemId)||itemId<1||!Number.isInteger(quantity)||quantity<1||quantity>1000)fail('Bitte Gegenstand und Menge angeben.');
    const stock=await inventory(guild);const item=stock.items.find(i=>i.itemId===itemId);
    if(!item)fail('Dieser Gegenstand ist aktuell nicht auf der Gildenbank verfügbar.');
    if(quantity>item.quantity)fail('Aktuell nicht verfügbar: Auf der Gildenbank liegen nur '+item.quantity+' × '+item.name+'.');
    await query(ARMOR_REQUESTS_SCHEMA);
    const client=await pool.connect();
    try{
     await client.query('begin');
     const dup=await client.query(`select id from armor_requests where guild_id=$1 and character_id=$2 and item_id=$3 and status='pending' and created_at>now()-interval '10 minutes' limit 1`,[guild.id,character.id,String(itemId)]);
     if(dup.rows.length){await client.query('commit');return {success:true,armorRequestId:dup.rows[0].id,status:'saved',duplicate:true};}
     const count=await client.query(`select count(*)::int as n from armor_requests where guild_id=$1 and character_id=$2 and created_at>now()-interval '1 minute'`,[guild.id,character.id]);
     if(count.rows[0].n>=5)fail('Bitte kurz warten, bevor du weitere Anträge sendest.',429);
     const saved=await client.query(`insert into armor_requests(guild_id,player_id,character_id,character_name,server,class_name,tier,item_id,item_name,token,materials) values($1,$2,$3,$4,$5,$6,'Gildenbank',$7,$8,null,$9::jsonb) returning id`,[guild.id,character.playerId||character.player_id||null,character.id,character.name,character.server||'',character.className||character.class_name||'',String(itemId),item.name,JSON.stringify([{itemId,name:item.name,quantity}])]);
     await client.query('commit');return {success:true,armorRequestId:saved.rows[0].id,status:'saved',available:item.quantity};
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
   }
   if(action==='submitGuildBankExport'){
    return importExport(guild,params.text||params.export,{onlyPlayers:owned});
   }
   fail('Unbekannte Aktion.',404);
  }
 };
}
