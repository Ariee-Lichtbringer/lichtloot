"""Import factual beta client records exposed by wowforevertalents.com.
Run with Python + beautifulsoup4. Uses a disk cache; never touches a database.
Keeps provenance and does not translate changed spell text using stale Era text.
"""
import concurrent.futures, hashlib, json, pathlib, re, subprocess
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[2]
CACHE=pathlib.Path('/tmp/guildloot-forever-beta-source'); CACHE.mkdir(exist_ok=True)
BASE='https://wowforevertalents.com'
DATE='2026-09-23'
def fetch(path):
    url=BASE+path; dest=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
    if not dest.exists():
        result=subprocess.run(['curl','--fail','--silent','--show-error','-L','-A','Mozilla/5.0',url],capture_output=True,check=True)
        dest.write_bytes(result.stdout)
    return dest.read_text()
def soup(path):return BeautifulSoup(fetch(path),'html.parser')
def write(name,data):
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
    (ROOT/name).write_text(text);(ROOT/'lichtloot-api/public'/name).write_text(text)
def load(name):return json.loads((ROOT/name).read_text())
page=soup('/warrior/')
module=next(n['component-url'] for n in page.select('astro-island[component-url]') if 'TalentCalculator.' in n['component-url'])
js=fetch(module)
shared=re.findall(r'from"(\./[^\"]+)"',js)
raw=None
for part in shared:
    text=fetch('/_astro/'+part[2:])
    match=re.search(r'JSON.parse\(`(\[\{"id":1,"slug":"warrior".*?)`\)',text,re.S)
    if match:raw=match[1].replace('\\${','${').replace('\\`','`');build=re.search(r'build:"([\d.]+)"',text)[1];break
assert raw,'No class data found'
classes=json.loads(raw);assert len(classes)==9
old=load('forever-talents-data.json');old_de=load('forever-talents-data-de.json')
legacy='forever-talents-preview-20260914.json'
if not (ROOT/legacy).exists():write(legacy,old)
# Only names can retain translations; changed tooltips must not retain old numbers.
translated={}
for c,dc in zip(old['classes'],old_de['classes']):
    byid={t['id']:t for tr in dc['trees'] for t in tr['talents']}
    for tr in c['trees']:
        for t in tr['talents']:
            if t['id'] in byid:translated[t['name']]=byid[t['id']]['name']
metadata={'source':BASE+'/', 'date':DATE,'build':build,'evidence':'client-data-community','inGameVerified':False,'descriptionLanguage':'en'}
write('forever-talents-data.json',{**metadata,'classes':classes})
de=json.loads(json.dumps(classes))
for c in de:
    oldc=next(x for x in old_de['classes'] if x['slug']==c['slug']);c['name']=oldc['name']
    for tr in c['trees']:
        oldtr=next((x for x in oldc['trees'] if x['slug']==tr['slug']),None)
        if oldtr:tr['name']=oldtr['name']
        for t in tr['talents']:t['name']=translated.get(t['name'],t['name'])
write('forever-talents-data-de.json',{**metadata,'classes':de})

def abilities(c):
    path='/abilities/'+c['slug']+'/'
    s=soup(path);entries=[]
    for tab in s.select('[role=tabpanel][data-tab]'):
        for button in tab.select('button[data-tip]'):
            d=json.loads(button['data-tip']);ranks=d.get('k',[])
            if not ranks:continue
            img=button.find('img');icon=img['src'].rsplit('/',1)[-1].split('.')[0] if img else c['icon']
            rs=[{'t':r.get('r',''),'l':r.get('l',0),'d':r.get('d',''),'m':[r['m']] if r.get('m') else []} for r in ranks]
            entries.append({'key':tab['data-tab']+'__'+re.sub(r'[^a-z0-9]+','-',d['n'].lower()).strip('-'),'tab':tab['data-tab'],'name':d['n'],'icon':icon,'status':d['s'],'label':d.get('sl',''),'fromTalent':False,'races':[],'note':'','classicText':ranks[-1].get('c',''),'desc':rs[-1]['d'],'meta':rs[-1]['m'],'ranks':rs,'fr':d['s']!='unchanged','source':BASE+path,'build':build})
    assert entries,c['slug']
    return c['slug'],entries
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: ability_data=dict(pool.map(abilities,classes))
for lang in ['en','de']:
    d=load('forever-character-data-'+lang+'.json');previous=d['abilities'];d['abilities']=json.loads(json.dumps(ability_data));d.update(metadata)
    d['racesDate']=d.get('racesDate','2026-09-14')
    if lang=='de':
        english_old=load('forever-character-data-en.json') if False else None
        # Names only: matching stable keys avoids recycling outdated numerical descriptions.
        for cls,records in d['abilities'].items():
            names={a['key']:a['name'] for a in previous.get(cls,[])}
            for a in records:a['name']=names.get(a['key'],a['name'])
    write('forever-character-data-'+lang+'.json',d)

