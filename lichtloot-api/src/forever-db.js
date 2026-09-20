import pg from 'pg';
import {timingSafeEqual} from 'node:crypto';
const unavailable=()=>Object.assign(new Error('Die Forever-Datenbank ist noch nicht verfügbar. Bitte später erneut versuchen.'),{statusCode:503});
// Never fall back to the Era database, including when configuration is missing.
export const foreverPool=process.env.FOREVER_DATABASE_URL?new pg.Pool({connectionString:process.env.FOREVER_DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false,max:5,connectionTimeoutMillis:5000,statement_timeout:12000,application_name:'guildloot-forever'}):null;
foreverPool?.on('error',()=>console.error('Forever-Datenbank: Verbindungsfehler'));
export const foreverQuery=(sql,params=[])=>{if(!foreverPool)throw unavailable();return foreverPool.query(sql,params);};
export function createForeverAccess(query){
 const requireGuild=async slug=>{const r=await query("select g.* from guilds g join guild_settings s on s.guild_id=g.id where g.slug=$1 and s.layout_json->>'game'='forever'",[slug]);if(!r.rows.length)throw Object.assign(new Error('Forever-Gilde nicht gefunden.'),{statusCode:404});return r.rows[0];};
 const authorize=async(guild,body)=>{
  if(String(body.masterCode||'').trim()){const r=await query('select master_code from guild_master_codes where guild_id=$1',[guild.id]);const actual=Buffer.from(r.rows[0]?.master_code||''),given=Buffer.from(String(body.masterCode).trim());if(!actual.length||actual.length!==given.length||!timingSafeEqual(actual,given))throw Object.assign(new Error('Ungültiger Forever-Leitungscode.'),{statusCode:403});return {canManage:true,canAdmin:true,playerId:null,label:'Gildenleitung'};}
  const r=await query("select p.id,p.role,(select c.name from forever_characters c where c.guild_id=p.guild_id and c.player_id=p.id order by c.created_at limit 1) as name from players p where p.guild_id=$1 and p.player_pin=$2 and p.approval_status='approved' and not p.is_blocked",[guild.id,String(body.playerPin||'').trim().toUpperCase()]);const p=r.rows[0];if(!p)throw Object.assign(new Error('Bitte mit einem freigegebenen Forever-SpielerLogin anmelden.'),{statusCode:403});return {playerId:p.id,canAdmin:p.role==='gildenleitung',canManage:['gildenleitung','gildenoffiziere','raidoffiziere'].includes(p.role),label:p.name||'Gildenmitglied'};
 };
 const listGuilds=async()=>({success:true,guilds:(await query("select g.slug,g.name,g.logo_url,g.background_url,s.layout_json from guilds g join guild_settings s on s.guild_id=g.id where s.layout_json->>'game'='forever' order by g.name")).rows.map(g=>({slug:g.slug,name:g.name,logoUrl:g.logo_url||'',backgroundUrl:g.background_url||'',layout:g.layout_json}))});
 return {requireGuild,authorize,listGuilds};
}
export const foreverAccess=createForeverAccess(foreverQuery);
