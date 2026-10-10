import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const extract = (text, name, async = true) => {
  const start = text.indexOf(`${async ? 'async ' : ''}function ${name}(`);
  assert(start >= 0, name);
  return text.slice(start, text.indexOf('\n}', start) + 2);
};
const db = new PGlite();
await db.exec(`
 create table players(id text primary key default gen_random_uuid()::text, guild_id text, player_pin text,
 security_question text, security_answer text, approval_status text default 'approved', is_blocked boolean default false,
 created_at timestamptz default now(), updated_at timestamptz default now(), unique(guild_id,player_pin));
 create table characters(id text primary key default gen_random_uuid()::text, player_id text, name text, server text,
 class_name text, is_main boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
 insert into players(id,guild_id,player_pin) values ('source','other','PIN'),('target','light','PIN');
 insert into characters(player_id,name,server,is_main) values
 ('source','Bierschützer','Lakeshire',true),('source','Brasok','Lakeshire',false),
 ('target','Brasok','Lakeshire',true);
`);
const query = (sql, args) => db.query(sql, args);
const context = vm.createContext({
 query, pool: {connect: async () => ({query, release(){}})},
 clean: v => String(v ?? '').trim(), normalizePin: v => String(v ?? '').trim(), normalizeCharacter: v => v,
 findPlayerByPin: async (guild, pin) => (await query('select * from players where guild_id=$1 and player_pin=$2', [guild,pin])).rows[0]
});
vm.runInContext(extract(source,'ensureCrossGuildPlayerLogin') + '\n' + extract(source,'setMainCharacter'),context);
const mains = async player => (await query('select name from characters where player_id=$1 and is_main order by name',[player])).rows.map(r=>r.name);
await context.ensureCrossGuildPlayerLogin('light','PIN');
assert.deepEqual(await mains('target'),['Brasok']);
assert.equal((await query("select count(*)::int as n from characters where player_id='target'")).rows[0].n,2);
await context.ensureCrossGuildPlayerLogin('light','PIN');
assert.deepEqual(await mains('target'),['Brasok']);
await query("update characters set is_main=true where player_id='source'");
await context.ensureCrossGuildPlayerLogin('new','PIN');
const newPlayer = (await query("select id from players where guild_id='new'")).rows[0].id;
assert.equal((await mains(newPlayer)).length,1, 'legacy duplicate source mains must not be imported');
await query("update characters set is_main=true where player_id='target'");
await context.setMainCharacter({guildId:'light',pin:'PIN',charName:' brasok ',server:'lakeshire'});
assert.deepEqual(await mains('target'),['Brasok']);
assert.equal((await mains('source')).length,2,'other guild remains unchanged');
await assert.rejects(context.setMainCharacter({guildId:'light',pin:'PIN',charName:'Unknown',server:'Lakeshire'}),e=>e.statusCode===404);
assert.deepEqual(await mains('target'),['Brasok'],'invalid target rolls back clearing main');
await context.setMainCharacter({guildId:'light',pin:'PIN',charName:'Bierschützer',server:'Lakeshire'});
assert.deepEqual(await mains('target'),['Bierschützer']);
await db.close();
console.log('PASS: cross-guild imports, repeat load, legacy duplicate source, main switch, guild isolation and rollback');
for (const file of ['../../start.html','../public/start.html','../src/start.html']) {
 const html=fs.readFileSync(new URL(file,import.meta.url),'utf8');
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
 let calls=0, refreshed=0;
 const status={innerHTML:''};
 const browser=vm.createContext({normalizePlayerLoginRole:v=>v,document:{getElementById:()=>status},
 syncHiddenPinFromDashboard:()=> 'PIN',safeHtml:v=>v,CURRENT_GUILD_SLUG:'light',LICHTLOOT_API_URL:'https://example.test/',
 URLSearchParams, fetch:async()=>{calls++;return {json:async()=>({success:true})}},
 loadLichtLootCharacters:async()=>{refreshed++},copyHiddenLichtLootToDashboard:()=>{},console});
 vm.runInContext(extract(html,'normalizeLichtlootCharEntry',false)+'\n'+extract(html,'getMainLichtLootCharacter',false)+'\n'+extract(html,'setSelectedMainCharacter'),browser);
 const normalize=browser.normalizeLichtlootCharEntry;
 assert.equal(normalize({name:'Old',isMain:false,Main:true,mainChar:'Old'}).isMain,false);
 assert.equal(normalize({name:'Old',isMain:'false'}).isMain,false);
 assert.equal(normalize({name:'Main',mainChar:'Main'}).isMain,true);
 browser.myLichtlootCharacters=[normalize({name:'Old',isMain:false,mainChar:'Old'}),normalize({name:'Brasok',isMain:true})];
 assert.equal(browser.getMainLichtLootCharacter().name,'Brasok');
 browser.myLichtlootCharacters[0].isMain=true;
 browser.getSelectedLichtLootCharacter=()=>browser.myLichtlootCharacters[1];
 await browser.setSelectedMainCharacter();
 assert.equal(calls,1,'duplicate main state allows saving selected main');assert.equal(refreshed,1);
 browser.myLichtlootCharacters[0].isMain=false;
 await browser.setSelectedMainCharacter();assert.equal(calls,1,'single current main remains a no-op');
 // Exercise the actual sorting callback used when rebuilding the picker.
 const sort=html.match(/chars\.sort\((\(a,b\)=>\{[\s\S]*?\n    \})\);/)[1];
 const chars=browser.myLichtlootCharacters.slice();chars.sort(vm.runInContext('('+sort+')',browser));
 assert.equal(chars[0].name,'Brasok');
 console.log('PASS: main flag normalization, duplicate repair, main-first sorting and script syntax:',file);
}
