import assert from 'node:assert/strict';
await import('../../raid-chronicle.js');
const {merge,type,day}=globalThis.RaidChronicle;
assert.equal(type("Ruins of Ahn'Qiraj"),'aq20');assert.equal(type("Ahn'Qiraj"),'aq40');assert.equal(type('unknown'),'');assert.equal(day('2026-09-12T23:20:00Z'),'2026-09-13');
const raid={id:'raid-a',type:'naxx',date:'2026-09-11',title:'Naxx'};
const analysis={id:'analysis',reportCode:'ABC',raid:'NAXX',raidDate:'2026-09-11'};
const stats={logId:'ABC',zone:'Naxxramas',raidDate:'2026-09-11'};
let r=merge([raid],[analysis],[stats],'lichtloot');assert.equal(r.length,1);assert.equal(r[0].archive.id,'raid-a');assert.equal(r[0].analysis.id,'analysis');assert.equal(r[0].lichtstats.logId,'ABC');
r=merge([raid],[analysis],[stats],'nachtloot');assert.equal(r.length,1);assert.equal(r[0].lichtstats,undefined);assert.equal(r[0].analysis.id,'analysis');
r=merge([raid,{...raid,id:'second'}],[analysis],[],'lichtloot');assert.equal(r.length,3);assert.equal(r[0].archive,undefined);
r=merge([raid],[analysis,{...analysis,id:'other',reportCode:'OTHER'}],[],'lichtloot');assert.equal(r.filter(r=>r.archive).length,1);assert.equal(r.filter(r=>r.analysis&&r.archive).length,0);
r=merge([raid,{...raid,id:'second'}],[{...analysis,summary:{raidId:'second'}}],[],'lichtloot');assert.equal(r.find(r=>r.analysis).archive.id,'second');
r=merge([{...raid,date:'2026-09-10'}],[analysis],[],'lichtloot');assert.equal(r.length,2);
r=merge([raid],[],[stats],'nachtloot');assert.equal(r.length,1);assert.equal(r[0].analysis,undefined);assert.equal(r[0].lichtstats,undefined);
console.log('Raidchronik: report matching, unique archive matching, ambiguous dates, explicit IDs, timezone and guild isolation OK');

// Exercise pagination query with the production function, without a database write.
const fs=await import('node:fs');const vm=await import('node:vm');
const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const fn=server.slice(server.indexOf('async function getPublicLogAnalyses('),server.indexOf('async function saveLogAnalysis('));
let args;
const context=vm.createContext({ensureLogAnalysisWebCacheTable:async()=>{},ensureLogAnalysisSheetExportsTable:async()=>{},clean:v=>String(v||''),normalizeLogAnalysis:r=>r,query:async(sql,values)=>{assert.match(sql,/where la.guild_id = \$1/);assert.match(sql,/limit \$2 offset \$4/);args=values;return {rows:Array.from({length:41},(_,id)=>({id}))};}});
vm.runInContext(fn,context);const page=await context.getPublicLogAnalyses({guildId:'guild-a',query:{limit:40,offset:40}});assert.equal(page.analyses.length,40);assert.equal(page.hasMore,true);assert.equal(args[0],'guild-a');assert.equal(args[3],40);
const start=server.indexOf('app.get("/api/lichtstats/reports"');const end=server.indexOf('app.get("/db-health"',start);let gate;
vm.runInNewContext(server.slice(start,end),{app:{get:(path,fn)=>gate=fn},resolveGuildSlug:s=>s});let status,payload;
await gate({query:{guild:'nachtloot'}},{status(n){status=n;return this;},json(d){payload=d;}},error=>{throw error;});assert.equal(status,403);assert.equal(payload.success,false);
console.log('Production API: guild-scoped pagination and LichtStats guild gate OK');
