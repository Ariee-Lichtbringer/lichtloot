// Run with jsdom available on NODE_PATH: node --test tests/account-i18n.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function page(name,lang='en'){
 const dom=new JSDOM(read(name),{url:'https://example.test/'+name+'?guild=example&lang='+lang,runScripts:'outside-only'});
 dom.window.eval(read('guildloot-account-translations.js'));
 dom.window.eval(read('forever-i18n.js'));
 return dom;
}
test('English recovery and registration preserve server security-question values',()=>{
 for(const name of ['forever-start.html','forever-register.html']){
 const dom=page(name),{document,FormData}=dom.window;
 const select=document.querySelector('select[name="question"],select[name="securityQuestion"]');
 select.selectedIndex=1;
 assert.equal(select.options[1].text,'What was the name of your first pet?');
 assert.equal(new FormData(select.form).get(select.name),'Wie hieß dein erstes Haustier?');
 assert.equal(document.documentElement.lang,'en');
 assert.equal(document.querySelectorAll('.forever-language').length,1);
 dom.window.close();
 }
});
test('class and spec icons stay attached to canonical signup values',async()=>{
 const dom=page('forever-start.html'),w=dom.window;
 w.requestAnimationFrame=fn=>fn();
 w.eval(read('forever-beta-picker.js'));
 const paladin=w.document.querySelector('[name="className"][value="paladin"]');
 paladin.checked=true;paladin.dispatchEvent(new w.Event('change'));
 await new Promise(resolve=>setImmediate(resolve));
 const holy=w.document.querySelector('[name="specialization"][value="Heilig"]');
 assert.equal(holy.getAttribute('aria-label'),'Holy · Healer');
 assert.ok(holy.parentElement.querySelector('img').src.includes('spell_holy_holybolt'));
 holy.checked=true;holy.dispatchEvent(new w.Event('change'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.document.querySelector('#betaSpecValue').textContent,'Holy · Healer');
 const data=new w.FormData(w.document.querySelector('#betaLoginForm'));
 assert.equal(data.get('specialization'),'Heilig');assert.equal(data.get('role'),'heal');
 assert.equal(data.get('className'),'paladin');
 dom.window.close();
});
test('German stays German; URL preference survives navigation',()=>{
 const dom=page('forever-start.html','de');
 assert.equal(dom.window.document.querySelector('#betaTitle').textContent,'Beta-Login');
 assert.equal(dom.window.localStorage.getItem('guildloot_forever_language'),'de');
 dom.window.close();
 const en=page('forever-import.html');
 assert.equal(en.window.document.querySelector('h1').textContent,'Import existing account');
 assert.equal(en.window.localStorage.getItem('guildloot_forever_language'),'en');
 en.window.history.replaceState(null,'','/forever-register.html');
 en.window.document.querySelector('.forever-language').remove();
 en.window.eval(read('forever-i18n.js'));
 assert.equal(en.window.ForeverI18n.lang,'en');en.window.close();
});
test('dynamic messages translate without translating guild names',async()=>{
 const dom=page('forever-start.html'),w=dom.window;
 const name=w.document.querySelector('#guildName');name.textContent='Krieger';
 const guild=new w.Option('Schatten','shadow');guild.className='guild-name';w.document.querySelector('#guildSelect').append(guild);
 const notice=w.document.querySelector('#notice');notice.textContent='Login-Code geändert. Melde dich mit deinem neuen Code an.';
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(name.textContent,'Krieger');assert.equal(guild.textContent,'Schatten');
 assert.equal(notice.textContent,'Login code changed. Log in with your new code.');dom.window.close();
});
