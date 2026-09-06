// Opt-in, read-only browser check. Keep the credential fixture outside the repository.
import fs from 'node:fs';
import assert from 'node:assert/strict';
if(!process.env.GUILDLOOT_SMOKE_FIXTURES){console.log('SKIP live smoke: set GUILDLOOT_SMOKE_FIXTURES to a private fixture file.');process.exit(0);}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixtures=JSON.parse(fs.readFileSync(process.env.GUILDLOOT_SMOKE_FIXTURES,'utf8'));
const base=process.env.GUILDLOOT_SMOKE_BASE||'https://lichtloot.de';
const browser=await chromium.launch({headless:true});const results=[];
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{const slug=new URLSearchParams(location.search).get('guild');if(slug){sessionStorage.setItem(`lichtloot:${slug}:raidlead:active`,'true');sessionStorage.setItem(`lichtloot:${slug}:raidlead:role`,'raidlead');}});
 const page=await context.newPage();let currentGuild=null;
 if(process.env.GUILDLOOT_SMOKE_PAGE){
  const html=fs.readFileSync(process.env.GUILDLOOT_SMOKE_PAGE,'utf8');
  await page.route('**/raidlead-panel.html?*',route=>route.fulfill({contentType:'text/html',body:html}));
 }
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 for(const fixture of fixtures){
  const started=Date.now();const beforeErrors=errors.length;
  try{
   if(currentGuild!==fixture.slug){await page.goto(`${base}/raidlead-panel.html?guild=${encodeURIComponent(fixture.slug)}`,{waitUntil:'domcontentloaded'});currentGuild=fixture.slug;}
   await page.locator('#raidPinInput').fill(fixture.leadPin);
   await page.locator('button[onclick="loadRaidByPin()"]').click();
   await page.waitForFunction(()=>document.querySelector('#controlStatus')?.textContent.includes('Raid geladen.'),null,{timeout:15000});
   const state=await page.evaluate(()=>({raidId:currentRaidData?.raidId,raid:currentRaidKey,count:currentPrios.length,visible:!document.querySelector('#raidView').classList.contains('hidden')}));
   assert.equal(state.raidId,fixture.raidId,'Wrong raid displayed after entering LeadPIN');assert.equal(state.raid,fixture.type);assert(state.visible);assert.equal(errors.length,beforeErrors,'Uncaught page error');
   results.push({guild:fixture.slug,raid:fixture.type,status:'PASS',entries:state.count,ms:Date.now()-started});
  }catch(error){results.push({guild:fixture.slug,raid:fixture.type,status:'FAIL',error:error.message.split('\n')[0],ms:Date.now()-started});}
  console.log(JSON.stringify(results.at(-1)));
 }
 const report=process.env.GUILDLOOT_SMOKE_REPORT;if(report)fs.writeFileSync(report,JSON.stringify(results,null,2));
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
}finally{await browser.close();}
