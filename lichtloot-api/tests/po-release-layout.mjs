import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const extract=name=>{const start=src.indexOf('function '+name+'(');return src.slice(start,src.indexOf('\n}\n',start)+2)};
const ctx=vm.createContext({clean:v=>String(v??'').trim(),normalizeRaidType:v=>String(v||'').toLowerCase(),ALL_PO_RELEASE_DISPLAY_RAIDS:['recruit','mc','bwl','aq40','aq20','naxx','zg-prime','zg-late','zg-mittwoch']});
for(const name of ['normalizePoReleaseRaid','poReleaseDisplaySettingsFromLayout','poReleasesRequiredForRaid','lootPoReleaseVisibleRaids'])vm.runInContext(extract(name),ctx);
for(const visible of [[],['mc'],['zg-prime','zg-late']]){
 const settings=ctx.poReleaseDisplaySettingsFromLayout({poReleaseVisibleRaids:visible,poReleaseDisplayVersion:2,lootPageSections:{poReleases:true},lootPageSectionsByRaid:{zg:{poReleases:false},aq20:{poReleases:false}}});
 assert.equal(ctx.poReleasesRequiredForRaid(settings,'mc'),true,'Hidden MC column must not disable requirement');
 for(const key of ['zg-prime','zg-late','zg-mittwoch','zg','aq20'])assert.equal(ctx.poReleasesRequiredForRaid(settings,key),false,'Displayed column cannot enable loot-page requirement');
 assert.deepEqual(Array.from(settings.visibleRaids),visible);
 assert.deepEqual(Array.from(ctx.lootPoReleaseVisibleRaids(settings)),['recruit','mc','bwl','aq40','naxx']);
 settings.poReleasesEnabled=false;assert.equal(ctx.poReleasesRequiredForRaid(settings,'mc'),false);
}
const client=fs.readFileSync(new URL('../../loot/po-release-status.js',import.meta.url),'utf8');const start=client.indexOf('  function poReleasesEnabledForCurrentPage('),end=client.indexOf('\n  async function ',start);const ui=vm.createContext({window:{currentGuildInfo:null},location:{pathname:'/loot/zg-loot.html'}});vm.runInContext(client.slice(start,end),ui);
assert.equal(ui.poReleasesEnabledForCurrentPage(true,[],true,{zg:{poReleases:true}}),true);
assert.equal(ui.poReleasesEnabledForCurrentPage(true,['zg-prime'],true,{zg:{poReleases:false}}),false);
assert.equal(ui.poReleasesEnabledForCurrentPage(false,['zg-prime'],true,{}),false);
console.log('PASS: staff column visibility is independent of loot-page requirements; global and per-page layout switches control backend and browser.');
