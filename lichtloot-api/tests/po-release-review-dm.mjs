import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const start=source.indexOf('async function reviewPoReleaseRequest(');
const fn=source.slice(start,source.indexOf('\nasync function deletePoReleaseRequest',start));
let linked=true;const notices=[];const writes=[];
const ctx=vm.createContext({
  clean:v=>String(v??'').trim(),isUuid:()=>true,normalizePoReleaseRaid:v=>v,
  ensureCharacterPoReleaseSchema:async()=>{},authorizePoClassManagement:async()=>{},requireMasterCode:()=>{},
  getGuildEraConfiguration:async()=>({rules:{recruit:{enabled:false}}}),
  enqueueBotUpdate:async notice=>notices.push(notice),p0ReleaseCache:null,
  query:async(sql,args)=>{
    writes.push(sql);
    if(sql.includes('select r.*'))return {rows:[{id:'request',character_id:'char',name:'Fixture',class_name:'Priest',request_type:'p0',raid_type:'bwl'}]};
    if(sql.includes('select dpl.discord_user_id'))return {rows:[{discord_user_id:linked?'123':'',player_pin:'private',slug:'guild',guild_name:'Guild',server:'Everlook'}]};
    return {rows:[{}]};
  }
});
vm.runInContext(fn,ctx);
const review=async(decision,extra={})=>{notices.length=0;writes.length=0;return ctx.reviewPoReleaseRequest({guildId:'guild-id',query:{id:'request',decision,manualOverride:'true',...extra}})};
let r=await review('approved');assert.equal(r.approvalDmQueued,true);assert.equal(notices[0].type,'po_approval_notice');assert.equal(notices[0].payload.discordUserId,'123');assert.equal(notices[0].payload.requestId,'request');assert.equal(notices[0].payload.item,'P0-Freigabe BWL');assert.ok(!JSON.stringify(notices).includes('private'));
r=await review('rejected',{sendRejectionDm:'true',reviewNote:'Fehlende Verzauberung'});assert.equal(r.rejectionDmQueued,true);assert.equal(notices[0].payload.reason,'Fehlende Verzauberung');assert.equal(notices[0].type,'po_rejection_notice');
await review('rejected',{sendRejectionDm:'false',reviewNote:'Voraussetzungen fehlen'});assert.equal(notices.length,1,'Jede Ablehnung benachrichtigt den Spieler, auch bei veralteten Clients');
await assert.rejects(review('rejected'),/Ablehnungsgrund/);
linked=false;r=await review('approved');assert.equal(r.approvalDmQueued,false);assert.equal(notices.length,0);
r=await review('rejected',{sendRejectionDm:'true',reviewNote:'Grund'});assert.equal(r.rejectionDelivery,'nachtloot_mailbox');assert.equal(notices.length,0);assert.ok(writes.some(s=>s.includes('insert into player_messages')));
console.log('PASS approval DM, rejection DM, mandatory rejection notice, missing Discord link, mailbox fallback and no PIN disclosure.');
