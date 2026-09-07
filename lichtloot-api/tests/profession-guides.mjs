import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('data/profession-guides.json',root),'utf8'));
const scope={window:{}};vm.runInNewContext(fs.readFileSync(new URL('profession-guides.js',root),'utf8'),scope);
const api=scope.window.GuildLootProfessions;assert.equal(data.professions.length,12);assert.equal(api.catalog.length,12);
for(const p of data.professions){
 assert(api.catalog.some(([id])=>id===p.id));assert.equal(p.steps[0].from,1);assert.equal(p.steps.at(-1).to,300);
 let end=1;
 for(const s of p.steps){assert(s.from<=end,p.id+' gap at '+s.from);end=Math.max(end,s.to);assert(s.to>s.from);
 if(p.kind==='craft'){assert(Number.isInteger(s.crafts)&&s.crafts>0);assert(s.materials.length);for(const m of s.materials){assert(m.id>0&&m.name);assert(Number.isInteger(m.quantity)&&m.quantity>0);assert.equal(m.quantity%s.crafts,0,p.id+' ingredient ratio '+s.recipe.name);}}
 }
 assert.equal(api.remainingSteps(p,300).length,0);assert.equal(api.remainingSteps(p,1).length,p.steps.length);
}
const byId=id=>data.professions.find(p=>p.id===id);
const alchemy=api.materialPlan(byId('alchemy').steps);assert.equal(alchemy.find(m=>m.id===2447).quantity,65);assert(!alchemy.some(m=>m.id===118),'Do not buy potions already crafted');
const partial=api.materialPlan(api.remainingSteps(byId('alchemy'),60));assert.equal(partial.find(m=>m.id===118).quantity,65,'Later start needs the skipped intermediate items');
const tailor=api.materialPlan(byId('tailoring').steps);assert.equal(tailor.find(m=>m.id===2589).quantity,204);assert(!tailor.some(m=>m.id===2996),'No double-counting linen bolts');
const engineering=api.materialPlan(byId('engineering').steps);for(const id of [4357,4359,4364,4375,4382,10505,10560,10561])assert(!engineering.some(m=>m.id===id),'Prepared engineering component '+id);
assert.equal(api.clampSkill(999),300);assert.equal(api.clampSkill(-1),1);assert.equal(api.clampSkill('bad'),1);
const cooking=byId('cooking');assert(cooking.steps.some(s=>s.materials.some(m=>m.id===2692)),'Cooking spices included');
for(const file of ['profession-guides.js','profession-guides.css','data/profession-guides.json'])assert.equal(fs.readFileSync(new URL(file,root),'utf8'),fs.readFileSync(new URL('lichtloot-api/public/'+file,root),'utf8'));
console.log('PASS: all 12 professions cover 1–300; positive quantities, recipe ratios, partial-skill filtering, intermediate materials, cooking spices and synchronized assets.');
