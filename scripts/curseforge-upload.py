"""Publish the approved clean ZIP. Tokens are only read from Actions secrets.

RELEASE_FILE selects the manifest (default: addon-release/release.json for GuildLoot Era).
Standalone mini-addons use addon-release/<Name>.release.json written by scripts/build-standalone.py.
"""
import hashlib, json, os, re, sys, urllib.request, urllib.error, uuid, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
CF='https://wow.curseforge.com'
GH_REPO='Ariee-Lichtbringer/lichtloot'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
OPEN=urllib.request.build_opener(NoRedirect)
def request(url,token,data=None,content_type='application/json',github=False,method=None):
    headers={'Accept':'application/json','User-Agent':'GuildLoot-Release/1.0','Content-Type':content_type}
    headers['Authorization' if github else 'X-Api-Token']=('Bearer ' if github else '')+token
    try:
        with OPEN.open(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=90) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        body=''
        try:body=error.read().decode('utf-8','replace')[:600]
        except Exception:body=''
        raise RuntimeError(('GitHub' if github else 'CurseForge')+' API returned HTTP '+str(error.code)+(' – '+body if body and not github else '')) from None
    except (urllib.error.URLError,TimeoutError):
        raise RuntimeError('Network response uncertain. Do not retry a reserved upload without checking CurseForge.') from None

def load():
    release_file=ROOT/os.environ.get('RELEASE_FILE','addon-release/release.json')
    config=json.loads(release_file.read_text())
    addon=config.get('addon','GuildLootEra')
    config.setdefault('addon',addon);config.setdefault('slug','guildloot-classic-era');config.setdefault('zip',addon+'.zip')
    if addon=='GuildLootEra':assert config['projectId']==1689420,'Wrong project'
    else:assert isinstance(config['projectId'],int) and config['projectId']>0 and config['projectId']!=1689420,'Standalone addon needs its own project'
    return config

def validate():
    config=load();addon=config['addon']
    version=config['version'];assert re.fullmatch(r'\d+\.\d+\.\d+(?:-beta)?',version),'Invalid addon version'
    assert config['releaseType'] in ('release','beta') and config['gameVersion']=='1.15.9','Review game compatibility before changing it'
    if addon=='GuildLootEra':assert config['releaseType']=='release'
    zip_path=ROOT/'addon-release'/config['zip']
    data=zip_path.read_bytes()
    assert hashlib.sha256(data).hexdigest()==config['sha256'],'ZIP checksum mismatch'
    with zipfile.ZipFile(zip_path) as archive:
        names=archive.namelist();assert len(names)==len(set(names)) and len(names)<500
        assert all(n.startswith(addon+'/') and '..' not in n.split('/') for n in names),'Unexpected ZIP path'
        assert sum(i.file_size for i in archive.infolist())<24000000,'ZIP too large'
        assert archive.testzip() is None,'Damaged ZIP'
        if addon+'/SyncData.lua' in names:
            assert archive.read(addon+'/SyncData.lua')==b'GuildLootSyncInbox = nil\n','Personal sync data in release'
        toc=archive.read(addon+'/'+addon+'.toc').decode()
        assert '## Version: '+version+'\n' in toc and '## Interface: 11509\n' in toc
        loaded=[line.strip() for line in toc.splitlines() if line.strip() and not line.startswith('#')]
        extras=[addon+'.toc','README.md','PROFESSION-DATA-LICENSE.txt','PROFESSION-DATA-SOURCE.txt']
        media=[n[len(addon)+1:] for n in names if n.startswith(addon+'/Media/')]
        allowed={addon+'/'+x for x in loaded+extras+media}
        assert set(names)<=allowed and all(addon+'/'+x in names for x in loaded+[addon+'.toc']),'Unlisted file or missing TOC dependency'
    changelog_file=ROOT/'addon-release'/('CHANGELOG.md' if addon=='GuildLootEra' else addon+'.CHANGELOG.md')
    changelog=changelog_file.read_text().strip();assert changelog
    return config,data,changelog

def main():
    config,data,changelog=validate();addon=config['addon']
    if '--validate-only' in sys.argv:print(addon+': ZIP, version, manifest and clean file list verified.');return
    token=os.environ.get('CF_API_TOKEN','');assert token,'CF_API_TOKEN is missing'
    versions=request(CF+'/api/game/wow/versions',token)
    matches=[v for v in versions if v.get('name')==config['gameVersion'] and v.get('gameVersionTypeID')==67408]
    assert len(matches)==1,'Classic Era game version was not uniquely found'
    metadata={'displayName':addon+'-'+config['version'],'gameVersions':[matches[0]['id']],'releaseType':config['releaseType'],'changelog':changelog,'changelogType':'markdown'}
    print(addon+': ZIP and CurseForge connection verified; Classic Era '+config['gameVersion'])
    if os.environ.get('PUBLISH')!='true':print('Validation only; no upload requested.');return
    assert os.environ.get('GITHUB_REPOSITORY')==GH_REPO,'Wrong repository'
    gh=os.environ['GH_TOKEN']
    ref='refs/tags/curseforge-upload/'+(config['version'] if addon=='GuildLootEra' else addon+'/'+config['version'])
    existing=config.get('existingFile')
    if existing:
        assert existing['version']==config['version'] and existing['sha256']==config['sha256'],'For a new version, remove existingFile from release.json'
        assert isinstance(existing['id'],int) and existing['id']>0,'Invalid existing file ID'
        metadata={'fileID':existing['id'],'releaseType':config['releaseType']}
    # Reserve before POST: even an uncertain response must not cause a double upload.
    if not existing:
        try:
            request('https://api.github.com/repos/'+GH_REPO+'/git/ref/tags/'+ref[len('refs/tags/'):],gh,github=True)
            print(addon+' '+config['version']+' was already reserved for upload; nothing to do.');return
        except RuntimeError as error:
            if '404' not in str(error):raise
        request('https://api.github.com/repos/'+GH_REPO+'/git/refs',gh,json.dumps({'ref':ref,'sha':os.environ['GITHUB_SHA']}).encode(),github=True)
    boundary='GuildLoot'+uuid.uuid4().hex
    payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode()+json.dumps(metadata).encode()+f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{addon}-{config["version"]}.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode())
    if existing:
        payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode()+json.dumps(metadata).encode()+f'\r\n--{boundary}--\r\n'.encode())
    result=request(CF+'/api/projects/'+str(config['projectId'])+'/'+('update-file' if existing else 'upload-file'),token,payload,'multipart/form-data; boundary='+boundary)
    if existing:assert result.get('id')==existing['id'],'Unexpected updated file ID'
    assert isinstance(result.get('id'),int),'Upload response missing file ID; check CurseForge before retrying'
    receipt={'addon':addon,'operation':'updated' if existing else 'uploaded','releaseType':config['releaseType'],'version':config['version'],'projectId':config['projectId'],'fileId':result['id'],'sha256':config['sha256'],'url':'https://www.curseforge.com/wow/addons/'+config['slug']+'/files/'+str(result['id'])}
    (ROOT/('curseforge-result-'+addon+'.json')).write_text(json.dumps(receipt,indent=2))
    summary=('Updated release type for ' if existing else 'Uploaded ')+addon+' '+config['version']+': '+receipt['url']+'\nCurseForge approval may still be pending.\n'
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write(summary)
if __name__=='__main__':
    try:main()
    except Exception as error:
        print('ERROR:',str(error) or type(error).__name__);sys.exit(1)