professions=['alchemy','blacksmithing','cooking','enchanting','engineering','first-aid','leatherworking','tailoring','mining']
def profession_paths(p):
    home='/professions/'+p+'/'
    s=soup(home)
    return [(p,path) for path in sorted({a['href'] for a in s.select('a[href]') if a['href'].startswith(home) and a['href']!=home and not any(x in a['href'] for x in ['not-in-forever','season-of-discovery','#','?'])})]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: paths=[x for group in pool.map(profession_paths,professions) for x in group]
def recipes(task):
    prof,path=task;s=soup(path);records=[]
    for row in s.select('.pw-row[data-r]'):
        if row.get('data-status')=='removed':continue
        detail=row.select_one('.rd')
        if not detail:continue
        title=detail.select_one('.rd-name');name=title.get_text(' ',strip=True).replace('★','').replace('◆','').strip()
        output=detail.select_one('.rd-icon[href]');m=re.search(r'item=(\d+)',output['href']) if output else None
        reagents=[]
        for a in detail.select('.rd-reagents li a[href]'):
            mat=re.search(r'item=(\d+)',a['href']);n=a.select_one('.rd-count');nm=a.select_one('.rd-reagent-name')
            if mat and n and nm:reagents.append({'id':int(mat[1]),'count':int(n.get_text(strip=True)),'name':nm.get_text(strip=True)})
        def num(k):
            v=row.get('data-'+k);return int(v) if v and v.isdigit() else None
        teachers=[{'id':int(re.search(r'item=(\d+)',a['href'])[1]),'name':a.get_text(' ',strip=True)} for a in detail.select('.rd-teachers a[href]') if re.search(r'item=(\d+)',a['href'])]
        spell=int(row['data-r']);icon=row.select_one('img');makes=re.search(r'Makes (\d+)(?:[–-](\d+))?',detail.get_text(' ',strip=True))
        records.append({'spellId':spell,'profession':prof,'name':name,'outputItemId':int(m[1]) if m else None,'outputCount':int(makes[1]) if makes else None,'outputMax':int(makes[2]) if makes and makes[2] else None,'icon':icon['src'].rsplit('/',1)[-1].split('.')[0] if icon else '', 'requiredSkill':num('learn'),'thresholds':[num('learn'),num('yellow'),num('green'),num('grey')],'ingredients':reagents,'learnSource':row.get('data-src','unknown'),'recipeItems':teachers,'status':row.get('data-status','unknown'),'source':BASE+path+'#r-'+str(spell),'build':build})
    return records
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: records=[r for group in pool.map(recipes,paths) for r in group]
unique={}
for r in records:
    key=(r['profession'],r['spellId'])
    if key in unique:assert unique[key]==r,(key,'conflicting recipe records')
    unique[key]=r
records=list(unique.values());assert len(records)>1000,len(records)
write('forever-crafting-data.json',{'date':DATE,'build':build,'source':BASE+'/professions/','evidence':'client-data-community','inGameVerified':False,'recipes':records})
report={'date':DATE,'build':build,'talents':sum(len(t['talents']) for c in classes for t in c['trees']),'abilities':{k:len(v) for k,v in ability_data.items()},'recipes':len(records),'trainerRecipes':sum(r['learnSource']=='trainer' for r in records),'recipesWithIngredients':sum(bool(r['ingredients']) for r in records),'sources':[BASE+'/',BASE+'/abilities/',BASE+'/professions/']}
write('forever-beta-import-report.json',report);print(json.dumps(report,indent=2))
