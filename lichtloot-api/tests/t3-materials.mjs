import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const data=JSON.parse(fs.readFileSync(new URL('../../data/t3-materials.json',import.meta.url),'utf8'));const window={};vm.runInNewContext(fs.readFileSync(new URL('../../t3-materials.js',import.meta.url),'utf8'),{window});const {requirementsFor}=window.GuildLootT3;
assert.equal(Object.keys(data.items).length,81);assert.equal(Object.values(data.items).filter(i=>i.directDrop).length,9);
for(const item of Object.values(data.items)){if(item.directDrop)continue;assert.ok(item.questId);assert.ok(item.requirements.length>=3);assert.equal(item.requirements.filter(r=>r.name.startsWith('Entweiht')&&r.quantity===1).length,1);assert.ok(item.requirements.every(r=>Number.isInteger(r.quantity)&&r.quantity>0));assert.match(item.source,/\/classic\/de\/quest=/);}
const priest=requirementsFor(data,22519)[0];assert.deepEqual(priest.requirements.map(r=>[r.itemId,r.quantity]),[[22369,1],[22376,6],[12363,1],[20725,1]]);
assert.equal(requirementsFor(data,22467)[0].requirements.find(r=>r.itemId===14342).quantity,2,'Shaman shoulders require two mooncloth, not hides');
assert.equal(requirementsFor(data,22478)[0].gold,75,'Rogue gold cost is preserved');
assert.equal(requirementsFor(data,23061)[0].directDrop,true);assert.equal(requirementsFor(data,16920).length,0,'T2 is not T3');assert.equal(requirementsFor(data,22369).length,3,'Cloth token has three distinct class requirements');
console.log('PASS: all 81 T3 items, 72 quests, nine direct-drop rings, exact priest requirements, shaman correction, rogue gold and token variants.');
