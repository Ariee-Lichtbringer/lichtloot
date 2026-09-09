// Cache validated item metadata; never derive quality or item class from a name.
const cache=new Map();
export function parseArchiveItemXml(xml) {
  const quality=xml.match(/<quality\s+id="(\d+)"/i)?.[1];
  const itemClass=xml.match(/<class\s+id="(\d+)"/i)?.[1];
  const icon=xml.match(/<icon[^>]*>([a-z0-9_]+)<\/icon>/i)?.[1];
  if(quality===undefined||itemClass===undefined||!icon)return null;
  return {quality:Number(quality),itemClass:Number(itemClass),iconUrl:icon};
}
export async function archiveItemMetadata(ids,readCatalog) {
  const result=await readCatalog(ids);
  const deadline=Date.now()+8000;
  const unique=[...new Set(ids.map(Number).filter(id=>Number.isInteger(id)&&id>0&&id<=1000000))];
  for(let offset=0;offset<unique.length;offset+=8)await Promise.all(unique.slice(offset,offset+8).map(async id=>{
    let entry=cache.get(id);
    if(!entry||entry.expires<Date.now()){
      if(Date.now()>deadline)return;
      const promise=(async()=>{
        try{const response=await fetch(`https://www.wowhead.com/classic/de/item=${id}&xml`,{signal:AbortSignal.timeout(4500),headers:{'user-agent':'GuildLoot/1.0'}});return response.ok?parseArchiveItemXml(await response.text()):null;}catch{return null;}
      })();
      entry={promise,expires:Date.now()+24*60*60*1000};cache.set(id,entry);
      if(cache.size>10000)cache.delete(cache.keys().next().value);
    }
    const extra=await entry.promise;
    if(extra)result.set(String(id),{...result.get(String(id)),...extra});
    else entry.expires=Math.min(entry.expires,Date.now()+60000);
  }));
  return result;
}
