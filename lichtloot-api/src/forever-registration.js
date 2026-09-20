import {randomUUID} from 'node:crypto';
import {foreverCharacterName,foreverSchema,classes,roles} from './forever-raids.js';
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export function registrationInput(body){
 const name=foreverCharacterName(body.firstName,body.lastName),pin=String(body.playerPin||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{8,32}$/.test(pin))throw fail('Wähle einen eigenen Login-Code mit 8–32 Buchstaben und Ziffern.');
 if(!classes.includes(body.className)||!roles.includes(body.role)||!['normal','pvp','rp'].includes(body.ruleset))throw fail('Bitte Klasse, Rolle und Regelwerk auswählen.');
 const question=String(body.securityQuestion||'').trim(),answer=String(body.securityAnswer||'').trim();
 if(question.length<5||question.length>200||answer.length<3||answer.length>200)throw fail('Bitte Sicherheitsfrage und Antwort ausfüllen.');
 return {name,pin,question,answer,className:body.className,role:body.role,ruleset:body.ruleset};
}
export function installForeverRegistration(app,deps){
 app.post('/api/forever/register',async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  try{
   deps.rateLimit(req,'forever-register',8,60*60*1000);
   const body=req.body||{},guild=await deps.requireGuild(deps.explicitGuild(body.guild));await deps.requireForeverGuild(guild);
   const input=registrationInput(body),answerHash=await deps.hashSecurityAnswer(input.answer);
   await deps.query(foreverSchema);
   const db=await deps.pool.connect();
   try{
    await db.query('begin');const playerId=randomUUID(),characterId=randomUUID();
    await db.query("insert into players(id,guild_id,player_pin,role,approval_status,security_question,security_answer) values($1,$2,$3,'member','pending',$4,$5)",[playerId,guild.id,input.pin,input.question,answerHash]);
    await db.query('insert into characters(player_id,name,server,class_name,is_main) values($1,$2,$3,$4,true)',[playerId,input.name,'Forever',input.className]);
    await db.query('insert into forever_characters(id,guild_id,player_id,name,ruleset,class_name,role) values($1,$2,$3,$4,$5,$6,$7)',[characterId,guild.id,playerId,input.name,input.ruleset,input.className,input.role]);
    await db.query('commit');
   }catch(e){await db.query('rollback');if(e.code==='23505')throw fail('Dieser Login-Code oder vollständige Charaktername ist in der Gilde bereits vergeben.',409);throw e;}finally{db.release();}
   res.json({success:true,pending:true,message:'Dein Forever-Zugang wurde angelegt. Die Gildenleitung muss ihn noch freigeben.'});
  }catch(e){next(e);}
 });
}
