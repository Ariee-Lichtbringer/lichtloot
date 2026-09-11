"""Publish the approved clean ZIP. Tokens are only read from Actions secrets."""
import hashlib, json, os, re, sys, urllib.request, urllib.error, uuid, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
CF='https://wow.curseforge.com'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
OPEN=urllib.request.build_opener(NoRedirect)
def request(url,token,data=None,content_type='application/json',github=False):
    headers={'Accept':'application/json','User-Agent':'GuildLoot-Release/1.0','Content-Type':content_type}
    headers['Authorization' if github else 'X-Api-Token']=('Bearer ' if github else '')+token
    try:
        with OPEN.open(urllib.request.Request(url,data=data,headers=headers),timeout=90) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError(('GitHub' if github else 'CurseForge')+' API returned HTTP '+str(error.code)) from None
    except (urllib.error.URLError,TimeoutError):
        raise RuntimeError('Network response uncertain. Do not retry a reserved upload without checking CurseForge.') from None

def validate():
    config=json.loads((ROOT/'addon-release/release.json').read_text())
    assert config['projectId']==1689420,'Wrong project'
    version=config['version'];assert re.fullmatch(r'\d+\.\d+\.\d+-beta',version),'Invalid beta version'
    assert config['releaseType']=='beta' and config['gameVersion']=='1.15.9','Review game compatibility before changing it'
    data=(ROOT/'addon-release/GuildLootEra.zip').read_bytes()
    assert hashlib.sha256(data).hexdigest()==config['sha256'],'ZIP checksum mismatch'
    with zipfile.ZipFile(ROOT/'addon-release/GuildLootEra.zip') as archive:
        names=archive.namelist();assert len(names)==len(set(names)) and len(names)<500
        assert all(n.startswith('GuildLootEra/') and '..' not in n.split('/') for n in names),'Unexpected ZIP path'
        assert sum(i.file_size for i in archive.infolist())<24000000,'ZIP too large'
        assert archive.testzip() is None,'Damaged ZIP'
        assert archive.read('GuildLootEra/SyncData.lua')==b'GuildLootSyncInbox = nil\n','Personal sync data in release'
        toc=archive.read('GuildLootEra/GuildLootEra.toc').decode()
        assert '## Version: '+version+'\n' in toc and '## Interface: 11509\n' in toc
        loaded=[line.strip() for line in toc.splitlines() if line.strip() and not line.startswith('#')]
        allowed={'GuildLootEra/'+x for x in loaded+['GuildLootEra.toc','README.md','Media/GuildLootLogo.tga','PROFESSION-DATA-LICENSE.txt','PROFESSION-DATA-SOURCE.txt']}
        assert set(names)==allowed,'Unlisted file or missing TOC dependency'
    changelog=(ROOT/'addon-release/CHANGELOG.md').read_text().strip();assert changelog
    return config,data,changelog

def main():
    config,data,changelog=validate()
    if '--validate-only' in sys.argv:print('ZIP, version, manifest and clean file list verified.');return
    token=os.environ.get('CF_API_TOKEN','');assert token,'CF_API_TOKEN is missing'
    versions=request(CF+'/api/game/wow/versions',token)
    matches=[v for v in versions if v.get('name')==config['gameVersion'] and v.get('gameVersionTypeID')==67408]
    assert len(matches)==1,'Classic Era game version was not uniquely found'
    metadata={'displayName':'GuildLootEra-'+config['version'],'gameVersions':[matches[0]['id']],'releaseType':config['releaseType'],'changelog':changelog,'changelogType':'markdown'}
    print('ZIP and CurseForge connection verified; Classic Era '+config['gameVersion'])
    if os.environ.get('PUBLISH')!='true':print('Validation only; no upload requested.');return
    assert os.environ.get('GITHUB_REPOSITORY')=='Ariee-Lichtbringer/lichtloot','Wrong repository'
    gh=os.environ['GH_TOKEN'];ref='refs/tags/curseforge-upload/'+config['version']
    # Reserve before POST: even an uncertain response must not cause a double upload.
    request('https://api.github.com/repos/Ariee-Lichtbringer/lichtloot/git/refs',gh,json.dumps({'ref':ref,'sha':os.environ['GITHUB_SHA']}).encode(),github=True)
    boundary='GuildLoot'+uuid.uuid4().hex
    payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode()+json.dumps(metadata).encode()+f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="GuildLootEra-{config["version"]}.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode())
    result=request(CF+'/api/projects/1689420/upload-file',token,payload,'multipart/form-data; boundary='+boundary)
    assert isinstance(result.get('id'),int),'Upload response missing file ID; check CurseForge before retrying'
    receipt={'version':config['version'],'projectId':1689420,'fileId':result['id'],'sha256':config['sha256'],'url':'https://www.curseforge.com/wow/addons/guildloot-classic-era/files/'+str(result['id'])}
    (ROOT/'curseforge-result.json').write_text(json.dumps(receipt,indent=2))
    summary='Uploaded '+config['version']+': '+receipt['url']+'\nCurseForge approval may still be pending.\n'
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write(summary)
if __name__=='__main__':
    try:main()
    except Exception as error:
        print('ERROR:',str(error) or type(error).__name__);sys.exit(1)
