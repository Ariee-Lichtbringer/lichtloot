const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../..');let options;
const ctx=vm.createContext({console,Date,encodeURIComponent,URL,URLSearchParams,AbortSignal,document:{getElementById:id=>id==='guildlootParticipantRaidExport'?{}:null},APPS_SCRIPT_URL:'https://example.invalid',currentGuildSlug:()=> 'lichtloot',lichtlootSelectedCharacter:{name:'Äriee',server:'Realm'},getStoredLichtLootPlayerPin:()=> 'secret-test-pin',currentPublishedMode:true,currentRaidId:'MC-1',currentRaidDate:'2026-09-08',RAID_NAME:'mc'});
for(const f of ['guildloot-prio-download.js','guildloot-all-points.js','guildloot-personal-export.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
ctx.GuildLootPrioDownload.mount=(_,o)=>options=o;
vm.runInContext(fs.readFileSync(path.join(root,'guildloot-participant-export.js'),'utf8'),ctx);
const result=ctx.GuildLootPrioDownload.buildPrioExport({guild:{slug:'lichtloot'},raid:{id:'MC-1',name:'MC',raid_date:'2026-09-08'},instanceId:409,prios:[{Spieler:'Äriee',Server:'Realm',P1:'Blade',P1ItemId:18832,PrioCreatedAt:'2026-09-07T18:30:00Z'}],points:[],items:[]});
assert.equal(result.text.split('\n')[1].split(';')[8],String(Date.parse('2026-09-07T18:30:00Z')/1000));
const fake=async(action,params)=>{
 if(action==='getPlayerPrioHistory'){assert.equal(params.pin,'secret-test-pin');return {poReleases:{mc:true},recruitStatusLifted:false,addonCalendar:[],entries:[{player:'Äriee',server:'Realm',current:true,raidName:'MC',raidDate:'2026-09-08',p1:'Blade',prioCreatedAt:'2026-09-07T18:30:00Z'}]};}
 if(action==='getPoReleaseDisplaySettings')return {visibleRaids:['mc','bwl','recruit']};
 if(action==='getP0Plus')return {entries:[{raid:'mc',itemId:18832,item:'Blade',player:'Äriee',server:'Realm',points:42}]};
 if(action==='getLootItems')return {items:[{itemId:18832,name:'Blade'}]};
 throw Error(action);
};
(async()=>{
 const home=await ctx.GuildLootPersonalExport.collect({guild:'lichtloot',identity:{name:'Äriee',server:'Realm'},pin:'secret-test-pin',get:fake});assert(!home.text.includes('PRIOS;'));assert(home.text.includes('H;MC;'));
 const full=await options.extendExport(result,fake);assert(full.text.startsWith('GLME1;lichtloot;'));assert(!full.text.includes('secret-test-pin'));
 assert(full.text.includes('R;mc;approved'));assert(full.text.includes('R;bwl;open'));
 fs.writeFileSync('/tmp/guildloot-personal-test.txt',full.text);
 await assert.rejects(options.extendExport(result,async()=>{throw Error('offline')}));
 ctx.lichtlootSelectedCharacter=null;await assert.rejects(options.extendExport(result,fake),/Charakter/);
 console.log('Personal export: original timestamp, full points, own releases, no PIN, and failure handling passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
