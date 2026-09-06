import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const source=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const extract=name=>{const m=source.match(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(m,name);return source.slice(m.index,source.indexOf('\n}\n',m.index)+2);};
const db=new PGlite();
await db.exec(`create table items(id text primary key,raid_type text,item_id text,name text,quality text,icon_url text,slot text,type text,boss text,bind text,category text,wowhead text,stats_text text,tooltip text,needed text,equip text,price text,dropchance text);
create table guild_po_items(guild_id text,item_id text,raid_type text,enabled boolean,po_plus_enabled boolean);
create table p0plus_points(id text,guild_id text,item_id text,points numeric);
insert into items(id,raid_type,item_id,name) values ('idol','zg','22637','Götze'),('tiger','zg','19902','Tiger'),('disabled','zg','3','Disabled'),('other','mc','4','Other'),('prime','zg','5','Prime item'),('aq','aq20','6','AQ item');
insert into guild_po_items values ('guild','idol','zg',true,false),('guild','tiger','zg',true,true),('guild','disabled','zg',false,true),('guild','other','mc',true,true),('foreign','disabled','zg',true,true),('foreign','idol','zg',true,true),('guild','prime','zg-prime',true,true),('guild','aq','aq20',true,false);
insert into p0plus_points values ('point','guild','tiger',3),('foreign-point','foreign','tiger',99);`);
let inTransaction=false;
let layout={},raidType='zg',metadata,commits=0,rollbacks=0,releaseRequired=false,hasRelease=false;
const clean=v=>String(v??'').trim();
const ctx=vm.createContext({query:(...a)=>{assert.equal(inTransaction,false,'No second pool connection while the save transaction holds locks');return db.query(...a);},clean,normalizeRaidType:v=>clean(v).toLowerCase(),raidTypeSearchValues:v=>[clean(v).toLowerCase()],
 ensureGuildPoItemsSchema:async()=>{assert.equal(inTransaction,false,'No schema DDL inside save transaction');},getGuildEraConfiguration:async()=>({layout})});
for(const name of ['lootSourceRaidType','poItemSettingsRaidTypes','raidP0PlusEnabled','requireGuildPoItem','requireGuildPoPlusItem','guildPoItemRequiresRelease'])vm.runInContext(extract(name),ctx);
const context=extract('getP0DiscordSignupContext');const a=context.indexOf('  const itemResult = await query('),b=context.indexOf('\n  const signupResult',a);
vm.runInContext('async function list(guildId,raid){'+context.slice(a,b)+'return itemResult.rows;}',ctx);
let rows=await ctx.list('guild',{raid_type:'zg'});assert.deepEqual(rows.map(r=>r.name).sort(),['Götze','Prime item','Tiger']);assert.equal(Number(rows.find(r=>r.id==='tiger').p0plus_points),3);
assert.deepEqual((await ctx.list('guild',{raid_type:'zg-prime'})).map(r=>r.name),['Prime item']);assert.equal((await ctx.list('guild',{raid_type:'zg-late'})).length,0);
assert.deepEqual((await ctx.list('guild',{raid_type:'aq20'})).map(r=>r.name),['AQ item']);assert.deepEqual((await ctx.list('foreign',{raid_type:'zg'})).map(r=>r.name).sort(),['Disabled','Götze']);
const client={query:async(sql,args)=>{
 if(sql==='begin'){inTransaction=true;return {rows:[]};}if(sql==='commit'){inTransaction=false;commits++;return {rows:[]};}if(sql==='rollback'){inTransaction=false;rollbacks++;return {rows:[]};}
 if(sql.includes('from items i')||sql.includes('select exists'))return db.query(sql,args);
 if(sql.includes('select id, name')&&sql.includes('from items'))return db.query(sql,args);
 if(sql.includes('from character_po_releases'))return {rows:hasRelease?[{exists:1}]:[]};
 if(sql.includes('insert into prios')){metadata=JSON.parse(args[3]);return {rows:[]};}
 if(sql.includes('insert into p0_discord_signups'))return {rows:[{id:'signup'}]};
 if(sql.includes('from characters')||sql.includes('from p0_discord_signups'))return {rows:[]};
 throw Error('Unexpected SQL: '+sql);
},release(){}};
Object.assign(ctx,{ensureRaidSchema:async()=>{},ensurePoPostEntriesSchema:async()=>{},findP0DiscordRaid:async()=>({id:'raid',raid_type:raidType}),
 getPoReleaseDisplaySettings:async()=>({}),poReleaseDisplaySettingsFromLayout:()=>({}),pool:{connect:async()=>client},findOrCreateDiscordP0Character:async()=>({id:'character',name:'Modric',server:'Everlook',player_id:'player'}),normalizePoReleaseRaid:v=>v,
 poReleasesRequiredForRaid:()=>releaseRequired,removeDuplicatePriosForCharacterName:async()=>{},removeDuplicatePriosForPlayerLogin:async()=>{},normalizeRaidRow:v=>v,normalizeP0SignupRow:v=>v});
vm.runInContext(extract('saveP0DiscordSignup'),ctx);
const save=(itemId,guildId='guild')=>ctx.saveP0DiscordSignup({guildId,query:{discordUserId:'discord',itemId}});
await save('idol');assert.equal(metadata.p0Selected,'ja');assert.equal(metadata.p0Plus,'nein');assert.equal(metadata.p0Item,'Götze');assert.equal(commits,1);
await save('tiger');assert.equal(metadata.p0Plus,'ja');assert.equal(commits,2);
await save('idol','foreign');assert.equal(metadata.p0Plus,'ja');await save('idol');assert.equal(metadata.p0Plus,'nein');
layout={lootPageSectionsByRaid:{zg:{p0Plus:false}}};await save('tiger');assert.equal(metadata.p0Plus,'nein');layout={};
for(const [id,guild] of [['disabled','guild'],['idol','unconfigured'],['other','guild']])await assert.rejects(save(id,guild),/nicht als P0|nicht gefunden/);
releaseRequired=true;await assert.rejects(save('idol'),/keine P0-Freigabe/);hasRelease=true;await save('idol');assert.equal(metadata.p0Plus,'nein');assert.equal(rollbacks,4);
// Legacy routes must preserve the P0 admission check; Plus remains a separate classification.
for(const name of ['savePoSignupPrioFromBot','savePoPostEntry']){const f=extract(name);assert.match(f,/await requireGuildPoItem\(/);assert.doesNotMatch(f,/await requireGuildPoPlusItem\(/);assert.match(f,/guildPoItemRequiresRelease\(/);}
await assert.rejects(ctx.requireGuildPoPlusItem('guild','idol','Götze','zg'),/nicht als P0\+/);
await db.close();console.log('Discord P0: plain/Plus selection and saving, disabled items, guild/raid isolation, Plus-disabled raid, unchanged release checks and legacy guards passed.');
