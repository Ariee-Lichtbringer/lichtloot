import {readFile} from 'node:fs/promises';
import {createDecipheriv} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
let cached;
export async function addonUpdate(){
 if(!cached){
  const key=process.env.ADDON_BETA_FILE_KEY||'';if(!/^[a-f0-9]{64}$/i.test(key))throw Error('Addon-Update ist noch nicht verfügbar.');
  const data=await readFile(new URL('../private/GuildLootEra-update.enc',import.meta.url));
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));
  cached=JSON.parse(gunzipSync(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]),{maxOutputLength:24000000}).toString());
 }
 return cached;
}
