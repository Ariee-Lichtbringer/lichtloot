const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
for(const raid of ['mc','bwl','aq40','aq20','naxx','ony','zg']){
 const html=fs.readFileSync(path.join(root,'loot',raid+'-loot.html'),'utf8');
 assert.equal(html,fs.readFileSync(path.join(root,'lichtloot-api/public/loot',raid+'-loot.html'),'utf8'));
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=|application\/ld\+json|application\/json/.test(match[1]))new vm.Script(match[2],{filename:raid});
 const slice=(a,b,last=false)=>{const start=last?html.lastIndexOf(a):html.indexOf(a);assert(start>=0);return html.slice(start,html.indexOf(b,start));};
 const code=slice('function p0V9Store(entries){','function p0V9FetchJsonp')+slice('let p0V9LoadPromise','function getP0PlusEntriesForItem')+slice('var p0V9RefreshPromise;','/* Nach dem Überschreiben');
 let calls=0,renders=0,mode='empty',abort;
 const old=[{item:'Existing',player:'Player',points:3}];
 const ctx=vm.createContext({window:{p0plusEntries:old},p0PlusData:{},p0V9Normalize:x=>x,p0V9Key:x=>x,AbortController,Date,console,document:{getElementById:()=>null},P0PLUS_API_URL:'https://example.test/api',currentGuildSlug:()=> 'test-guild',renderLootList:()=>renders++,renderCurrentPrios(){},setTimeout:fn=>{abort=fn;return 1},clearTimeout(){},fetch:async(url,opts)=>{
  calls++;assert(new URL(url).searchParams.get('guild')==='test-guild');
  if(mode==='offline')throw Error('offline');
  if(mode==='invalid')return {ok:true,json:async()=>({success:false})};
  if(mode==='timeout')return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted'))));
  return {ok:true,json:async()=>({success:true,entries:mode==='empty'?[]:old})};
 }});
 vm.runInContext(code,ctx);
 await Promise.all([ctx.refreshP0PlusEverywhere(),ctx.refreshP0PlusEverywhere(),ctx.refreshP0PlusEverywhere()]);
 assert.equal(calls,1);assert.equal(renders,1);assert.equal(ctx.window.p0plusEntries.length,0);
 await ctx.loadP0PlusFromSheet();assert.equal(calls,1,'cache valid empty responses');
 mode='populated';vm.runInContext('p0V9LoadedAt=0',ctx);await ctx.loadP0PlusFromSheet();assert.equal(ctx.window.p0plusEntries.length,1);assert.equal(ctx.window.p0plusEntries[0].__currentGuildApi,true);
 const saved=ctx.window.p0plusEntries;
 for(mode of ['offline','invalid','timeout']){
  vm.runInContext('p0V9LoadedAt=0',ctx);const pending=ctx.loadP0PlusFromSheet();if(mode==='timeout')abort();await assert.rejects(pending);assert.equal(ctx.window.p0plusEntries,saved,'failure must retain existing points');
 }
 mode='empty';await ctx.loadP0PlusFromSheet();assert.equal(ctx.window.p0plusEntries.length,0,'retry after failure');
 console.log('PASS',raid,': empty/populated results, concurrent loading and rendering, caching, timeout, failure preservation, retry, script syntax and public mirror');
}
})().catch(error=>{console.error(error);process.exitCode=1});
