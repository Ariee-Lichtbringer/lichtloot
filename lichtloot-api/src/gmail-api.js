import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import nodemailer from 'nodemailer';

const SEND_SCOPE='https://www.googleapis.com/auth/gmail.send';
const digest=value=>createHash('sha256').update(value).digest('hex');
const problem=(message,code='GMAIL_NOT_READY',statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
export function createGmailApi({query,env=process.env,fetchImpl=fetch,compose=options=>nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'}).sendMail(options)}) {
  let schemaPromise;
  async function schema(){
    if(!schemaPromise)schemaPromise=(async()=>{
      await query(`create table if not exists platform_gmail_connection(id integer primary key check(id=1),email text not null,refresh_token text not null,connected_at timestamptz not null default now())`);
      await query(`create table if not exists platform_gmail_oauth_states(state_hash text primary key,binding_hash text not null,verifier text not null,expires_at timestamptz not null)`);
    })().catch(e=>{schemaPromise=null;throw e});
    return schemaPromise;
  }
  function settings(){return {clientId:String(env.GMAIL_OAUTH_CLIENT_ID||'').trim(),clientSecret:String(env.GMAIL_OAUTH_CLIENT_SECRET||'').trim(),email:String(env.GMAIL_USER||'').trim().toLowerCase(),key:Buffer.from(env.GMAIL_TOKEN_KEY||'','base64'),redirectUri:env.GMAIL_OAUTH_REDIRECT_URI||'https://lichtloot-production.up.railway.app/api/gmail/callback'};}
  function configured(){const c=settings();return !!(c.clientId&&c.clientSecret&&c.email&&c.key.length===32);}
  function encrypt(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',settings().key,iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');}
  function decrypt(value){const bytes=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',settings().key,bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');}
  async function request(url,options={},phase='auth'){
    let response;try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(20000)});}catch(e){throw problem(phase==='send'?'Gmail hat den Versand nicht bestätigt. Bitte im Ordner „Gesendet“ prüfen.':'Die Verbindung zu Google konnte nicht hergestellt werden.',phase==='send'?'GMAIL_UNKNOWN':'GMAIL_NOT_READY');}
    let body;try{body=await response.json();}catch(e){throw problem('Google hat keine gültige Antwort geliefert.',phase==='send'?'GMAIL_UNKNOWN':'GMAIL_NOT_READY');}
    if(!response.ok){
      if(response.status===401||body.error==='invalid_grant')throw problem('Die Google-Freigabe ist abgelaufen oder wurde widerrufen. Bitte Gmail erneut verbinden.','GMAIL_AUTH');
      throw problem(phase==='send'?'Gmail hat die Nachricht abgelehnt. Bitte Gmail-API, Freigabe und Empfänger prüfen.':'Die Google-Verknüpfung konnte nicht abgeschlossen werden. Bitte OAuth-Konfiguration und Gmail-API prüfen.',phase==='send'&&response.status>=500?'GMAIL_UNKNOWN':'GMAIL_REJECTED');
    }
    return body;
  }
  async function tokens(params){const c=settings();return request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,...params})});}
  async function status(){await schema();const row=(await query('select email,connected_at from platform_gmail_connection where id=1')).rows[0];return {configured:configured(),connected:!!row&&configured()&&row.email===settings().email,email:settings().email,connectedAt:row?.connected_at?new Date(row.connected_at).toISOString():'',redirectUri:settings().redirectUri};}
  async function start(){
    if(!configured())throw problem('Google-OAuth ist noch nicht eingerichtet. Client-ID und Client-Secret müssen in Railway hinterlegt sein.');
    await schema();await query('delete from platform_gmail_oauth_states where expires_at<now()');
    const state=randomBytes(32).toString('base64url'),binding=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),c=settings();
    await query("insert into platform_gmail_oauth_states(state_hash,binding_hash,verifier,expires_at) values($1,$2,$3,now()+interval '10 minutes')",[digest(state),digest(binding),encrypt(verifier)]);
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',scope:'openid email '+SEND_SCOPE,access_type:'offline',prompt:'consent',login_hint:c.email,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
    return {url:url.toString(),binding};
  }
  async function callback({state,code,binding,error}){
    if(!configured()||!state||!binding)throw problem('Diese Google-Freigabe ist ungültig. Bitte in der Administration neu starten.','GMAIL_AUTH',400);
    await schema();const claimed=(await query('delete from platform_gmail_oauth_states where state_hash=$1 and binding_hash=$2 and expires_at>now() returning verifier',[digest(state),digest(binding)])).rows[0];
    if(!claimed)throw problem('Die Google-Freigabe ist abgelaufen oder wurde bereits verwendet. Bitte neu starten.','GMAIL_AUTH',400);
    if(error||!code)throw problem('Die Google-Freigabe wurde nicht erteilt.','GMAIL_AUTH',400);
    const t=await tokens({code,code_verifier:decrypt(claimed.verifier),redirect_uri:settings().redirectUri,grant_type:'authorization_code'});
    if(!t.access_token||!t.refresh_token||!String(t.scope||'').split(' ').includes(SEND_SCOPE))throw problem('Die dauerhafte Gmail-Sendefreigabe fehlt. Bitte erneut verbinden und E-Mail-Versand erlauben.','GMAIL_AUTH',400);
    const user=await request('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+t.access_token}});
    if(user.email_verified!==true||String(user.email||'').toLowerCase()!==settings().email)throw problem('Bitte ausschließlich das in GuildLoot hinterlegte Gmail-Konto verbinden.','GMAIL_AUTH',400);
    await query('insert into platform_gmail_connection(id,email,refresh_token) values(1,$1,$2) on conflict(id) do update set email=excluded.email,refresh_token=excluded.refresh_token,connected_at=now()',[settings().email,encrypt(t.refresh_token)]);
    return {connected:true,email:settings().email};
  }
  async function accessToken(){
    if(!configured())throw problem('Gmail ist noch nicht über Google verbunden.');await schema();
    const row=(await query('select email,refresh_token from platform_gmail_connection where id=1')).rows[0];
    if(!row||row.email!==settings().email)throw problem('Bitte Gmail in der Administration verbinden.');
    let refresh;try{refresh=decrypt(row.refresh_token);}catch(e){throw problem('Gmail-Verknüpfung konnte nicht entschlüsselt werden. Bitte erneut verbinden.');}
    const t=await tokens({grant_type:'refresh_token',refresh_token:refresh});if(!t.access_token)throw problem('Google hat keinen Zugriffstoken geliefert.');return t.access_token;
  }
  async function verify(){const token=await accessToken();const user=await request('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token}});if(user.email_verified!==true||String(user.email||'').toLowerCase()!==settings().email)throw problem('Die Google-Freigabe gehört nicht zum hinterlegten Konto.','GMAIL_AUTH');return {verified:true,email:settings().email};}
  async function sendMail(options){
    // Prepare/refresh before submitting: failures here cannot have delivered mail.
    const token=await accessToken();let compiled;
    try{compiled=await compose({...options,from:{name:'GuildLoot Support',address:settings().email},disableFileAccess:true,disableUrlAccess:true});}catch(e){throw problem('Die E-Mail konnte nicht erstellt werden.','GMAIL_REJECTED');}
    const data=await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(compiled.message).toString('base64url')})},'send');
    if(!data.id)throw problem('Gmail hat den Versand nicht bestätigt.','GMAIL_UNKNOWN');
    return {messageId:data.id,accepted:[options.to],rejected:[]};
  }
  return {status,start,callback,verify,sendMail};
}
