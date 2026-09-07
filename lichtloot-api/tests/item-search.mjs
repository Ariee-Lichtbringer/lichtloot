import assert from 'node:assert/strict';
import {normalizeItemSearch,rankItemSearch,searchLootCatalog} from '../src/item-search.js';
const rows=[
 {id:'1',item_id:'22637',name:'Urzeitlicher Hakkarigötze',raid_type:'zg-prime',boss:'Hakkar'},
 {id:'2',item_id:'22637',name:'Urzeitlicher Hakkarigötze',raid_type:'zg-late'},
 {id:'3',item_id:'12345',name:'Gressil, Vorbote des Untergangs',raid_type:'naxx'},
 {id:'4',item_id:'19865',name:'Kriegsklinge der Hakkari',raid_type:'zg',slot:'Waffenhand'},
 {id:'5',item_id:'19866',name:'Kriegsklinge der Hakkari',raid_type:'zg',slot:'Schildhand'},
 {id:'6',item_id:'42',name:'Anderes Item',raid_type:'unlisted-raid'}
];
assert.equal(normalizeItemSearch(' GÖTZE '),normalizeItemSearch('goetze'));
assert.equal(rankItemSearch(rows,'götze').total,1);
assert.deepEqual(rankItemSearch(rows,'götze').items[0].raids,['zg-prime','zg-late']);
assert.equal(rankItemSearch(rows,'gressli').items[0].id,'3');
assert.equal(rankItemSearch(rows,'naxx gressil').items[0].id,'3');
assert.equal(rankItemSearch(rows,'22637').total,1);
assert.equal(rankItemSearch(rows,'2263').total,0,'IDs are not fuzzy or prefix matched');
assert.equal(rankItemSearch(rows,'Kriegsklinge').total,2,'Different game IDs remain separate');
assert.equal(rankItemSearch(rows,'anderes').items[0].id,'6','Unknown raid types are searchable');
assert.equal(rankItemSearch(rows,'x').total,0);
assert.equal(rankItemSearch(rows,'no-such-item').total,0);
assert.equal(rankItemSearch(rows,'hakkari',1).items.length,1);
let calls=[];
const query=async(sql,args)=>{calls.push({sql,args});return {rows:args?rows.filter(r=>args[0].includes(r.id)):rows};};
const result=await searchLootCatalog(query,{q:'götze'},r=>({name:r.name,itemId:r.item_id}));
assert.equal(result.total,1);assert.equal(result.items[0].raids.length,2);
assert.equal(calls.length,2);assert.ok(calls[1].sql.includes('$1::uuid[]'));assert.deepEqual(calls[1].args,[['1']]);
calls=[];await searchLootCatalog(query,{q:'a'},r=>r);assert.equal(calls.length,0);
console.log('PASS: whole catalog, umlauts, transposed letters, ranking, exact IDs, duplicate origins, distinct item variants, limits and parameterized detail query.');
