import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import http from 'node:http';
import path from 'node:path';
const root=new URL('../public/',import.meta.url).pathname;
const read=async n=>JSON.parse(await readFile(path.join(root,n),'utf8'));
const talents=await read('forever-talents-data.json'),recipes=await read('forever-crafting-data.json');
assert.equal(talents.classes.length,9);assert.equal(talents.classes.flatMap(c=>c.trees.flatMap(t=>t.talents)).length,469);
for(const c of talents.classes)for(const tree of c.trees){assert.equal(new Set(tree.talents.map(t=>t.row+':'+t.col)).size,tree.talents.length);for(const t of tree.talents){assert.equal(t.maxRank,t.ranks.length);for(const req of t.requires)assert.ok(tree.talents.some(p=>p.id===req.id));}}
assert.equal(recipes.recipes.length,2178);assert.equal(recipes.recipes.filter(r=>r.learnSource==='trainer').length,438);assert.equal(new Set(recipes.recipes.map(r=>r.profession+':'+r.spellId)).size,recipes.recipes.length);
for(const r of recipes.recipes)for(const i of r.ingredients){assert.ok(Number.isInteger(i.id)&&i.id>0);assert.ok(Number.isInteger(i.count)&&i.count>0);}
const context={};vm.runInNewContext(await readFile(path.join(root,'forever-talents.js'),'utf8'),context);const engine=context.ForeverTalentEngine;
const old={trees:[{talents:[{id:1,name:'First',row:0,col:0,maxRank:5,requires:[],ranks:[{spellId:10}]},{id:2,name:'Second',row:0,col:1,maxRank:5,requires:[],ranks:[{spellId:20}]}]}]};
const current={trees:[{talents:[{...old.trees[0].talents[1],id:22,col:0},{...old.trees[0].talents[0],id:11,col:1}]}]};
assert.equal(engine.migrate(old,current,'3'),'03');assert.throws(()=>engine.migrate(old,{trees:[{talents:[current.trees[0].talents[0]]}]},'3'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/frame'){res.setHeader('Content-Type','text/html');res.end('<iframe style="width:100%;height:95vh" src="'+u.searchParams.get('url').replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></iframe>');return;}const f=path.join(root,u.pathname);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),outer=await browser.newPage(),errors=[];outer.on('pageerror',e=>errors.push(e.message));await outer.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
async function open(hash){await outer.goto(base+'/frame?url='+encodeURIComponent(base+'/forever.html?embedded=1'+hash));return outer.frames().find(f=>f.parentFrame());}
try{
 let page=await open('#berufe');await page.waitForFunction(()=>document.querySelector('#betaCraftingBook')?.textContent.includes('2178'));
 await page.locator('#betaRecipeSearch').fill("Minor Mender");await page.locator('#betaCraftingBook details summary').first().click();await page.getByRole('button',{name:'Zur Einkaufsliste hinzufügen',exact:true}).click();let queue=await page.evaluate(()=>JSON.parse(localStorage.getItem('guildloot_forever_crafts_v1')));assert.equal(queue[0].id,-1251741);assert.deepEqual(queue[0].ingredients.map(x=>[x.id,x.count]),[[785,2],[2453,1],[3371,1]]);
 await outer.screenshot({path:'/tmp/forever-beta-recipes.png'});
 page=await open('#talente');await page.waitForSelector('.talent-node');assert.equal(await page.locator('.talent-class-card').count(),9);assert.ok(page.url().includes('talentVersion=1.60.1.69977'));await page.locator('.talent-class-card[data-class=warrior]').click();assert.equal(await page.locator('.talent-node').count(),53);
 page=await open('#faehigkeiten');await page.waitForSelector('#abilityCards .character-card');assert.ok((await page.locator('#faehigkeiten').textContent()).includes('1.60.1.69977'));
 assert.deepEqual(errors,[]);console.log('PASS: recipe search/material queue, current talent UI, legacy migration, class spellbook and sourced data invariants.');
}finally{await browser.close();server.close();}
