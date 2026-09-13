import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const paths=['mc','bwl','aq40','naxx','zg','aq20','ony'];
for(const raid of paths){
 const source=fs.readFileSync(new URL(`../../loot/${raid}-loot.html`,import.meta.url),'utf8');
 const start=source.indexOf('function getRandomParticipantToken(){'),end=source.indexOf('\nfunction initializeRandomCharacterProfile()',start),fn=source.slice(start,end);
 let cookie='',fail=false;const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 function context(block=false){const window={};for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){if(block)throw Error('blocked');return storage;}});return vm.createContext({window,document:{set cookie(v){if(fail)throw Error('blocked');cookie=v;}},crypto:webcrypto,Uint8Array,randomCookieValue:()=>'',decodeURIComponent,encodeURIComponent});}
 let c=context();vm.runInContext(fn,c);const first=c.getRandomParticipantToken();assert.equal(first.length,48);assert.equal(c.getRandomParticipantToken(),first);c=context();vm.runInContext(fn,c);assert.equal(c.getRandomParticipantToken(),first);
 fail=true;c=context(true);vm.runInContext(fn,c);const temporary=c.getRandomParticipantToken();assert.equal(c.getRandomParticipantToken(),temporary);assert.equal(temporary.length,48);
 for(const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Function(m[1]);
 assert.equal(fs.readFileSync(new URL(`../public/loot/${raid}-loot.html`,import.meta.url),'utf8'),source);
}
const rules=fs.readFileSync(new URL('../../loot/po-release-status.js',import.meta.url),'utf8');
const start=rules.indexOf('  async function requireWorldbuffAgreementForSave('),end=rules.indexOf('\n  }',start)+4;
for(const random of ['1','0']){let checked=0;const c=vm.createContext({location:{search:'?random='+random},URLSearchParams,selectedWorldbuffToken(){checked++;return '';},window:{}});vm.runInContext(rules.slice(start,end),c);assert.equal(await c.requireWorldbuffAgreementForSave('Kopf von Nefarian'),true);assert.equal(checked,random==='1'?0:1);}
console.log('All 7 loot pages: stable guest identity, reload, blocked storage, matching published copies, syntax and guild-rule isolation OK');
