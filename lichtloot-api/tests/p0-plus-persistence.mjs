import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url);
const extract = (src, name) => {
  const match = src.match(new RegExp('^(?:async )?function '+name+'\\(', 'm'));
  assert.ok(match, name);
  return src.slice(match.index, src.indexOf('\n}\n', match.index)+2);
};
for (const folder of ['loot', 'lichtloot-api/public/loot']) {
  for (const raid of ['mc','bwl','aq40','naxx','zg','aq20','ony']) {
    const src = fs.readFileSync(new URL(`${folder}/${raid}-loot.html`,root),'utf8');
    const fields = Object.fromEntries(Object.entries({raidPin:'W3B',playerName:'Juksi',playerServer:'Everlook',playerClass:'Paladin',p1:'Götze',p2:'Götze',p3:'Götze'}).map(([k,value])=>[k,{value}]));
    fields.playerStatus={innerHTML:''};
    let request;
    const ctx=vm.createContext({URL,URLSearchParams,document:{getElementById:id=>fields[id],querySelectorAll:()=>[]},
      location:{pathname:`/loot/${raid}-loot.html`,search:''}, currentGuildInfo:{layout:{}},
      PRIO_COUNT:3,SUPPORTS_P0PLUS:true,currentPublishedMode:false,normalizeOwnPrioText:v=>String(v||'').toLowerCase(),
      getSelectedPrioItemId:()=> '22637',
      buildSavePrioUrl:()=> 'https://example.test/api?p0Plus=nein&p0Selected=nein',
      fetch:async url=>{request=new URL(url);return {ok:true,text:async()=>'{"success":true}'};}
    });
    ctx.window=ctx;ctx.p0PlusWasClicked=true;ctx.p0WasClicked=false;ctx.prioDraftDirty=true;
    for(const name of ['lichtlootPrioIsP0','getLiveDraftPrio','prioDraftSignature','submitPrioWithPin']) vm.runInContext(extract(src,name),ctx);
    vm.runInContext(fs.readFileSync(new URL(`${folder}/p0-selection-fix.js`,root),'utf8'),ctx);
    // The original async click handler renders before its outer wrapper resolves.
    ctx.p0WasClicked=false;
    const draft=ctx.getLiveDraftPrio();
    assert.equal(draft.P0Selected,'ja');assert.equal(ctx.lichtlootPrioIsP0(draft),true);
    assert.notEqual(ctx.prioDraftSignature(draft),ctx.prioDraftSignature({...draft,P0Plus:'nein'}));
    const selection={raidPin:'W3B',player:'Juksi',server:'Everlook',p1:'Götze',p2:'Götze',p3:'Götze',p0Plus:'ja',p0Selected:'ja',p0Item:'Götze'};
    // A late form reload must not overwrite the clicked P0+ payload.
    ctx.p0PlusWasClicked=false;fields.p1.value='Other item';
    await ctx.submitPrioWithPin('test','',selection);
    assert.equal(request.searchParams.get('p0Plus'),'ja');
    assert.deepEqual(request.searchParams.getAll('p0Selected'),['ja']);
    assert.equal(request.searchParams.get('p1'),'Götze');
    fields.playerName.value='Different character';
    await assert.rejects(ctx.submitPrioWithPin('test','',selection),/gewechselt/);
    let selected=false,saved=false;
    ctx.setP0Plus=async()=>{await Promise.resolve();ctx.p0PlusWasClicked=true;selected=true;};
    ctx.savePrio=async()=>{saved=true;};
    vm.runInContext(fs.readFileSync(new URL(`${folder}/p0-selection-fix.js`,root),'utf8'),ctx);
    await ctx.setP0Plus('Götze');assert.equal(selected,true);assert.equal(ctx.p0WasClicked,true);
    ctx.currentGuildInfo.layout={lootPageSectionsByRaid:{[raid]:{p0Plus:false,poReleases:false}}};
    selected=false;await ctx.setP0Plus('Götze');await ctx.savePrio();
    assert.equal(selected,false);assert.equal(saved,false);
  }
}
const server=fs.readFileSync(new URL('lichtloot-api/src/server.js',root),'utf8');
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
let layout={};
const ctx=vm.createContext({clean:v=>String(v||''),normalizeRaidType:v=>v,ensureGuildPoItemsSchema:async()=>{},
  query:(sql,args)=>db.query(sql,args),getGuildEraConfiguration:async()=>({layout})});
