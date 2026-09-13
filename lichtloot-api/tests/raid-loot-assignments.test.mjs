import assert from 'node:assert/strict';
import {receiptKey,assignmentInput,installRaidLootAssignments} from '../src/raid-loot-assignments.js';
const character='11111111-1111-4111-8111-111111111111', key=receiptKey('session','receipt');
assert.notEqual(key,receiptKey('other','receipt'));assert.notEqual(receiptKey('a:b','c'),receiptKey('a','b:c'));assert.equal(receiptKey('','id'),'');
for(const body of [{receiptKey:'bad',revision:0,name:'A'},{receiptKey:key,revision:-1,name:'A'},{receiptKey:key,revision:0,name:''},{receiptKey:key,revision:0,name:'x\nhi'},{receiptKey:key,revision:0,name:'x'.repeat(81)}])assert.throws(()=>assignmentInput(body));
let handler,stored=null,history=[],released=0,authorized=0,queries=[],failAudit=false;
const query=async(sql,args)=>{
 queries.push({sql,args});
 if(sql.includes('create table'))return {rows:[]};
 if(sql.includes('from raids')){assert.equal(args[0],'guild-a');return {rows:args[1]==='other-raid'?[]:[{id:'raid-a'}]};}
 if(sql.includes('from guildloot_era_logs')){assert.deepEqual(args,['guild-a','raid-a']);return {rows:[{payload:{sessionId:'session',receipts:[{id:'receipt',recipient:'Original'}]}}]};}
 if(sql.includes('from characters')){assert.equal(args[0],'guild-a');return {rows:args[1]===character?[{id:character,name:'Ariee',server:'Everlook'}]:[]};}
 throw Error('Unexpected query '+sql);
};
let transaction;
const client={release(){released++;},async query(sql,args){
 if(sql==='BEGIN'){transaction=structuredClone({stored,history});return {rows:[]};}
 if(sql==='ROLLBACK'){({stored,history}=transaction);return {rows:[]};}
 if(sql==='COMMIT')return {rows:[]};
 if(sql.includes('from raids'))return query(sql,args);
 if(sql.includes('select revision'))return {rows:stored?[stored]:[]};
 if(sql.includes('insert into raid_loot_assignments')){stored={name:args[4],server:args[5],revision:args[6]};return {rows:[stored]};}
 if(sql.includes('insert into raid_loot_assignment_history')){if(failAudit)throw Error('audit unavailable');history.push(args);return {rows:[]};}
 throw Error('Unexpected transaction '+sql);
}};
installRaidLootAssignments({post(path,fn){assert.equal(path,'/api/leadership/raid-archive');handler=fn;}},{pool:{async connect(){return client;}},query,requireGuild:async slug=>({id:'guild-a',slug}),resolveGuildSlug:s=>s,authorize(g,code){authorized++;if(code!=='valid')throw Object.assign(Error('Forbidden'),{statusCode:403});}});
async function run(values={}){let data,error;await handler({body:{action:'assign',guild:'guild-a',masterCode:'valid',raidId:'raid-a',receiptKey:key,revision:stored?.revision||0,name:'Freispieler',...values}},{setHeader(){},json(d){data=d;}},e=>{error=e;});return {data,error};}
const count=queries.length;assert.equal((await run({masterCode:'wrong'})).error.statusCode,403);assert.equal(queries.length,count);
assert.equal((await run({raidId:'other-raid'})).error.statusCode,404);
assert.equal((await run({receiptKey:receiptKey('session','missing')})).error.statusCode,404);
assert.equal((await run({characterId:'22222222-2222-4222-8222-222222222222'})).error.statusCode,404);
let r=await run({characterId:character,name:'Spoofed',server:'Other'});assert.equal(r.data.assignment.name,'Ariee');assert.equal(r.data.assignment.server,'Everlook');assert.equal(history.length,1);
assert.equal((await run({revision:0})).error.statusCode,409);assert.equal(stored.name,'Ariee');assert.equal(history.length,1);
r=await run({name:'Externer',server:''});assert.equal(r.data.assignment.name,'Externer');assert.equal(stored.revision,2);
failAudit=true;assert((await run({name:'Rollback'})).error);assert.equal(stored.name,'Externer');assert.equal(history.length,2);failAudit=false;
r=await run({clear:true});assert.equal(r.data.assignment.name,'');assert.equal(stored.revision,3);assert.equal(history.length,3);
assert.equal((await run({action:'access'})).data.success,true);assert(released>=5);assert(authorized>=10);
assert(!queries.some(q=>/update guildloot_era_logs|update priorities|delete from/.test(q.sql)));
console.log('Loot assignment: authorization, guild/receipt scope, canonical database identity, free names, conflicts, reset and atomic audit rollback OK');
