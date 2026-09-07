import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url), data=JSON.parse(fs.readFileSync(new URL('data/aq40-materials.json',root),'utf8'));
const items=Object.values(data.items),sets=items.filter(e=>e.kind==='set'),weapons=items.filter(e=>e.kind==='weapon');
assert.equal(sets.length,45);assert.equal(weapons.length,7);assert.equal(new Set(items.map(e=>e.questId)).size,47);
for(const mask of [1,2,4,8,16,64,128,256,1024])assert.equal(sets.filter(e=>e.classMask===mask).length,5);
for(const e of sets){assert.equal(e.requirements.length,4);assert.deepEqual(e.requirements.map(r=>r.quantity),[1,2,5,5]);assert.equal(e.reputation.standing,{Boots:'Neutral',Shoulder:'Neutral',Helm:'Freundlich',Pants:'Freundlich',Chest:'Wohlwollend'}[e.slot]);}
for(const e of weapons){assert.equal(e.reputation,null);assert.deepEqual(e.requirements[1],{itemId:18562,name:'Elementiumerz',quantity:3});}
for(const e of items){assert.ok(e.questgiver.name);assert.ok(e.location);assert.equal(e.minimumLevel,60);assert.match(e.source,/wowhead.com\/classic\/de\/quest=/);assert.equal(e.tokenId,e.requirements[0].itemId);}
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.isConnected=true;this.value='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this.textContent='';}
 setAttribute(key,value){this[key]=value;}
}
let fetches=0;const scope={window:{},document:{createElement:t=>new Element(t)},Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}},fetch:async()=>{fetches++;return {ok:true,json:async()=>data};}};
vm.runInNewContext(fs.readFileSync(new URL('aq40-materials.js',root),'utf8'),scope);
const api=scope.window.GuildLootAQ40,walk=n=>[n,...n.children.flatMap(walk)];
for(const [token,count] of [[20928,8],[20932,10],[21232,4],[21237,3]])assert.equal(api.requirementsFor(data,token).length,count);
assert.equal(api.requirementsFor(data,22369).length,0);
for(const itemId of [...Object.keys(data.items),...new Set(items.map(e=>String(e.tokenId)))]){const parent=new Element('div');await api.mount(parent,{itemId});assert.equal(parent.children.length,1,`mount ${itemId}`);assert.equal(walk(parent).filter(n=>n.tagName==='a').length,0);}
const parent=new Element('div');await api.mount(parent,{itemId:21232});const select=walk(parent).find(n=>n.tagName==='select');assert.equal(select.children.length,5);select.value='0';select.onchange();let nodes=walk(parent);assert.ok(nodes.some(n=>n.textContent==='Quest in GuildLoot ansehen'));assert.ok(nodes.some(n=>n.textContent==='Arygos'));assert.ok(nodes.some(n=>n.textContent.includes('kein Elementiumbarren')));select.value='';select.onchange();assert.equal(walk(parent).filter(n=>n.tagName==='details').length,0);
const unrelated=new Element('div');await api.mount(unrelated,{itemId:22519});assert.equal(unrelated.children.length,0);assert.equal(fetches,1);
for(const path of ['lichtloot-api/public/aq40-materials.js','lichtloot-api/src/aq40-materials.js'])assert.equal(fs.readFileSync(new URL(path,root),'utf8'),fs.readFileSync(new URL('aq40-materials.js',root),'utf8'));
assert.deepEqual(JSON.parse(fs.readFileSync(new URL('lichtloot-api/public/data/aq40-materials.json',root),'utf8')),data);
console.log('PASS: 45 class set rewards, 7 imperial rewards, 47 quests, all 10 tokens, reputations, quantities, DOM selection, cache, no external links and synchronized assets.');
