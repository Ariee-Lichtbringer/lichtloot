// Windows-Signierung für GuildLoot Sync über Azure Trusted Signing (jsign auf macOS/Linux).
// Wird von electron-builder als win.sign aufgerufen und signiert jede .exe (App, Installer, Deinstaller).
// Zugangsdaten kommen nur aus Umgebungsvariablen bzw. aus ~/.guildloot-signing.env (nie im Repo):
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
//   TRUSTED_SIGNING_ENDPOINT   z. B. https://weu.codesigning.azure.net
//   TRUSTED_SIGNING_ACCOUNT    Name des Trusted-Signing-Kontos
//   TRUSTED_SIGNING_PROFILE    Name des Zertifikatprofils
// Fehlen die Variablen, wird nicht signiert (Build läuft unsigniert weiter).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const JAVA=process.env.JSIGN_JAVA||'/opt/homebrew/opt/openjdk/bin/java';
const JSIGN=process.env.JSIGN_JAR||'/private/tmp/guildloot-builder-tools/jsign/jsign.jar';
function loadEnv(){
 const file=path.join(os.homedir(),'.guildloot-signing.env');
 if(!fs.existsSync(file))return;
 for(const line of fs.readFileSync(file,'utf8').split('\n')){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
}
let cachedToken=null;
async function accessToken(){
 if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.value;
 const body=new URLSearchParams({grant_type:'client_credentials',client_id:process.env.AZURE_CLIENT_ID,client_secret:process.env.AZURE_CLIENT_SECRET,scope:'https://codesigning.azure.net/.default'});
 const response=await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',body,signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok||!data.access_token)throw new Error('Azure-Anmeldung fehlgeschlagen: '+(data.error_description||response.status));
 cachedToken={value:data.access_token,expires:Date.now()+(Number(data.expires_in)||3600)*1000};
 return cachedToken.value;
}
function configured(){return ['AZURE_TENANT_ID','AZURE_CLIENT_ID','AZURE_CLIENT_SECRET','TRUSTED_SIGNING_ENDPOINT','TRUSTED_SIGNING_ACCOUNT','TRUSTED_SIGNING_PROFILE'].every(k=>process.env[k]);}
async function signFile(file){
 loadEnv();
 if(!configured()){console.warn('[sign] Azure Trusted Signing nicht konfiguriert – '+path.basename(file)+' bleibt unsigniert.');return false;}
 if(!fs.existsSync(JAVA)||!fs.existsSync(JSIGN))throw new Error('Java oder jsign fehlt: '+JAVA+' / '+JSIGN);
 const token=await accessToken();
 const endpoint=process.env.TRUSTED_SIGNING_ENDPOINT.replace(/^https?:\/\//,'');
 execFileSync(JAVA,['-jar',JSIGN,'--storetype','TRUSTEDSIGNING','--keystore',endpoint,'--storepass',token,'--alias',`${process.env.TRUSTED_SIGNING_ACCOUNT}/${process.env.TRUSTED_SIGNING_PROFILE}`,'--tsaurl','http://timestamp.acs.microsoft.com','--tsmode','RFC3161','--alg','SHA-256','--name','GuildLoot Sync','--url','https://lichtloot.de',file],{stdio:['ignore','inherit','inherit']});
 console.log('[sign] signiert: '+path.basename(file));return true;
}
// electron-builder: module.exports = async (configuration) => …
module.exports=async function(configuration){await signFile(configuration.path);};
module.exports.signFile=signFile;
module.exports.configured=()=>{loadEnv();return configured();};
if(require.main===module){(async()=>{for(const file of process.argv.slice(2)){await signFile(path.resolve(file));}})().catch(e=>{console.error(e.message);process.exit(1);});}
