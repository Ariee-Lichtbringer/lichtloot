import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createForeverRaids,installForeverRaids} from '../src/forever-raids.js';
import {createForeverAccess} from '../src/forever-db.js';
import {installForeverRegistration} from '../src/forever-registration.js';
import {createForeverDiscord} from '../src/forever-discord.js';
import {hashSecurityAnswer} from '../src/auth-security.js';
const {PGlite}=await import(process.env.FOREVER_PGLITE||'@electric-sql/pglite');const db=new PGlite();await db.exec(await readFile(new URL('../src/forever-core.sql',import.meta.url),'utf8'));
const query=(sql,p=[])=>p.length?db.query(sql,p):db.exec(sql).then(r=>r.at(-1));const pool={connect:async()=>({query,release(){}})},access=createForeverAccess(query),handlers=new Map();
const app={post:(url,fn)=>handlers.set(url,fn)};const deps={pool,query,...access,explicitGuild:s=>s,rateLimit(){},requireForeverGuild:async g=>access.requireGuild(g.slug),hashSecurityAnswer};installForeverRaids(app,deps);installForeverRegistration(app,deps);
const id=randomUUID();await query('insert into guilds(id,slug,name) values($1,$2,$3)',[id,'journey','Testgilde']);await query('insert into guild_settings(guild_id,layout_json) values($1,$2)',[id,JSON.stringify({game:'forever'})]);await query("insert into guild_master_codes(guild_id,master_code) values($1,'TESTMASTER123')",[id]);
const root=new URL('../public/',import.meta.url).pathname;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/apps-script'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await access.listGuilds()));return;}if(handlers.has(u.pathname)){let raw='';for await(const chunk of req)raw+=chunk;const request={body:JSON.parse(raw||'{}')},response={set:(k,v)=>res.setHeader(k,v),json:d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));}};await handlers.get(u.pathname)(request,response,e=>{res.statusCode=e.statusCode||500;response.json({success:false,error:e.message});});return;}const f=path.join(root,u.pathname);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch(e){res.statusCode=500;res.end(e.message);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
async function post(endpoint,body){const r=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {...await r.json(),httpStatus:r.status};}
const lead=(action,extra={})=>post('/api/forever',{guild:'journey',masterCode:'TESTMASTER123',action,...extra}),member=(action,extra={})=>post('/api/forever',{guild:'journey',playerPin:'PLAYER123',action,...extra});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
try{
 const reg=await post('/api/forever/register',{guild:'journey',firstName:'Test',lastName:'Spieler',playerPin:'PLAYER123',className:'priest',role:'heal',ruleset:'normal',securityQuestion:'Testfrage?',securityAnswer:'Testantwort'});assert.equal(reg.pending,true);assert.equal((await member('overview')).httpStatus,403);
 await page.goto(base+'/forever-leitung.html?guild=journey#spieler');await page.locator('#guildSelect').selectOption('journey');await page.locator('#loginForm [name=code]').fill('TESTMASTER123');await page.locator('#loginForm button[type=submit]').click();await page.getByRole('button',{name:'Freigeben',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#players').textContent.includes('Freigegeben'));
 const overview=await member('overview');assert.equal(overview.httpStatus,200);const characterId=overview.characters[0].id;
 const raid=await lead('saveRaid',{title:'Beta-Testraid',kind:'hyjal',date:'2099-01-01',time:'20:00',size:20,tanks:2,heals:4});assert.equal(raid.httpStatus,200);assert.equal((await member('signup',{raidId:raid.id,characterId,role:'heal',status:'signed'})).httpStatus,200);
 await lead('lootItemSave',{kind:'hyjal',itemId:271095,name:'Testloot',p0:true});assert.equal((await member('prioritySave',{raidId:raid.id,characterId,priorities:[{priority:1,itemId:271095}]})).httpStatus,200);
 await lead('attendance',{raidId:raid.id,characterId,attendance:'present'});assert.equal((await lead('lootAward',{raidId:raid.id,characterId,itemId:271095,reason:'Testvergabe',requestKey:randomUUID()})).httpStatus,200);
 const bot=createForeverDiscord({pool,query,access,raids:createForeverRaids({pool,query})});await bot.run({action:'configure',guild:'journey',masterCode:'TESTMASTER123',discordGuildId:'111111111111111111',channelId:'222222222222222222'});
 await page.locator('nav a[href="#uebersicht"]').click();await page.locator('#refresh').click();await page.locator('nav a[href="#discord"]').click();await page.getByRole('button',{name:'Testnachricht in den verbundenen Kanal senden',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#discordSetup').textContent.includes('Prüfung läuft'));
 const job=(await bot.run({action:'diagnosticsPoll'})).jobs[0];await bot.run({action:'diagnosticsAck',id:job.id,leaseToken:job.lease_token,result:{bot:true,server:true,channel:true,permissions:true,testSent:true,messageId:'333333333333333333'}});
 await page.getByRole('button',{name:'Prüfstatus aktualisieren'}).click();await page.waitForFunction(()=>document.querySelector('#discordSetup').textContent.includes('erfolgreich gesendet'));
 await page.screenshot({path:'/tmp/forever-beta-discord.png'});
 await page.locator('nav a[href="#nachrichten"]').click();await page.locator('#nachrichten input').fill('Unser Raid');await page.locator('#nachrichten textarea').fill('Bitte anmelden.');await page.getByRole('button',{name:'Mitteilung veröffentlichen'}).click();await page.waitForFunction(()=>document.querySelector('#nachrichten').textContent.includes('auf der Gildenseite veröffentlicht'));
 assert.equal((await member('overview')).settings.announcement.title,'Unser Raid');await page.locator('nav a[href="#spieleranalyse"]').click();await page.waitForSelector('#spieleranalyse td');assert.ok((await page.locator('#spieleranalyse').textContent()).includes('Test Spieler'));


 // Walk every local leadership menu destination and detect broken panels/scripts.
 const destinations=await page.locator('aside nav a[href^="#"]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.hash))]);
 for(const hash of destinations){await page.evaluate(h=>{location.hash=h},hash);await page.waitForTimeout(40);assert.ok(await page.locator('#workspace').isVisible());}
 // Exercise actual standalone pages with a member session and save through the UI.
 await page.evaluate(()=>sessionStorage.setItem('guildloot:forever:journey:session',JSON.stringify({guild:'journey',mode:'player',code:'PLAYER123'})));
 await page.goto(base+'/forever-hyjal.html?guild=journey&raid='+raid.id);
 await page.getByRole('button',{name:'Testloot als P2',exact:true}).click();
 await page.getByRole('button',{name:'Prios speichern',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.prio-save-status')?.textContent==='Prioritäten gespeichert.');
 assert.equal((await member('lootOverview',{kind:'hyjal',raidId:raid.id})).priorities[0].priority,2);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/forever-hyjal-era.png',fullPage:true});
 await page.goto(base+'/forever-barrow.html?guild=journey');await page.getByRole('heading',{name:'Barrow Deeps – Prio-Auswahl'}).waitFor();
 await page.goto(base+'/forever-onyxia.html?guild=journey');await page.getByRole('heading',{name:'Onyxias Hort – Prio-Auswahl'}).waitFor();
 await page.evaluate(()=>sessionStorage.setItem('guildloot:forever:journey:session',JSON.stringify({guild:'journey',mode:'lead',code:'TESTMASTER123'})));
 await page.goto(base+'/forever-pluendermeister.html?guild=journey&raid='+raid.id);
 await page.getByRole('heading',{name:'Beta-Testraid · Raidlead Panel'}).waitFor();
 await page.getByRole('button',{name:'Lootvergabe protokollieren',exact:true}).waitFor();
 await page.screenshot({path:'/tmp/forever-pluendermeister-era.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>sessionStorage.clear());await page.goto(base+'/forever-hyjal.html?guild=journey');await page.locator('#loginForm [name=code]').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('PASS: HTTP + browser journey: separate test guild, mandatory PIN, registration, approval, raid, signup, priority, attendance, loot, Discord queue result, bulletin and participation analysis. No external messages sent.');
}finally{await browser.close();server.close();await db.close();}
