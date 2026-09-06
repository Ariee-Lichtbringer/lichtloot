import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const source=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const extract=name=>{const m=source.match(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(m,name);return source.slice(m.index,source.indexOf('\n}\n',m.index)+2);};
const db=new PGlite();
await db.exec(`create table items(id text, item_id text, name text);
 create table guild_po_items(guild_id text,item_id text,raid_type text,enabled boolean,po_plus_enabled boolean);
 insert into items values ('unconfigured','22637','Götze'),('prime','22637','Götze'),('late','22637','Götze'),('bag','19914','Pantherbalgsack');
 insert into guild_po_items values ('guild','prime','zg-prime',true,true),('guild','late','zg-late',true,false),('guild','bag','zg-prime',true,false);`);
let layout={};let outsideReads=0;const client={query:(...args)=>db.query(...args)};
const ctx=vm.createContext({clean:v=>String(v??'').trim(),normalizeRaidType:v=>v,
 query:(...args)=>{outsideReads++;return db.query(...args);},
 ensureGuildPoItemsSchema:async()=>{outsideReads++;},getGuildEraConfiguration:async()=>{outsideReads++;return {layout};}});
for(const n of ['lootSourceRaidType','raidP0PlusEnabled','requireRaidP0PlusEnabled','poItemSettingsRaidTypes','guildPoItemRequiresRelease','requireGuildPoItem','resolvePrioP0Selection'])vm.runInContext(extract(n),ctx);
const resolve=(params,raid='zg-prime',guild='guild')=>ctx.resolvePrioP0Selection(guild,raid,params,{client,layout});
// Reproduce Cardiothorac: P0 selected but the browser explicitly sent Plus=no.
const triple={p1:'Götze',p2:'Götze',p3:'Götze',p1ItemId:'unconfigured',p0Selected:'ja',p0Plus:'nein'};
let result=await resolve(triple);assert.equal(result.p0Selected,true);assert.equal(result.p0PlusSelected,true);
// Legacy clients with no flags are also classified from a complete P0 triple.
result=await resolve({p1:'Götze',p2:'Götze',p3:'Götze'});assert.equal(result.p0PlusSelected,true);
// Mixed normal priorities must never earn P0+ just because P1 is eligible.
result=await resolve({...triple,p0Selected:'nein',p3:'Pantherbalgsack'});assert.equal(result.p0Selected,false);assert.equal(result.p0PlusSelected,false);
// Explicit single-item P0 input, enabled item, and same item in another raid/guild.
assert.equal((await resolve({p0Selected:'ja',p0Item:'Götze',p0ItemId:'22637'})).p0PlusSelected,true);
assert.equal((await resolve(triple,'zg-late')).p0PlusSelected,false);
assert.equal((await resolve(triple,'zg-prime','other-guild')).p0PlusSelected,false);
assert.equal((await resolve({p1:'Pantherbalgsack',p2:'Pantherbalgsack',p3:'Pantherbalgsack',p0Plus:'nein'})).p0PlusSelected,false);
// Do not issue pool queries or schema DDL while the save transaction holds locks.
await ctx.requireGuildPoItem('guild','22637','Götze','zg-prime',{client});
assert.equal(outsideReads,0);
assert.match(extract('savePrio'),/savedRaidForSignupCheck\.raid_type \|\| raidType,\s*\{ client \}/);
layout={lootPageSectionsByRaid:{zg:{p0Plus:false}}};
assert.equal((await resolve(triple)).p0PlusSelected,false);
assert.equal((await resolve({...triple,p0Plus:'ja'})).p0PlusSelected,false);
layout={};assert.equal((await resolve({...triple,p0Plus:'ja'},'zg-late')).p0PlusSelected,false);
await db.exec("update guild_po_items set enabled=false where item_id='prime'");
assert.equal((await resolve(triple)).p0PlusSelected,false);
await db.exec("update guild_po_items set enabled=true where item_id='prime'");
// Discord still uses the same raid-scoped configuration lookup.
assert.equal(await ctx.guildPoItemRequiresRelease('guild','unconfigured','Götze','zg-prime'),true);
assert.equal(await ctx.guildPoItemRequiresRelease('guild','unconfigured','Götze','zg-late'),false);
// Exercise the actual raidlead save entry point with captured database writes.
let savedMeta;let savedItems=[];
Object.assign(ctx,{ensurePoPostEntriesSchema:async()=>{},ensurePrioSchema:async()=>{},
 findRaid:async()=>({id:'raid',raid_type:'zg-prime',lead_pin:'lead',raid_time:'22:00'}),
 pool:{connect:async()=>({query:async(sql,args)=>{if(sql.includes('insert into prios')){savedMeta=JSON.parse(args[5]);return {rows:[{id:'prio'}]};}if(sql.includes('select exists'))return db.query(sql,args);return {rows:[]};},release(){}})},
 findOrCreateRaidleadCharacter:async()=>({id:'char',name:'Player'}),
 upsertItem:async(client,raid,name,id)=>{savedItems.push(name);return {id:id||name,name};},
 removeDuplicatePriosForCharacterName:async()=>{},removeDuplicatePriosForPlayerLogin:async()=>{},
 syncPoPostEntryFromPrio:async()=>[],enqueueP0PostRefreshForRaid:async()=>({success:true}),raidPublicId:()=> 'raid'});
vm.runInContext(extract('savePrioAsRaidlead'),ctx);
await ctx.savePrioAsRaidlead({guildId:'guild',query:{...triple,leadPin:'lead'}});
assert.equal(savedMeta.p0Selected,'ja');assert.equal(savedMeta.p0Plus,'ja');assert.deepEqual(savedItems,['Götze','Götze','Götze']);
await ctx.savePrioAsRaidlead({guildId:'guild',query:{p1:'Pantherbalgsack',p2:'Pantherbalgsack',p3:'Pantherbalgsack',leadPin:'lead'}});
assert.equal(savedMeta.p0Selected,'ja');assert.equal(savedMeta.p0Plus,'nein');assert.equal(savedMeta.p0Item,'Pantherbalgsack');
await db.close();
console.log('Server P0 classification: stale flags, duplicate items, raid/guild scope, normal priorities, disabled settings, transaction isolation and raidlead persistence passed.');

for(const name of ['prioSchemaReadyPromise','poPostEntriesSchemaReadyPromise']){
 const fn=name==='prioSchemaReadyPromise'?'ensurePrioSchema':'ensurePoPostEntriesSchema';
 assert(source.indexOf('let '+name+' = null')<source.indexOf('await '+fn+'().catch'),'Schema state initialized before startup calls');
}
