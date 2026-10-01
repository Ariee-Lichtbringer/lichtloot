const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(){return {success:true,actor:{label:'Schatten',canManage:true,canSignup:true,canAdmin:true},guild:{name:'Krieger',slug:'test'},settings:{announcement:{title:'Waffen',message:'Schutz'}},layout:{},groups:[{id:'group1',name:'Heilig'}],characters:[{id:'char1',name:'Schatten',class_name:'paladin',role:'heal',ruleset:'normal'}],raids:[{id:'raid1',title:'Waffen',description:'Heilig',kind:'hyjal',starts_at:'2099-10-08T18:00:00Z',date:'2099-10-08',time:'20:00',size:20,tanks:2,heals:4,status:'open',signups:[],revision:1}],members:[],templates:[]};}
async function mount(lang){
 const dom=new JSDOM(read('forever-raids.html'),{url:'https://example.test/forever-raids.html?guild=test&lang='+lang,runScripts:'outside-only'}),w=dom.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.foreverClassIdentity=(row,info)=>row.append(info);w.foreverRaidArt=()=>w.document.createElement('img');
 w.fetch=async(url,opts)=>{const req=opts?.body?JSON.parse(opts.body):null;if(req)calls.push(req);return {ok:true,json:async()=>req?req.action==='overview'?fixture():{success:true,status:'bench'}:{guilds:[{slug:'test',name:'Krieger'}]}};};
 for(const f of ['guildloot-account-translations.js','guildloot-raid-translations.js','forever-i18n.js','forever-raids.js'])w.eval(read(f));
 await settle();const form=w.document.querySelector('#loginForm');form.elements.code.value='fixture-only';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();await settle();return {dom,w,calls};
}
test('English raid signup renders translated statuses and preserves user text and payload',async()=>{
 const {dom,w,calls}=await mount('en');const d=w.document;
 assert.equal(d.querySelector('#guildName').textContent,'Krieger');
 assert.equal(d.querySelector('#raid-raid1 h3').textContent,'Waffen');
 assert.equal(d.querySelector('#guildAnnouncement').textContent,'WaffenSchutz');
 assert.match(d.querySelector('#characterList').textContent,/SchattenPaladin · Healer/);
 const signup=[...d.querySelectorAll('#raid-raid1 button')].find(b=>b.textContent==='Sign up');assert.ok(signup);signup.click();await settle();
 const form=d.querySelector('#editorForm');assert.equal(d.querySelector('#editorTitle').textContent,'Your signup');
 assert.equal(form.elements.role.selectedOptions[0].text,'Healer');assert.equal(form.elements.characterId.value,'char1');
 form.elements.status.value='tentative';form.elements.note.value='Heilig';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();await settle();
 const posted=calls.find(x=>x.action==='signup');assert.equal(posted.status,'tentative');assert.equal(posted.role,'heal');assert.equal(posted.note,'Heilig');assert.equal(posted.characterId,'char1');
 assert.equal(d.querySelector('#notice').textContent,'This event is full. Your signup is on the bench.');dom.window.close();
});
test('German raid signup retains labels and API values',async()=>{
 const {dom,w}=await mount('de');const d=w.document;
 assert.equal(d.querySelector('#newRaid').textContent,'＋ Termin erstellen');
 const signup=[...d.querySelectorAll('#raid-raid1 button')].find(b=>b.textContent==='Anmelden');signup.click();await settle();
 assert.equal(d.querySelector('#editorTitle').textContent,'Deine Anmeldung');assert.equal(d.querySelector('[name="role"]').value,'heal');dom.window.close();
});
test('leadership login has accessible language controls and does not translate guild names',async()=>{
 const dom=new JSDOM(read('forever-leitung.html'),{url:'https://example.test/forever-leitung.html?lang=en',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.fetch=async()=>({ok:true,json:async()=>({guilds:[{slug:'test',name:'Schutz'}]})});
 w.eval(read('forever-leitung.js'));
 for(const f of ['guildloot-account-translations.js','guildloot-raid-translations.js','forever-i18n.js'])w.eval(read(f));
 await settle();
 assert.equal(w.document.querySelector('#login').open,true);
 assert.equal(w.document.querySelector('#leadLoginTitle').textContent,'Guild leadership login');
 assert.equal(w.document.querySelectorAll('#login .forever-language button').length,2);
 assert.equal(w.document.querySelector('#guildSelect option[value="test"]').textContent,'Schutz');
 dom.window.close();
});
test('Era translation is scoped to entry/navigation and leaves raid content intact',()=>{
 const dom=new JSDOM('<main><header class="start-header">Raidübersicht</header><section id="user-content">Krieger</section><span data-guild-brand class="start-sidebar">Schutz</span></main>',{url:'https://example.test/start.html?lang=en',runScripts:'outside-only'}),w=dom.window;
 for(const f of ['guildloot-era-language.js','guildloot-account-translations.js','guildloot-raid-translations.js','forever-i18n.js'])w.eval(read(f));
 assert.equal(w.document.querySelector('header').textContent,'Raid overview');
 assert.equal(w.document.querySelector('#user-content').textContent,'Krieger');
 assert.equal(w.document.querySelector('[data-guild-brand]').textContent,'Schutz');dom.window.close();
});
