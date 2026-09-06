import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const artifacts=process.env.CLOSEOUT_ARTIFACTS||tmpdir();
for(const file of ['gildenleitung.html','raidlead-panel.html','lichtloot-api/public/gildenleitung.html','lichtloot-api/public/raidlead-panel.html']){
 const source=await readFile(root+'/'+file,'utf8');
 for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/ld\+json/.test(m[1]))new vm.Script(m[2],{filename:file});
}
for(const file of ['raid-closeout.js','raid-closeout.css','gildenleitung.html','raidlead-panel.html'])assert.equal(await readFile(root+'/'+file,'utf8'),await readFile(root+'/lichtloot-api/public/'+file,'utf8'));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const calls=[];let applied=false,stale=false;
const plan={success:true,raid:{name:'ZG PRIME',date:'2026-09-05',time:'22:00'},status:'attention',checkedAt:new Date().toISOString(),canApply:true,counts:{missingFlags:1,missingPoints:1,duplicates:1,reminders:1},reviewToken:'a'.repeat(64),findings:[
 {kind:'missing_flag',title:'P0+-Kennzeichen fehlt',detail:'Cardiothorac · Urzeitlicher Hakkarigötze ist als P0 ohne Plus gespeichert.',before:'P0',after:'P0+',actionId:'flag:1'},
 {kind:'missing_points',title:'P0+-Übertragung fehlt',detail:'Cardiothorac · Urzeitlicher Hakkarigötze: Für diesen Raid ist keine Punktebuchung vorhanden.',before:2,after:3,attendance:'angemeldet',actionId:'points:1'},
 {kind:'duplicate_points',title:'Mehrere Punktebuchungen prüfen',detail:'Beispielspieler: 2 Transferbuchungen für denselben Raid.',entries:[{item:'Das Auge von Hakkar',points:1},{item:'Das Auge von Hakkar',points:1}]},
 {kind:'stale_reminder',title:'Veraltete Erinnerung wartet',detail:'Eine Erinnerung vom 2026-09-05 ist noch offen.',before:'Wartend',after:'Erledigt',actionId:'reminder:1'}],actions:[{id:'flag:1',type:'flag',label:'Cardiothorac: P0 → P0+',points:0},{id:'points:1',type:'points',label:'Cardiothorac: 2 → 3 Punkte',points:1},{id:'reminder:1',type:'reminder',label:'Veraltete Erinnerung als erledigt markieren',points:0}]};
await page.route('https://closeout.test/**',route=>{const req=route.request();if(req.method()==='GET')return route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#060b16;padding:16px"><div id="host"></div></body></html>'});const data=req.postDataJSON();calls.push(data);assert.equal(data.guild,'nachtloot');assert.equal(data.raidId,'raid1');if(data.action==='applyRaidCloseout'){if(stale)return route.fulfill({status:409,json:{success:false,error:'Prios oder Punktestände haben sich geändert.'}});applied=true;return route.fulfill({json:{success:true,applied:data.actionIds.length,points:1}});}return route.fulfill({json:applied?{...plan,status:'clear',counts:{missingFlags:0,missingPoints:0,duplicates:0,reminders:0},findings:[],actions:[]}:plan});});
await page.goto('https://closeout.test/');await page.addStyleTag({path:root+'/raid-closeout.css'});await page.addScriptTag({path:root+'/raid-closeout.js'});
const mount=()=>page.evaluate(()=>GuildLootCloseout.mount(document.querySelector('#host'),{api:'https://closeout.test/api',guild:'nachtloot',raidId:'raid1',credentials:()=>({leadPin:'fixture'})}));
await mount();await page.locator('[data-action]').first().waitFor();assert.equal(calls.filter(c=>c.action==='applyRaidCloseout').length,0);
await page.screenshot({path:artifacts+'/raid-closeout-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:artifacts+'/raid-closeout-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.locator('[data-action="points:1"]').check();await page.locator('[data-preview]').click();await page.locator('[data-confirm]').click();assert.equal(calls.filter(c=>c.action==='applyRaidCloseout').length,0);assert.match(await page.locator('.glc-status').innerText(),/Teilnahme/);
await page.locator('[data-attendance]').check();await page.locator('[data-confirm]').click();assert.equal(calls.filter(c=>c.action==='applyRaidCloseout').length,0);await page.locator('[data-code]').fill('fixture-master');await page.locator('[data-confirm]').click();await page.locator('.glc-clear').waitFor();assert.equal(calls.filter(c=>c.action==='applyRaidCloseout').length,1);assert.deepEqual(calls.find(c=>c.action==='applyRaidCloseout').actionIds,['points:1']);
applied=false;stale=true;await mount();await page.locator('[data-action="flag:1"]').check();await page.locator('[data-preview]').click();await page.locator('[data-code]').fill('fixture-master');await page.locator('[data-confirm]').click();await page.getByText(/Bitte vor einem weiteren Versuch neu prüfen/).waitFor();assert.equal(await page.locator('[data-action]').count(),0);
plan.findings[0].detail='<img src=x onerror="window.pwned=true">';await page.locator('[data-reload]').click();await page.locator('[data-action]').first().waitFor();assert.equal(await page.locator('#host img').count(),0);assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.deepEqual(errors,[]);
await browser.close();console.log('UI: HTML syntax and identical public copies, desktop/mobile layout, read-only mount, explicit preview, attendance/password guards, exact actions, stale retry and escaped text passed.');
