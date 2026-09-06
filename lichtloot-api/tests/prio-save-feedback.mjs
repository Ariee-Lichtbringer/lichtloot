import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../../',import.meta.url);
const extract=(s,n)=>{let a=s.indexOf('async function '+n+'(');return s.slice(a,s.indexOf('\n}\n',a)+2);};
for(const folder of ['loot','lichtloot-api/public/loot'])for(const raid of ['mc','bwl','aq40','naxx','zg','aq20','ony']){
 const s=fs.readFileSync(new URL(`${folder}/${raid}-loot.html`,root),'utf8');for(const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/ld\+json/.test(m[1]))new vm.Script(m[2]);
 assert.match(extract(s,'savePrio'),/getPrioSaveStatus/);
}
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
await page.setContent('<div hidden id="old"><div id="playerStatus"></div></div><div class="loot-save-area" style="display:flex"><button onclick="savePrio()">Prios speichern</button></div>'+['raidPin','playerName','playerServer','playerClass','p1','p2','p3'].map(id=>`<input id="${id}">`).join(''));
await page.evaluate(()=>{Object.assign(window,{PRIO_COUNT:3,SUPPORTS_P0PLUS:true,lichtlootSelectedCharacter:null,getSelectedPrioItemId:()=> '22637',eraRequiredPriorityKeys:()=>['p1','p2','p3'],safe:v=>v,currentRaidId:'raid',isP0DeadlineClosed:()=>false,loadPublishedPrios:async()=>{throw Error('Test: Verbindung unterbrochen');}});});
const source=fs.readFileSync(new URL('loot/zg-loot.html',root),'utf8');await page.addScriptTag({content:extract(source,'savePrio')});await page.addScriptTag({content:fs.readFileSync(new URL('loot/p0-selection-fix.js',root),'utf8')});
await page.locator('button').click();assert.match(await page.locator('#prioSaveStatus').innerText(),/Prio-PIN/);assert(await page.locator('#prioSaveStatus').isVisible());assert(await page.evaluate(()=>document.querySelector('#prioSaveStatus').previousElementSibling.classList.contains('loot-save-area')));
for(const [id,value]of Object.entries({raidPin:'TEST',playerName:'Juksi',playerServer:'Everlook',playerClass:'Paladin',p1:'Götze',p2:'Götze',p3:'Götze'}))await page.locator('#'+id).fill(value);
await page.locator('button').click();await page.waitForFunction(()=>document.querySelector('#prioSaveStatus').textContent.includes('Verbindung unterbrochen'));assert(await page.locator('#prioSaveStatus').isVisible());
await page.waitForFunction(()=>!document.querySelector('button').disabled);
await page.evaluate(()=>{window.loadPublishedPrios=()=>new Promise(()=>{});const original=window.setTimeout;window.setTimeout=(f,ms)=>original(f,ms===15000?25:ms);});await page.locator('button').click();await page.waitForFunction(()=>document.querySelector('#prioSaveStatus').textContent.includes('nicht rechtzeitig'));
await page.waitForFunction(()=>!document.querySelector('button').disabled);
await page.evaluate(()=>{Object.assign(window,{
 loadPublishedPrios:async()=>{},ensurePlayerPinForSave:async()=>({success:true,pin:'fixture',generated:false}),
 submitPrioWithPin:async(pin,old,selection)=>{window.capturedSelection=selection;return {success:true,p0Plus:false,prioId:'fixture'};},
 autoSaveDraft:()=>{},saveCharacterProfile:()=>{},updateLocalRaidleadData:()=>{},prioDraftSignature:JSON.stringify,
 refreshAfterPrioSave:async()=>{},currentPublishedPrios:[],samePrioCharacter:()=>false,sortPriosWithOwnFirst:v=>v,renderCurrentPrios:()=>{},p0WasClicked:true,
 });});
await page.locator('button').click();await page.waitForFunction(()=>document.querySelector('#prioSaveStatus').textContent.includes('wurden gespeichert'));
assert.equal(await page.evaluate(()=>capturedSelection.p0Selected),'ja');assert.equal(await page.evaluate(()=>currentPublishedPrios[0].P0Plus),'nein');
await browser.close();console.log('Save UI: seven pages parse, visible validation/errors outside collapsed character, rejected/hanging preflight reported and button restored.');
