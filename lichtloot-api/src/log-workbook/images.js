export function workbookIconUrl(icon){
  if(!icon)return null;
  if(/^https:/i.test(icon)){try{const u=new URL(icon);if(u.hostname!=='wow.zamimg.com'||u.username||u.password||u.port)return null;const m=u.pathname.match(/^\/images\/wow\/icons\/(?:small|medium|large)\/([a-z0-9_]+)\.(?:jpg|png)$/i);if(!m)return null;icon=m[1];}catch{return null;}}
  return /^[a-z0-9_]+$/i.test(icon)?`https://wow.zamimg.com/images/wow/icons/large/${icon.toLowerCase()}.jpg`:null;
}
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const cache=new Map();
export async function workbookImage(icon,{publicDir,publicBaseUrl,logo=false}={}) {
  if(!icon)return null;
  let key=icon;
  if(!logo){if(/^https:/i.test(icon)){try{const u=new URL(icon);if(u.hostname!=='wow.zamimg.com'||u.username||u.password||u.port)return null;const m=u.pathname.match(/^\/images\/wow\/icons\/(?:small|medium|large)\/([a-z0-9_]+)\.(?:jpg|png)$/i);if(!m)return null;icon=m[1];}catch{return null;}}if(!/^[a-z0-9_]+$/i.test(icon))return null;key=`https://wow.zamimg.com/images/wow/icons/large/${icon.toLowerCase()}.jpg`;}
  if(cache.has(key))return cache.get(key);
  const job=(async()=>{try{
    let buffer,extension;
    if(logo && !/^https?:/i.test(key)){
      const target=path.resolve(publicDir,key.replace(/^\//,''));if(!target.startsWith(path.resolve(publicDir)+path.sep))return null;
      if(!/\.(png|jpe?g)$/i.test(target))return null;buffer=await readFile(target);extension=/\.png$/i.test(target)?'png':'jpeg';
    }else{
      const url=new URL(key),allowed=new Set(['wow.zamimg.com','s1.directupload.eu','cdn.discordapp.com','media.discordapp.net',new URL(publicBaseUrl).hostname]);
      if(url.protocol!=='https:' || !allowed.has(url.hostname) || url.port || url.username || url.password)return null;
      const res=await fetch(url,{signal:AbortSignal.timeout(6000),redirect:'error'});if(!res.ok)return null;
      if(Number(res.headers.get('content-length')||0)>2_000_000)return null;
      const reader=res.body.getReader(),chunks=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000){await reader.cancel();return null;}chunks.push(value);}
      buffer=Buffer.concat(chunks);extension=buffer[0]===0x89&&buffer[1]===0x50?'png':buffer[0]===0xff&&buffer[1]===0xd8?'jpeg':null;
    }
    if(!extension||!buffer?.length||buffer.length>2_000_000)return null;return {buffer,extension};
  }catch{return null;}})();
  cache.set(key,job);if(cache.size>800)cache.delete(cache.keys().next().value);const result=await job;if(!result)cache.delete(key);return result;
}
