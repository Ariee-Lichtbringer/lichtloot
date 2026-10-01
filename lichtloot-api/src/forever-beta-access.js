import {randomUUID, randomBytes, timingSafeEqual} from 'node:crypto';
export const betaDungeons = {ragefire:'Ragefireabgrund',deadmines:'Todesminen',wailing:'Höhlen des Wehklagens',shadowfang:'Burg Schattenfang',blackfathom:'Tiefschwarze Grotte',stockades:'Verlies',razorfen:'Kral der Klingenhauer',gnomeregan:'Gnomeregan'};
export const isBetaDungeon=kind=>kind==='dungeon'||Object.hasOwn(betaDungeons,kind);
const fail=(m,s=400)=>Object.assign(new Error(m),{statusCode:s});
export function betaName(value){const name=String(value||'').trim().normalize('NFC').replace(/\s+/g,' ');if(!/^[\p{L}\p{M}][\p{L}\p{M} '\-’]{1,59}$/u.test(name))throw fail('Bitte einen Charakternamen mit 2–60 Zeichen eingeben.');return name;}
export function betaEnabled(guild){try{return !!JSON.parse(process.env.FOREVER_BETA_PINS||'{}')[guild.slug];}catch{return false;}}
export function verifyBetaPin(guild,pin){let expected;try{expected=JSON.parse(process.env.FOREVER_BETA_PINS||'{}')[guild.slug];}catch{}const a=Buffer.from(String(expected||'')),b=Buffer.from(String(pin||'').trim());if(!a.length||a.length!==b.length||!timingSafeEqual(a,b))throw fail('Gilde oder Beta-PIN stimmt nicht.',403);}
export const betaSpecs={"warrior": {"Waffen": "dd", "Furor": "dd", "Schutz": "tank"}, "paladin": {"Heilig": "heal", "Schutz": "tank", "Vergeltung": "dd"}, "hunter": {"Tierherrschaft": "dd", "Treffsicherheit": "dd", "Überleben": "dd"}, "rogue": {"Meucheln": "dd", "Kampf": "dd", "Täuschung": "dd"}, "priest": {"Disziplin": "heal", "Heilig": "heal", "Schatten": "dd"}, "shaman": {"Elementar": "dd", "Verstärkung": "dd", "Wiederherstellung": "heal"}, "mage": {"Arkan": "dd", "Feuer": "dd", "Frost": "dd"}, "warlock": {"Gebrechen": "dd", "Dämonologie": "dd", "Zerstörung": "dd"}, "druid": {"Gleichgewicht": "dd", "Wildheit (Katze)": "dd", "Wildheit (Bär)": "tank", "Wiederherstellung": "heal"}};
const schema=`create table if not exists forever_beta_guests(guild_id uuid not null references guilds(id),name_key text not null,player_id uuid not null references players(id),character_id uuid not null references forever_characters(id),primary key(guild_id,name_key),unique(player_id)); alter table forever_beta_guests add column if not exists specialization text;`;
export function createBetaAccess({pool,query,raids}){
 let ready;async function ensure(){if(!ready)ready=query(schema).catch(e=>{ready=null;throw e;});return ready;}
 async function authorize(guild,body){
  verifyBetaPin(guild,body.betaPin);
  const name=betaName(body.characterName),key=name.toLocaleLowerCase('de');
  const className=String(body.className||'');if(!['warrior','paladin','hunter','rogue','priest','shaman','mage','warlock','druid'].includes(className))throw fail('Bitte eine Klasse auswählen.');
  const specialization=body.specialization===undefined?null:String(body.specialization);
  if(specialization!==null&&!Object.hasOwn(betaSpecs[className],specialization))throw fail('Bitte eine zur Klasse passende Skillung auswählen.');
  const role=specialization!==null?betaSpecs[className][specialization]:body.role===undefined?null:String(body.role);if(role!==null&&!['tank','dd','heal','melee','ranged'].includes(role))throw fail('Bitte eine gültige Rolle auswählen.');
  // Ensure the regular tables before creating the isolated, non-login guest records.
  await raids.run(guild,{label:'Beta',canManage:false},{action:'overview',page:0});await ensure();
  const db=await pool.connect();let guest;
  try{await db.query('begin');await db.query('select id from guilds where id=$1 for update',[guild.id]);guest=(await db.query('select * from forever_beta_guests where guild_id=$1 and name_key=$2',[guild.id,key])).rows[0];
   if(!guest){
    if((await db.query('select id from forever_characters where guild_id=$1 and lower(name)=lower($2)',[guild.id,name])).rows.length)throw fail('Dieser Name gehört bereits einem SpielerLogin. Bitte diesen Login oder einen anderen Beta-Namen verwenden.',409);
    const player=randomUUID(),character=randomUUID();
    await db.query("insert into players(id,guild_id,player_pin,role,approval_status,is_blocked,blocked_reason) values($1,$2,$3,'member','pending',true,'Beta-Gast: ausschließlich Instanzanmeldung mit Gilden-PIN')",[player,guild.id,randomBytes(32).toString('hex')]);
    await db.query("insert into forever_characters(id,guild_id,player_id,name,ruleset,class_name,role) values($1,$2,$3,$4,'normal',$5,$6)",[character,guild.id,player,name,className,role||'dd']);
    await db.query('insert into forever_beta_guests(guild_id,name_key,player_id,character_id) values($1,$2,$3,$4)',[guild.id,key,player,character]);guest={player_id:player,character_id:character};
   }else await db.query('update forever_characters set class_name=$3,role=coalesce($4,role) where guild_id=$1 and id=$2',[guild.id,guest.character_id,className,role]);
   if(specialization!==null)await db.query('update forever_beta_guests set specialization=$3 where guild_id=$1 and character_id=$2',[guild.id,guest.character_id,specialization]);
   await db.query('commit');
  }catch(e){await db.query('rollback');throw e;}finally{db.release();}
  return {playerId:guest.player_id,label:name+' (Beta)',canManage:false,canAdmin:false,isBeta:true,betaCharacterId:guest.character_id};
 }
 return {authorize};
}
