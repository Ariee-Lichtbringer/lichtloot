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
const {readFileSync}=await import('node:fs');const t3=JSON.parse(readFileSync(new URL('../../data/t3-materials.json',import.meta.url),'utf8'));
const tierRows=Object.entries(t3.items).map(([id,item])=>({id,item_id:id,name:item.name,raid_type:'naxx',slot:item.slot}));
for(const cls of ['Paladin','Priester','Krieger','Jäger','Schamane','Schurke','Druide','Magier','Hexenmeister'])assert.equal(rankItemSearch(tierRows,`T3 ${cls}`).total,9,cls+' must find all eight armor pieces and the ring');
const paladin=rankItemSearch(tierRows,'T3 Paladin').items.map(i=>i.item_id).sort();assert.deepEqual(paladin,['22424','22425','22426','22427','22428','22429','22430','22431','23066']);
assert.equal(rankItemSearch(tierRows,'tier 3 pala').total,9);assert.equal(rankItemSearch(tierRows,'T3 Paladni').total,9);assert.equal(rankItemSearch(tierRows,'T3 priest').total,9);assert.equal(rankItemSearch(tierRows,'T3 Paladin Head').total,1);
assert.equal(rankItemSearch([{id:'x',item_id:'21604',name:'Armreifen der königlichen Erlösung',raid_type:'aq40'}],'T3 Paladin').total,0);
console.log('PASS: all nine T3 classes, complete Paladin set including ring, tier aliases, typos, slot filters and exclusion of unrelated items.');
const aq=JSON.parse(readFileSync(new URL('../../data/aq40-materials.json',import.meta.url),'utf8'));
const aqRows=Object.entries(aq.items).map(([id,item])=>({id,item_id:id,name:item.name,raid_type:'aq40',slot:item.slot}));
const mixed=[...tierRows,...aqRows,{id:'token',item_id:'20932',name:'Dominanzbindungen der Qiraji',raid_type:'aq40'}];
for(const [cls,mask] of [['Krieger',1],['Paladin',2],['Jäger',4],['Schurke',8],['Priester',16],['Schamane',64],['Magier',128],['Hexenmeister',256],['Druide',1024]]){
 const expected=Object.entries(aq.items).filter(([,e])=>e.classMask===mask).map(([id])=>id).sort();
 for(const prefix of ['T 2,5','T2,5','T 2.5','T2.5','Tier 2,5','Tier2.5','T25']){
  const result=rankItemSearch(mixed,`${prefix} ${cls}`);
  assert.equal(result.total,5,`${prefix} ${cls}`);assert.deepEqual(result.items.map(i=>i.item_id).sort(),expected);
 }
 assert.equal(rankItemSearch(mixed,`T3 ${cls}`).total,9,'T3 remains separate');
}
assert.equal(rankItemSearch(mixed,'T 2,5 Paladni').total,5);
assert.equal(rankItemSearch(mixed,'T2.5 pala').total,5);
assert.equal(rankItemSearch(mixed,'T2,5 priest').total,5);
assert.equal(rankItemSearch(mixed,'T2,5 Paladin Helm').total,1);
assert.equal(rankItemSearch(mixed,'20932').total,1);
console.log('PASS: T2.5/T 2,5/Tier aliases for all nine classes, exact five pieces, typos, slot filters, token exclusion and separation from T3.');
