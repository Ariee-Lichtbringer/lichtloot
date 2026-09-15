const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../src/server.js'),'utf8');
const start=source.indexOf('async function legacyAppsScript('),end=source.indexOf('\napp.get("/api/apps-script", legacyAppsScript)',start);
const postStart=source.indexOf('app.post("/api/apps-script", async '),postEnd=source.indexOf('\napp.get(',postStart);
const routes={};let writes=0;
const ctx=vm.createContext({app:{post:(route,fn)=>routes[route]=fn},clean:v=>String(v||'').trim(),listGuilds:async()=>({success:true,guilds:[]}),loadMasterCodeOverrides:async()=>{},requireGuild:async slug=>({id:'guild-id',slug}),resolveGuildSlug:v=>v||'lichtloot',requireMatchingGuildId:()=>{},loadWorldbuffAccessCode:async()=>{},loadLootMasterAccessCode:async()=>{},requireMasterCodeForGuild:(guild,code)=>{if(code!=='allowed')throw Object.assign(Error('Forbidden'),{statusCode:403});},requireMasterCode:code=>{if(code!=='allowed')throw Object.assign(Error('Forbidden'),{statusCode:403});},createGuild:async()=>{writes++;return {success:true};},getCharactersByPin:async(guild,pin)=>pin==='TEST1234'?[{name:'Test'}]:[]});
vm.runInContext(source.slice(start,end)+'\n'+source.slice(postStart,postEnd),ctx);
async function call(body){let result;const res={json:r=>result=r,status:()=>res,set:()=>res};await routes['/api/apps-script']({body,query:{}},res,e=>{throw e});return result;}
(async()=>{
 assert.equal((await call({__transport:'get',action:'listGuilds'})).success,true);
 assert.equal((await call({__transport:'get',action:'getCharactersByPin',pin:'TEST1234',guild:'test'})).characters[0].name,'Test');
 await assert.rejects(()=>call({__transport:'get',action:'createGuild',masterCode:'invalid'}),e=>e.statusCode===403);assert.equal(writes,0);
 await assert.rejects(()=>call({__transport:'get',action:'getCharactersByPin',pin:'TEST1234',masterCode:'invalid'}),e=>e.statusCode===403);
 assert.equal((await call({__transport:'get',action:'createGuild',masterCode:'allowed'})).success,true);assert.equal(writes,1);
 console.log('PASS actual POST dispatch keeps legacy read results and master-code authorization');
})().catch(e=>{console.error(e);process.exit(1)});
