import assert from 'node:assert/strict';
import {createBetaAccess,betaSpecs} from '../src/forever-beta-access.js';
process.env.FOREVER_BETA_PINS=JSON.stringify({test:'test-pin'});
const guild={id:'guild',slug:'test'};
for(const [className,specs] of Object.entries(betaSpecs))for(const [specialization,role] of Object.entries(specs)){
 const calls=[];const db={release(){},async query(sql,args){calls.push({sql,args});return {rows:[]};}};
 const access=createBetaAccess({pool:{connect:async()=>db},query:async()=>({rows:[]}),raids:{run:async()=>{}}});
 await access.authorize(guild,{betaPin:'test-pin',characterName:'Aria',className,specialization,role:'invalid-client-role'});
 assert.equal(calls.find(c=>c.sql.startsWith('insert into forever_characters')).args.at(-1),role);
 assert.equal(calls.find(c=>c.sql.startsWith('update forever_beta_guests set specialization')).args.at(-1),specialization);
 await assert.rejects(access.authorize(guild,{betaPin:'test-pin',characterName:'Aria',className,specialization:'invalid'}),/Skillung/);
}
console.log('All 28 class/spec combinations, role derivation and invalid spec rejection passed');
