"""Build a standalone mini-addon ZIP from addons/<Name> and write its CurseForge release manifest.

Usage: python3 scripts/build-standalone.py GuildRaidBag
"""
import hashlib, json, re, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
PROJECTS={'GuildRaidBag':{'projectId':1692270,'slug':'guildraidbag'},'GuildSkills':{'projectId':1692281,'slug':'guildskills'},'GuildBuff':{'projectId':1692275,'slug':'guildbuff'}}
EXTRAS={'README.md','PROFESSION-DATA-LICENSE.txt','PROFESSION-DATA-SOURCE.txt'}

def build(name):
    folder=ROOT/'addons'/name;assert folder.is_dir(),'Unknown addon '+name
    project=PROJECTS[name];assert project['projectId']>0,'CurseForge project ID for '+name+' is not set yet'
    toc=(folder/(name+'.toc')).read_text(encoding='utf-8')
    version=re.search(r'^## Version: (\S+)$',toc,re.M).group(1);assert re.fullmatch(r'\d+\.\d+\.\d+(?:-beta)?',version)
    assert '## Interface: 11509\n' in toc and '## Title: '+name+'\n' in toc
    names=[l.strip() for l in toc.splitlines() if l.strip() and not l.startswith('#')]+[name+'.toc']
    names+=[e for e in sorted(EXTRAS) if (folder/e).is_file()]
    media=sorted(str(p.relative_to(folder)).replace('\\','/') for p in (folder/'Media').rglob('*') if p.is_file()) if (folder/'Media').is_dir() else []
    names+=media;assert len(set(names))==len(names)
    for n in names:assert (folder/n).is_file() and '..' not in n,'Missing '+n
    out=ROOT/'addon-release'/(name+'.zip')
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for n in sorted(names):z.write(folder/n,name+'/'+n)
    sha=hashlib.sha256(out.read_bytes()).hexdigest()
    manifest={'addon':name,'projectId':project['projectId'],'slug':project['slug'],'version':version,'releaseType':'beta' if version.endswith('-beta') else 'release','gameVersion':'1.15.9','sha256':sha}
    (ROOT/'addon-release'/(name+'.release.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(name,version,out.stat().st_size,'bytes',len(names),'files sha256',sha[:16])

if __name__=='__main__':
    for arg in sys.argv[1:] or sorted(n for n in PROJECTS if (ROOT/'addons'/n).is_dir()):build(arg)
