const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
function fn(s,name){const start=s.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0,name);const tail=s.slice(start);const end=tail.slice(1).search(/\n(?:async )?function /);return end<0?tail:tail.slice(0,end+1);}
(async()=>{
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
const module=read('lichtloot-api/src/raid-completion.js'),{loadRaidCompletion,raidCompletionState}=await import(uri(module));
const raid={id:'r1',external_raid_id:'AQ40-test',raid_pin:'P1',raid_type:'aq40',status:'geschlossen',date_text:'2026-09-01',raid_date:'2026-09-01',raid_time:'20:00',has_started:true};
for(const [input,state] of [[{},'open'],[{taskAction:'task_manual_transfer'},'manual'],[{taskAction:'task_raid_cancelled'},'cancelled'],[{taskAction:'task_reopened'},'open'],[{transferred:true},'transferred'],[{enabled:false},'not_required']])ok(raidCompletionState(raid,input),state);
ok(raidCompletionState({...raid,status:'abgesagt'}),'cancelled');
ok(raidCompletionState({...raid,p0plus_transferred_at:'2026-09-01T20:00:00Z'}),'transferred');
ok(raidCompletionState({...raid,p0plus_transferred_at:'2026-09-01T20:00:00Z',p0plus_transfer_reset_at:'2026-09-02T20:00:00Z'}),'open');
let params;ok(await loadRaidCompletion({query:async(sql,p)=>{params=p;return {rows:[{task_action:'task_manual_transfer',transferred:false}]}}},'guild',raid),'manual');ok(params.slice(0,3),['guild','r1',['RaidID: AQ40-test','RaidID: r1','RaidID: P1']]);
// Exercise the real archive handler: no production database or mutations.
const server=read('lichtloot-api/src/server.js');
for(const [label,action,enabled,status,transferred,blocked,type] of [
 ['manual','task_manual_transfer',true,'geschlossen',false,false,'aq40'],
 ['cancelled','',true,'abgesagt',false,false,'aq40'],
 ['cancel audit','task_raid_cancelled',true,'archiviert',false,false,'aq40'],
 ['disabled','',false,'geschlossen',false,false,'aq20'],
 ['open','',true,'geschlossen',false,true,'aq40'],
 ['open AQ20','',true,'geschlossen',false,true,'aq20'],
 ['reopened','task_reopened',true,'geschlossen',false,true,'aq40'],
 ['historic transfer','',true,'geschlossen',true,false,'aq40']]){
 let writes=0;
 const record={...raid,status,raid_type:type};
 const query=async(sql,p)=>{if(sql.includes('task_action'))return {rows:[{task_action:action,transferred}]};if(sql.includes('update raids')){writes++;return {rows:[{...record,status:'archiviert'}]}};throw Error(sql)};
 const ctx=vm.createContext({clean:v=>String(v||'').trim(),findP0DiscordRaid:async()=>record,normalizeStatus:v=>v,normalizeRaidType:v=>v,getGuildEraConfiguration:async()=>({layout:{}}),raidP0PlusEnabled:()=>enabled,loadRaidCompletion,query,normalizeRaidRow:v=>v,archiveLinkedRaidSignups:async()=>null});
 vm.runInContext(fn(server,'setRaidStatus'),ctx);
 if(blocked)await assert.rejects(()=>ctx.setRaidStatus({guildId:'guild',query:{status:'archiviert'}}),e=>e.statusCode===409,label);else ok((await ctx.setRaidStatus({guildId:'guild',query:{status:'archiviert'}})).success,true);
 ok(writes,blocked?0:1);
}
// Real closeout service with one eligible character: manual suppresses only new awards.
const closeSrc=read('lichtloot-api/src/raid-closeout.js').replace("'./raid-completion.js'",JSON.stringify(uri(module)));
const {createRaidCloseoutService}=await import(uri(closeSrc));
for(const [action,status,enabled,expected] of [['', 'geschlossen',true,1],['task_manual_transfer','geschlossen',true,0],['task_reopened','geschlossen',true,1],['task_raid_cancelled','archiviert',true,0],['','abgesagt',true,0],['','geschlossen',false,0]]){
 const client={release(){},async query(sql,p){
 if(/^(begin|rollback)/.test(sql))return {rows:[]};
 if(sql.includes('task_action'))return {rows:[{task_action:action,transferred:false}]};
 if(sql.includes('select r.*,r.raid_date'))return {rows:[{...raid,status}]};
 if(sql.includes('select id,external_raid_id'))return {rows:[raid]};
 if(sql.includes('from prios pr'))return {rows:[{id:'p1',raid_id:'r1',character_id:'char',player:'Test',server:'Realm',item:'Item',game_id:'123',p1_item_id:'item',comment:{p0Plus:true},signup_status:'active'}]};
 if(sql.includes('from p0plus_point_audit'))return {rows:[]};
 if(sql.includes('select pp.id')||sql.includes('from bot_update_queue'))return {rows:[]};
 if(sql.includes('select id from items'))return {rows:[{id:'item'}]};
 if(sql.includes('coalesce(sum(points)'))return {rows:[{points:5}]};
 throw Error(sql);
 }};
 const service=createRaidCloseoutService({pool:{connect:async()=>client},secret:'fixture',authorize:async()=>{},configuration:async()=>({layout:{},rules:{p0Plus:{raidTransferPoints:1}}}),resolveTarget:async()=> 'aq40',plusEnabled:()=>enabled,itemPlus:async()=>true,staffBenchSql:()=> 'false',reminderQueueSql:()=> 'false'});
 const result=await service.review({id:'guild'},{raidId:'r1'});ok(result.counts.missingPoints,expected);ok(result.actions.filter(a=>a.type==='points').length,expected);
}
const pm=read('raidlead-panel.html'),lead=read('gildenleitung.html');
for(const [guild,key,layout,expected] of [['lichtloot','aq20',{lootPageSectionsByRaid:{aq20:{p0Plus:false}}},false],['lichtloot','aq40',{lootPageSectionsByRaid:{aq40:{p0Plus:true}}},true],['nachtloot','zg',{lootPageSectionsByRaid:{zg:{p0Plus:true}}},true],['nachtloot','zg-prime',{lootPageSectionsByRaid:{zg:{p0Plus:false}}},false],['lichtloot','aq40',null,false]]){
 const ctx=vm.createContext({currentGuildSlug:()=>guild,currentRaidKey:key,currentGuildInfo:{layout}});vm.runInContext(fn(pm,'isAllowedP0Raid'),ctx);ok(ctx.isAllowedP0Raid(),expected);
}
for(const [review,status,enabled,transferred,expected] of [['manual','geschlossen',true,false,false],['cancel','archiviert',true,false,false],['','abgesagt',true,false,false],['','geschlossen',false,false,false],['reopen','geschlossen',true,false,true],['','geschlossen',true,true,false]]){
 const ctx=vm.createContext({leadershipReviewForRaid:()=>({state:review}),canTransferP0PlusFromRaid:()=>enabled,hasP0PlusTransfer:()=>transferred});vm.runInContext(fn(lead,'needsP0PlusTransferBeforeArchive'),ctx);ok(ctx.needsP0PlusTransferBeforeArchive({status}),expected);
}
// Old sticky flags must never override the freshly loaded server status.
const statusCode=pm.slice(pm.indexOf('    const publishedValue ='),pm.indexOf('    currentPrios = (result.prios'));
for(const published of [true,false]){
 const ctx=vm.createContext({result:{published},isActiveFlag:v=>v===true,currentReleased:null,sessionStorage:{getItem:()=> 'true'},localStorage:{getItem:()=> 'true'}});vm.runInContext(statusCode,ctx);ok(ctx.currentReleased,published);
}
for(const file of ['gildenleitung.html','raidlead-panel.html']){for(const match of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=/.test(match[1])||/application\/ld\+json|application\/json/.test(match[1]))continue;new vm.Script(match[2],{filename:file});checks++;}}
for(const copy of ['lichtloot-api/public/gildenleitung.html','lichtloot-api/src/gildenleitung.html'])ok(fn(read('gildenleitung.html'),'needsP0PlusTransferBeforeArchive'),fn(read(copy),'needsP0PlusTransferBeforeArchive'));ok(fn(read('raidlead-panel.html'),'isAllowedP0Raid'),fn(read('lichtloot-api/public/raidlead-panel.html'),'isAllowedP0Raid'));
console.log(`${checks} assertions and script checks passed. No live writes.`);
})().catch(e=>{console.error(e);process.exitCode=1});
