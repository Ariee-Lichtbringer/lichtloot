"""Refresh Forever database item records; preserves community provenance and old source indices."""
import json,re,pathlib,subprocess,hashlib,concurrent.futures
R=pathlib.Path(__file__).resolve().parents[2];C=pathlib.Path('/tmp/guildloot-beta-items');C.mkdir(exist_ok=True)
manifest=[];unavailable=[]
def collect(lang,lo,hi):
 url='https://www.wowhead.com/forever/'+('de/' if lang=='de' else '')+'items?filter=cr=151:151;crs=2:4;crv='+str(lo)+':'+str(hi)
 p=C/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if not p.exists():
  response=subprocess.run(['curl','-L','-s','--fail','--max-time','45','-A','Mozilla/5.0',url],capture_output=True)
  if response.returncode:
   unavailable.append(url);return {}
  p.write_bytes(response.stdout)
 s=p.read_text();m=re.search(r'var listviewitems\s*=\s*(\[.*?\]);',s,re.S)
 if not m:
  if 'Ihre Kriterien stimmen nicht' in s or 'No results' in s or 'Your criteria did not match any items' in s:return {}
  raise ValueError('Missing item list '+url)
 data=json.loads(re.sub(r'(?<=[{,])(firstseenpatch|popularity):',r'"\1":',m[1]));assert all(lo<=x['id']<=hi for x in data)
 if '_truncated: 1' in s:
  assert lo<hi
  mid=(lo+hi)//2;return collect(lang,lo,mid)|collect(lang,mid+1,hi)
 gather={}
 for match in re.finditer(r'WH.Gatherer.addData\(3,\s*16,\s*',s):gather.update(json.JSONDecoder().raw_decode(s[match.end():])[0])
 manifest.append({'source':url,'count':len(data)})
 result={}
 for x in data:
  g=gather.get(str(x['id']),{});result[x['id']]={**{k:x[k] for k in ['id','name','quality','classs','subclass','slot','level','reqlevel','itemset','source','sourcemore'] if k in x},'icon':g.get('icon','inv_misc_questionmark'),'stats':g.get('jsonequip',{}),'attainable':g.get('attainable')}
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 futures={lang:pool.submit(collect,lang,0,400000) for lang in ['de','en']};result={k:v.result() for k,v in futures.items()}
assert len(result['en'])>16000 and len(result['de'])>16000
items=json.loads((R/'forever-items-data.json').read_text());english=json.loads((R/'forever-items-en.json').read_text());old={i['id']:i for i in items['items']};changed=added=0
for id,fresh in result['de'].items():
 previous=old.get(id)
 if previous:
  # Community source references use array indices; never invalidate them during a refresh.
  sources=previous.get('sourcemore',[])[:]
  for source in fresh.get('sourcemore',[]):
   if source not in sources:sources.append(source)
  fresh['sourcemore']=sources
  merged={**previous,**fresh,'checkedAt':'2026-09-23','dataSource':'https://www.wowhead.com/forever/item='+str(id)}
  changed+=any(previous.get(k)!=fresh.get(k) for k in ['stats','quality','level','reqlevel','itemset'])
 else:merged={**fresh,'betaImport':True,'checkedAt':'2026-09-23','dataSource':'https://www.wowhead.com/forever/item='+str(id)};added+=1
 old[id]=merged
for id,fresh in result['en'].items():
 if id in old:english[str(id)]={'name':fresh['name'],'sourcemore':old[id].get('sourcemore',[])}
for id,x in old.items():english.setdefault(str(id),{'name':x['name']})
items.update(count=len(old),items=sorted(old.values(),key=lambda x:x['id']),lastBetaImport='2026-09-23',coverage='Wowhead item-ID range 0–400000, recursively split to avoid result caps. Unavailable source ranges are listed in forever-item-import-report.json; previous and community records retained. Database availability is not proof of in-game drops.')
loot=json.loads((R/'forever-loot-sources.json').read_text());zones={str(z['id']):z for z in loot['zones']}
for id,x in old.items():
 for index,source in enumerate(x.get('sourcemore',[])):
  zone=str(source.get('z') or (2159 if source.get('id')==10184 else ''))
  if zone not in zones:continue
  indices=loot['assignments'].setdefault(str(id),{}).setdefault(zone,[])
  if index not in indices:indices.append(index)
for zone,z in zones.items():z['count']=sum(zone in a for a in loot['assignments'].values())
loot['lastDatabaseImport']='2026-09-23'
for name,data in [('forever-items-data.json',items),('forever-items-en.json',english),('forever-loot-sources.json',loot),('forever-item-import-report.json',{'date':'2026-09-23','count':len(old),'added':added,'changed':changed,'pages':manifest,'unavailable':unavailable})]:
 text=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n';(R/name).write_text(text);(R/'lichtloot-api/public'/name).write_text(text)
print(json.dumps({'count':len(old),'added':added,'changed':changed,'pages':len(manifest)}))
