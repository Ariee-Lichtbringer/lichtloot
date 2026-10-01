import assert from 'node:assert/strict';
import {createBetaAccess} from '../src/forever-beta-access.js';
process.env.FOREVER_BETA_PINS=JSON.stringify({test:'test-pin'});
for(const existing of [false,true]){
 const calls=[];
 const db={release(){},async query(sql,args){calls.push({sql,args});return {rows:sql.startsWith('select * from forever_beta_guests')&&existing?[{player_id:'player',character_id:'character'}]:[]};}};
 const access=createBetaAccess({pool:{connect:async()=>db},query:async()=>({rows:[]}),raids:{run:async()=>{}}});
 await access.authorize({id:'guild',slug:'test'},{betaPin:'test-pin',characterName:'Aria',className:'priest',role:'heal'});
 const saved=calls.find(c=>c.sql.startsWith(existing?'update forever_characters':'insert into forever_characters'));
 assert.equal(saved.args.at(-1),'heal');
 await assert.rejects(access.authorize({id:'guild',slug:'test'},{betaPin:'test-pin',characterName:'Aria',className:'priest',role:'invalid'}),/Rolle/);
 calls.length=0;
 await access.authorize({id:'guild',slug:'test'},{betaPin:'test-pin',characterName:'Aria',className:'priest'});
 const legacy=calls.find(c=>c.sql.startsWith(existing?'update forever_characters':'insert into forever_characters'));
 assert.equal(legacy.args.at(-1),existing?null:'dd');
}
console.log('Beta role persistence and backwards compatibility passed');
