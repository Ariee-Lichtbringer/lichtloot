import {randomUUID} from 'node:crypto';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export function createEraImport({eraQuery,query,pool,requireGuild}){
 let ready;
 return async body=>{
  if(body.guild!=='lichtbringer-forever'||!['lichtloot','nachtloot'].includes(body.sourceGuild))throw fail('Übernahme nur von LichtLoot oder Nachtloot zu Lichtbringer Forever möglich.');
  const pin=String(body.playerPin||'').trim().toUpperCase();
  if(!pin||pin.length>120)throw fail('Bitte deinen bisherigen SpielerLogin-Code eingeben.');
  const source=(await eraQuery("select p.id,p.guild_id,p.security_question,p.security_answer from players p join guilds g on g.id=p.guild_id where g.slug=$1 and p.player_pin=$2 and p.approval_status='approved' and coalesce(p.is_blocked,false)=false",[body.sourceGuild,pin])).rows;
  if(source.length!==1)throw fail('Der SpielerLogin konnte nicht bestätigt werden. Bitte Herkunft und Code prüfen.',403);
  const guild=await requireGuild(body.guild),s=source[0];
  ready ||= query(`create table if not exists forever_era_imports(guild_id uuid not null references guilds(id),source_guild_id uuid not null,source_player_id uuid not null,player_id uuid not null references players(id),created_at timestamptz not null default now(),primary key(guild_id,source_guild_id,source_player_id),unique(guild_id,player_id))`).catch(e=>{ready=null;throw e;});await ready;
  const db=await pool.connect();
  try{
   await db.query('begin');
   await db.query('select pg_advisory_xact_lock(hashtext($1))',[guild.id+':'+s.guild_id+':'+s.id]);
   const existing=(await db.query('select p.approval_status,p.is_blocked,p.player_pin from forever_era_imports i join players p on p.id=i.player_id and p.guild_id=i.guild_id where i.guild_id=$1 and i.source_guild_id=$2 and i.source_player_id=$3',[guild.id,s.guild_id,s.id])).rows[0];
   if(existing){
    if(existing.is_blocked||existing.approval_status!=='approved')throw fail('Dein Forever-Zugang ist nicht freigegeben. Bitte kontaktiere die Gildenleitung.',403);
    await db.query('commit');return {success:true,alreadyImported:true,useExistingForeverCode:existing.player_pin!==pin,message:existing.player_pin===pin?'Dein Zugang wurde bereits übernommen. Melde dich mit deinem bisherigen Code an.':'Dein Zugang wurde bereits übernommen. Verwende deinen inzwischen geänderten Forever-Code.'};
   }
   const id=randomUUID();
   await db.query("insert into players(id,guild_id,player_pin,role,approval_status,security_question,security_answer) values($1,$2,$3,'member','approved',$4,$5)",[id,guild.id,pin,s.security_question,s.security_answer]);
   await db.query('insert into forever_era_imports(guild_id,source_guild_id,source_player_id,player_id) values($1,$2,$3,$4)',[guild.id,s.guild_id,s.id,id]);
   await db.query('commit');return {success:true,message:'Dein Zugang ist übernommen und freigeschaltet. Melde dich mit deinem bisherigen Code an und lege deinen Forever-Charakter an. Danach kannst du denselben Code im Discord-Anmelder verbinden.'};
  }catch(e){await db.query('rollback');if(e.code==='23505')throw fail('Der Code ist in Forever bereits vergeben. Bitte nutze deinen bestehenden Forever-Zugang oder kontaktiere die Gildenleitung.',409);throw e;}finally{db.release();}
 };
}
export function installEraImport(app,deps){const run=createEraImport(deps);app.post('/api/forever/import-era',async(req,res,next)=>{res.set('Cache-Control','no-store');try{deps.rateLimit(req,'forever-import-era',8,60*60*1000);res.json(await run(req.body||{}));}catch(e){next(e);}});}
