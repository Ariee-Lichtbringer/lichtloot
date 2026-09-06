import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
for(const raid of ['mc','bwl','aq40','aq20','naxx','zg','ony']){
 const file=new URL(`../../loot/${raid}-loot.html`,import.meta.url),src=fs.readFileSync(file,'utf8');
 const extract=name=>{const start=src.indexOf('function '+name+'(');assert(start>=0);return src.slice(start,src.indexOf('\n}\n',start)+2)};
 const ctx=vm.createContext({window:{},p0PlusData:{},console,p0V9First:(o,keys)=>{for(const key of keys)if(o[key]!==undefined&&o[key]!==null&&o[key]!=='')return String(o[key]);return ''},p0V9Points:v=>String(Number(v)||0),p0V9Raid:v=>v,p0V9Key:v=>String(v).toLowerCase(),normalizeGuildKey:v=>String(v||'').toLowerCase(),currentGuildSlug:()=> 'nachtloot',currentGuildInfo:{slug:'nachtloot'},displayGuildName:()=> 'nachtloot',lootTitleFromGuild:()=> 'nachtloot'});
 vm.runInContext(['p0V9Normalize','p0V9Store','lichtlootP0GuildMatchesCurrent','lichtlootFilterCurrentGuildP0Stores'].map(extract).join('\n'),ctx);
 const original={item:'Neltharions Träne',player:'Dantholomäos',points:10,raid:'bwl',server:'Lakeshire',__currentGuildApi:true,accountLinked:true};
 const normalized=ctx.p0V9Normalize(ctx.p0V9Normalize(original));assert.equal(normalized.server,'Lakeshire');assert.equal(normalized.__currentGuildApi,true);
 ctx.p0V9Store([original,{...original,player:'foreign',guildSlug:'other-guild'},{item:'Other',player:'unscoped',points:7,raid:'bwl'}]);ctx.lichtlootFilterCurrentGuildP0Stores();assert.equal(ctx.window.p0plusEntries.length,1);assert.equal(ctx.window.p0plusEntries[0].player,'Dantholomäos');assert.equal(ctx.window.p0plusEntries[0].points,'10');
 const copy=fs.readFileSync(new URL(`../public/loot/${raid}-loot.html`,import.meta.url),'utf8');assert(copy.includes('...obj, // Preserve realm and guild/API provenance'));
}
console.log('PASS all seven raid pages: repeated normalization preserves server and API provenance; own-guild points remain visible; foreign and unscoped entries remain excluded; deployed copies updated.');
