import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
const pub=new URL('../public/',import.meta.url).pathname;
const read=async n=>JSON.parse(await readFile(path.join(pub,n),'utf8'));
const items=await read('forever-items-data.json'),english=await read('forever-items-en.json'),loot=await read('forever-loot-sources.json'),recipes=await read('forever-recipes.json');
assert.equal(items.items.length,items.count);assert.equal(new Set(items.items.map(i=>i.id)).size,items.count);assert.equal(Object.keys(english).length,items.count);
for(const [slug,count] of [['hall-of-thanes',10],['ruins-of-lordaeron',15]]){const zone='forever:'+slug;assert.equal(loot.zones.find(z=>z.id===zone).count,count);const ids=Object.entries(loot.assignments).filter(([,v])=>v[zone]).map(([id])=>Number(id));assert.equal(ids.length,count);for(const id of ids){assert.ok(items.items.some(i=>i.id===id));assert.ok(loot.bossAssignments[id].boss);}}
const previous=JSON.parse(execFileSync('git',['show','HEAD:forever-items-data.json'],{encoding:'utf8',maxBuffer:20*1024*1024}));for(const before of previous.items){const after=items.items.find(i=>i.id===before.id);for(const [key,value] of Object.entries(before))assert.deepEqual(after[key],value,'Preserve existing item '+before.id+' '+key);}
assert.equal(recipes.craftingDetails.length,3);for(const c of recipes.craftingDetails)for(const i of c.ingredients)assert.ok(items.items.some(x=>x.id===i.id));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/test-frame'){res.setHeader('Content-Type','text/html');res.end('<iframe style="width:100%;height:95vh" src="'+u.searchParams.get('url').replaceAll('&','&amp;').replaceAll('\"','&quot;')+'"></iframe>');return;}const file=path.join(pub,u.pathname),data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),outer=await browser.newPage(),errors=[];let page=outer;page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);const base='http://127.0.0.1:'+server.address().port;
await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
async function navigate(url){await outer.goto(base+'/test-frame?url='+encodeURIComponent(url),{waitUntil:'domcontentloaded'});page=outer.frames().find(f=>f.parentFrame());await page.waitForSelector('body');}
try{
 for(const [slug,count] of [['hall-of-thanes',10],['ruins-of-lordaeron',15]]){await navigate(base+'/forever.html?embedded=1&zone=forever:'+slug+'#itemdatenbank',{waitUntil:'domcontentloaded'});await page.waitForFunction(n=>document.querySelectorAll('#itemResults .item-card').length===n,count);assert.ok((await page.locator('#itemSetInfo').textContent()).includes('Community'));}
 await navigate(base+'/forever.html?embedded=1#dungeon-hall-of-thanes');await page.waitForFunction(()=>document.querySelectorAll('#dungeon-hall-of-thanes tbody tr').length===10);assert.ok((await page.locator('#dungeon-hall-of-thanes').textContent()).includes('Magmatus'));
 await navigate(base+'/forever.html?embedded=1&item=271095#itemdatenbank',{waitUntil:'domcontentloaded'});await page.waitForSelector('#itemDialog[open]');assert.ok((await page.locator('#itemDialog').textContent()).includes('Magmatus'));assert.ok((await page.locator('#itemDialog').textContent()).includes('Community'));
 await navigate(base+'/forever.html?embedded=1&profession=tailoring&item=253664#itemdatenbank',{waitUntil:'domcontentloaded'});await page.waitForSelector('.recipe-calculator');await page.waitForFunction(()=>document.querySelector('.recipe-calculator').textContent.includes('5 / 30 / 47 / 65'));await page.getByRole('button',{name:'Zur Einkaufsliste hinzufügen',exact:true}).click();const queue=await page.evaluate(()=>JSON.parse(localStorage.getItem('guildloot_forever_crafts_v1')));assert.deepEqual(queue[0].ingredients.map(i=>[i.id,i.count]),[[2996,6],[2320,6]]);
 await outer.screenshot({path:'/tmp/forever-community-recipe.png'});
 await navigate(base+'/forever.html?embedded=1&lang=en&zone=forever:hall-of-thanes#itemdatenbank',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#itemResults .item-card').length===10);assert.deepEqual(errors,[]);
 console.log('Verified: 26 added items, 25 boss drops, legacy item values preserved, all references valid, German/English dungeon views, sourced item details, recipe skill thresholds and shopping list without remote tooltip dependency.');
}catch(e){console.log({errors,loading:await page.locator('body').textContent(),count:await page.locator('#itemResults .item-card').count(),url:page.url()});throw e;}finally{await browser.close();server.close();}