for(const name of ['lootSourceRaidType','raidP0PlusEnabled','requireRaidP0PlusEnabled','poItemSettingsRaidTypes','guildPoItemRequiresRelease'])vm.runInContext(extract(server,name),ctx);
await db.exec(`create table items(id text,item_id text,name text);
  create table guild_po_items(guild_id text,item_id text,raid_type text,enabled boolean,po_plus_enabled boolean);
  insert into items values ('wrong','22637','Götze'),('prime','22637','Götze'),('late','22637','Götze');
  insert into guild_po_items values ('guild','wrong','zg-mittwoch',true,false),('guild','prime','zg-prime',true,true),('guild','late','zg-late',true,false);`);
assert.equal(await ctx.guildPoItemRequiresRelease('guild','22637','Götze','zg-prime'),true);
assert.equal(await ctx.guildPoItemRequiresRelease('guild','22637','Götze','zg-late'),false);
assert.equal(await ctx.guildPoItemRequiresRelease('other','22637','Götze','zg-prime'),false);
layout={lootPageSectionsByRaid:{zg:{p0Plus:false}}};
assert.equal(await ctx.guildPoItemRequiresRelease('guild','22637','Götze','zg-prime'),false);
assert.throws(()=>ctx.requireRaidP0PlusEnabled(layout,'zg-late'),/deaktiviert/);
layout={lootPageSectionsByRaid:{zg:{p0Plus:true,poReleases:false}}};
assert.equal(await ctx.guildPoItemRequiresRelease('guild','22637','Götze','zg-prime'),true);
await db.close();
const panel=fs.readFileSync(new URL('raidlead-panel.html',root),'utf8');
const ui=vm.createContext({normalizeP0Text:v=>String(v||'').toLowerCase(),getP0PlusEntriesForItem:()=>[],renderItem:name=>`<span class="selected-item">${name}</span>`,safe:v=>String(v)});
for(const name of ['isActiveP0Value','isActiveP0Entry','isActiveP0PlusEntry','renderP0PlusPoints'])vm.runInContext(extract(panel,name),ui);
assert.equal(ui.isActiveP0Entry({p0Selected:'nein',p0Plus:'nein'}),false);
assert.equal(ui.isActiveP0PlusEntry({p0Selected:'ja',p0Plus:'nein'}),false);
assert.match(ui.renderP0PlusPoints('Götze',true,'Juksi'),/P0\+ gespeichert/);
assert.match(ui.renderP0PlusPoints('Götze',true,'Juksi'),/selected-item.*Götze/);
assert.doesNotMatch(ui.renderP0PlusPoints('Götze',false,'Juksi'),/selected-item/);
ui.getP0PlusEntriesForItem=()=>[{player:'Juksi',points:3}];
assert.match(ui.renderP0PlusPoints('Götze',true,'Juksi'),/selected-item.*Götze/);
assert.match(ui.renderP0PlusPoints('Götze',true,'Juksi'),/Juksi: 3/);
console.log('P0+ async selection, save payload, raid switch, duplicate item classification and raidlead display passed.');

for(const file of ["raidlead-panel.html","raidlead-panel-public.html","lichtloot-api/public/raidlead-panel.html"]){
 const source=fs.readFileSync(new URL(file,root),"utf8");
 vm.runInContext(extract(source,"renderP0PlusPoints"),ui);
 ui.getP0PlusEntriesForItem=()=>[];
 assert.match(ui.renderP0PlusPoints("Götze",true,"Juksi"),/selected-item.*Götze/);
 ui.getP0PlusEntriesForItem=()=>[{player:"Juksi",points:3}];
 assert.match(ui.renderP0PlusPoints("Götze",true,"Juksi"),/selected-item.*Götze/);
 assert.doesNotMatch(ui.renderP0PlusPoints("Götze",false,"Juksi"),/selected-item/);
}
