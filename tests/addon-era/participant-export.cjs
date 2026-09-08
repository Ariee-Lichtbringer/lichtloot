const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../..');let options;
const context=vm.createContext({document:{getElementById:()=>({})},GuildLootPrioDownload:{mount:(host,value)=>options=value},APPS_SCRIPT_URL:'https://example.invalid/api',currentGuildSlug:()=> 'guild-b',currentPublishedMode:false,currentRaidId:'raid-1',currentRaidDate:'2026-09-08',RAID_NAME:'mc'});
vm.runInContext(fs.readFileSync(path.join(root,'guildloot-participant-export.js'),'utf8'),context);
assert.equal(options.guild,'guild-b');assert.equal(options.requirePublished,true);assert.throws(()=>options.getRaid());
context.currentPublishedMode=true;assert.equal(options.getRaid().raidId,'raid-1');context.currentRaidId='raid-2';assert.equal(options.getRaid().raidId,'raid-2');
(async()=>{
 const controls={};for(const key of ['data-export','data-status','data-text','data-download'])controls['['+key+']']={hidden:true,focus(){},select(){}};
 const host={isConnected:true,querySelector:key=>controls[key]};let published=false;
 const ctx=vm.createContext({URL,URLSearchParams,AbortSignal,Date,Set,Error,encodeURIComponent,fetch:async(url)=>({ok:true,json:async()=>url.searchParams.get('action')==='getPublishedPrios'?{published,prios:[]}:url.searchParams.get('action')==='getP0Plus'?{entries:[]}:{items:[]}})});
 vm.runInContext(fs.readFileSync(path.join(root,'guildloot-prio-download.js'),'utf8'),ctx);
 ctx.GuildLootPrioDownload.mount(host,{api:'https://example.invalid/api',guild:'guild-b',requirePublished:true,getRaid:()=>({raid:'mc',raidId:'raid-2',raidDate:'2026-09-08'})});
 await controls['[data-export]'].onclick();assert.equal(controls['[data-text]'].hidden,true);assert.match(controls['[data-status]'].textContent,/nicht veröffentlicht/);
 published=true;await controls['[data-export]'].onclick();assert.equal(controls['[data-text]'].hidden,false);assert.match(controls['[data-text]'].value,/GLP1;guild-b;raid-2;/);
 console.log('Participant exports: correct guild, current raid and published-only access passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
