const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function fn(s,name){const start=s.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0,name);const tail=s.slice(start),end=tail.slice(1).search(/\n(?:async )?function /);return end<0?tail:tail.slice(0,end+1);}
(async()=>{let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++};const pm=read('raidlead-panel.html'),lead=read('gildenleitung.html');
const old=[{player:'Saved player',points:5}],ctx=vm.createContext({console:{error(){},warn(){}},URLSearchParams,Date,Math,window:{location:{search:''}},sessionStorage:{getItem:()=>'',setItem(){}},raidleadStorageKey:x=>x,RANDOM_RAIDLEAD_MODE:false,fetchCurrentGuildInfo:async()=>{},currentGuildSlug:()=> 'lichtloot',RAID_API_URL:'https://fixture.invalid',currentRaidData:{raidId:'r1'},currentRaidKey:'aq40',currentPrios:old,currentReleased:true,currentPrioCheck:{saved:true},currentP0PlusEntries:old,raids:{aq40:{short:'AQ40'}},isAllowedP0Raid:()=>true,raidLoadError:'',p0PointsLoadError:'',isActiveFlag:v=>v===true,normalizeP0Entry:v=>v});
vm.runInContext(fn(pm,'loadPriosFromRailway')+'\n'+fn(pm,'loadP0PlusPoints'),ctx);
for(const result of [null,{ok:false,body:{error:'Service unavailable'}},{ok:true,body:{success:false,error:'Request failed'}},{ok:true,body:{unexpected:[]}}]){
 ctx.fetch=async()=>{if(!result)throw Error('Network error');return {ok:result.ok,json:async()=>result.body}};
 eq(await ctx.loadPriosFromRailway('fixture','aq40'),false);eq(ctx.currentPrios,old);eq(ctx.currentReleased,true);assert(ctx.raidLoadError);n++;
 eq(await ctx.loadP0PlusPoints(),old);eq(ctx.currentP0PlusEntries,old);assert(ctx.p0PointsLoadError);n++;
}
ctx.fetch=async()=>({ok:true,json:async()=>({success:true,prios:[],raidId:'r1',published:false})});eq(await ctx.loadPriosFromRailway('fixture','aq40'),true);eq(ctx.currentPrios.length,0);eq(ctx.raidLoadError,'');eq(ctx.currentReleased,false);
ctx.fetch=async()=>({ok:true,json:async()=>({success:true,entries:[]})});await ctx.loadP0PlusPoints();eq(ctx.currentP0PlusEntries.length,0);eq(ctx.p0PointsLoadError,'');
// Dashboard refresh preserves real values on failure, and removes retired raid statistics.
const stats=vm.createContext({dashboardRaidStatsGeneration:0,dashboardRaidStats:{r1:{prios:8,signups:10},old:{prios:2}},getDashboardActiveRaids:()=>[{raidId:'r1'}],renderDashboardCards(){},railwayApi:async()=>{throw Error('offline')}});
vm.runInContext(fn(lead,'loadDashboardRaidStats'),stats);await stats.loadDashboardRaidStats();eq(stats.dashboardRaidStats.r1.prios,8);eq(stats.dashboardRaidStats.r1.signups,10);eq(stats.dashboardRaidStats.r1.error,true);eq(stats.dashboardRaidStats.old,undefined);
stats.railwayApi=async()=>({success:true,signups:[],externalSignups:[],prioCount:0});await stats.loadDashboardRaidStats();eq(stats.dashboardRaidStats.r1.prios,0);eq(stats.dashboardRaidStats.r1.signups,0);eq(stats.dashboardRaidStats.r1.error,undefined);
// Aftercare: only overdue, enabled, unresolved raids, including when no upcoming raids exist.
const box={innerHTML:'',hidden:true,classList:{add(){box.hidden=true},remove(){box.hidden=false},toggle(k,b){box.hidden=b}}};
const raids=[{id:'open',raid:'aq40',raidDate:'2026-09-01'},{id:'manual',raid:'aq40',raidDate:'2026-09-01'},{id:'cancelled',raid:'aq40',raidDate:'2026-09-01',status:'abgesagt'},{id:'disabled',raid:'aq20',raidDate:'2026-09-01'},{id:'future',raid:'aq40',raidDate:'2026-09-08'},{id:'transferred',raid:'aq40',raidDate:'2026-09-01',p0PlusTransferCount:1}];
const dash=vm.createContext({document:{getElementById:()=>box,body:{classList:{contains:()=>false}}},lastOverviewLoadedAt:1,leadershipTaskState:{reviews:[{internalRaidId:'manual',state:'manual'}]},guildData:{raids},normalize:s=>s.toLowerCase(),todayIsoDate:()=> '2026-09-06',getRaidKey:r=>r.raid,currentGuildInfo:{layout:{lootPageSectionsByRaid:{aq20:{p0Plus:false}}}},CURRENT_GUILD_SLUG:'lichtloot',escapeHtml:String,escapeAttr:String,formatRaidDate:String});
for(const name of ['leadershipReviewForRaid','guildRaidP0PlusEnabled','isAllowedP0RaidForRaid','isZgRaidForP0Transfer','canTransferP0PlusFromRaid','hasP0PlusTransfer','needsP0PlusTransferBeforeArchive','leadershipPendingTransfers','renderRaidAftercare'])vm.runInContext(fn(lead,name),dash);
eq(dash.leadershipPendingTransfers().map(r=>r.id).join(','),'open');dash.renderRaidAftercare();eq(box.hidden,false);assert(box.innerHTML.includes('Nachbereitung · 1 offen'));n++;
dash.leadershipTaskState.reviews=null;dash.renderRaidAftercare();assert(box.innerHTML.includes('nicht geladen'));n++;
dash.leadershipTaskState.reviews=[];dash.guildData.raids=[];dash.renderRaidAftercare();eq(box.hidden,true);
for(const file of ['gildenleitung.html','raidlead-panel.html'])for(const m of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=|application\/ld\+json|application\/json/.test(m[1]))continue;new vm.Script(m[2],{filename:file});n++;}
console.log(`${n} assertions and script checks passed.`);
})().catch(e=>{console.error(e);process.exit(1)});
