"""Build a standalone mini-addon ZIP from addons/<Name> and write its CurseForge release manifest.

Usage: python3 scripts/build-standalone.py GuildRaidBag
"""
import hashlib, json, re, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
PROJECTS={'GuildRaidBag':{'projectId':1692270,'slug':'guildraidbag'},'GuildSkills':{'projectId':1692281,'slug':'guildskills'},'GuildBuff':{'projectId':1692275,'slug':'guildbuff'},'GuildHeal':{'projectId':0,'slug':'guildheal'}}
EXTRAS={'README.md','PROFESSION-DATA-LICENSE.txt','PROFESSION-DATA-SOURCE.txt'}
# Ein CurseForge-Projekt für alle Mini-Addons: eine Zip mit drei Addon-Ordnern (Vorgabe der CurseForge-Moderation).
BUNDLE={'name':'GuildLootMiniAddons','projectId':1692281,'slug':'guildloot-mini-addons','addons':['GuildSkills','GuildBuff','GuildRaidBag','GuildHeal']}

def files_of(name):
    folder=ROOT/'addons'/name;assert folder.is_dir(),'Unknown addon '+name
    toc=(folder/(name+'.toc')).read_text(encoding='utf-8')
    version=re.search(r'^## Version: (\S+)$',toc,re.M).group(1);assert re.fullmatch(r'\d+\.\d+\.\d+(?:-beta)?',version)
    assert '## Interface: 11509\n' in toc and '## Title: '+name+'\n' in toc
    names=[l.strip() for l in toc.splitlines() if l.strip() and not l.startswith('#')]+[name+'.toc']
    names+=[e for e in sorted(EXTRAS) if (folder/e).is_file()]
    media=sorted(str(p.relative_to(folder)).replace('\\','/') for p in (folder/'Media').rglob('*') if p.is_file()) if (folder/'Media').is_dir() else []
    names+=media;assert len(set(names))==len(names)
    for n in names:assert (folder/n).is_file() and '..' not in n,'Missing '+n
    return folder,version,names

def build(name):
    project=PROJECTS[name];assert project['projectId']>0,'CurseForge project ID for '+name+' is not set yet'
    folder,version,names=files_of(name)
    out=ROOT/'addon-release'/(name+'.zip')
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for n in sorted(names):z.write(folder/n,name+'/'+n)
    sha=hashlib.sha256(out.read_bytes()).hexdigest()
    manifest={'addon':name,'projectId':project['projectId'],'slug':project['slug'],'version':version,'releaseType':'beta' if version.endswith('-beta') else 'release','gameVersion':'1.15.9','sha256':sha}
    (ROOT/'addon-release'/(name+'.release.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(name,version,out.stat().st_size,'bytes',len(names),'files sha256',sha[:16])

def build_bundle():
    parts=[files_of(n) for n in BUNDLE['addons']]
    versions={v for _,v,_ in parts};assert len(versions)==1,'All bundled addons must share one version: '+str(versions)
    version=versions.pop();out=ROOT/'addon-release'/(BUNDLE['name']+'.zip')
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for folder,_,names in parts:
            for n in sorted(names):z.write(folder/n,folder.name+'/'+n)
    sha=hashlib.sha256(out.read_bytes()).hexdigest()
    manifest={'addon':BUNDLE['name'],'folders':BUNDLE['addons'],'projectId':BUNDLE['projectId'],'slug':BUNDLE['slug'],'version':version,'releaseType':'beta' if version.endswith('-beta') else 'release','gameVersion':'1.15.9','sha256':sha}
    (ROOT/'addon-release'/(BUNDLE['name']+'.release.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(BUNDLE['name'],version,out.stat().st_size,'bytes',sum(len(n) for _,_,n in parts),'files sha256',sha[:16])

if __name__=='__main__':
    args=sys.argv[1:]
    if not args or 'bundle' in args:build_bundle()
    for arg in [a for a in args if a!='bundle']:build(arg)
