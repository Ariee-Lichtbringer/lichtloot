import { createDecipheriv, createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const downloads = new Map();
export async function materializeBetaArtifact(artifact, encryptionKey, {
  fetcher = fetch, directory = join(tmpdir(), 'guildloot-beta-downloads'),
} = {}) {
  const key = createHash('sha256').update(encryptionKey).digest('hex').slice(0,16);
  const target = join(directory, artifact.sha256 + '-' + key);
  if (!downloads.has(target)) {
    const task = (async () => {
      await mkdir(directory, {recursive:true,mode:0o700});
      if ((await stat(target).catch(()=>null))?.size === artifact.size) return target;
      const temporary = target + '.' + randomUUID() + '.part';
      let reader;
      try {
        const response = await fetcher(artifact.url, {signal:AbortSignal.timeout(240000)});
        if (!response.ok || !response.body) throw Error('Beta installer unavailable');
        reader = response.body.getReader();
        let header=Buffer.alloc(0), first=Buffer.alloc(0);
        while(header.length<28) {
          const {done,value}=await reader.read();if(done)throw Error('Invalid installer header');
          const chunk=Buffer.from(value), count=Math.min(28-header.length,chunk.length);
          header=Buffer.concat([header,chunk.subarray(0,count)]);first=chunk.subarray(count);
        }
        const decipher=createDecipheriv('aes-256-gcm',Buffer.from(encryptionKey,'hex'),header.subarray(0,12));
        decipher.setAuthTag(header.subarray(12,28));
        const hash=createHash('sha256');let size=0;
        const verify=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>artifact.size)return callback(Error('Installer too large'));hash.update(chunk);callback(null,chunk);}});
        async function* encrypted(){if(first.length)yield first;for(;;){const {done,value}=await reader.read();if(done)return;yield value;}}
        await pipeline(Readable.from(encrypted()),decipher,verify,createWriteStream(temporary,{flags:'wx',mode:0o600}));
        if(size!==artifact.size||hash.digest('hex')!==artifact.sha256)throw Error('Installer checksum mismatch');
        await rename(temporary,target);return target;
      } catch(error) {await rm(temporary,{force:true});throw error;}
      finally {if(reader)await reader.cancel().catch(()=>{});}
    })();
    downloads.set(target,task);
    task.catch(()=>downloads.delete(target));
  }
  return downloads.get(target);
}
