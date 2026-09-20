import {publishForeverDiscord,foreverDiscordSchema} from './forever-discord.js';
import { randomUUID } from 'node:crypto';
import {createForeverAdmin} from './forever-admin.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const clean = value => String(value ?? '').trim().normalize('NFC');
export const classes = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];
export const roles = ['tank', 'heal', 'dd'];
export const signupStates = ['signed', 'bench', 'late', 'tentative', 'absent'];
const raidStates = ['open', 'closed', 'cancelled', 'completed'];
const uuid = value => {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(clean(value))) throw fail('Ungültige Auswahl.');
  return clean(value);
};
const text = (value, maximum, label, optional = false) => {
  const result = clean(value);
  if ((!optional && !result) || result.length > maximum || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(result)) throw fail(`${label}: Bitte einen gültigen Wert mit höchstens ${maximum} Zeichen eingeben.`);
  return result;
};
const choice = (value, values, label) => {
  if (!values.includes(value)) throw fail(`${label}: Ungültige Auswahl.`);
  return value;
};
const integer = (value, min, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw fail(`Bitte eine ganze Zahl von ${min} bis ${max} eingeben.`);
  return number;
};
export function foreverCharacterName(firstName, lastName) {
  const first = text(firstName, 29, 'Vorname'), last = text(lastName, 30, 'Nachname');
  if (![first,last].every(part => /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(part))) throw fail('Vor- und Nachname dürfen Buchstaben, Bindestriche und Apostrophe enthalten.');
  return first + ' ' + last;
}
export function raidInput(body) {
  const date = clean(body.date), time = clean(body.time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw fail('Bitte ein gültiges Datum und eine Uhrzeit eingeben.');
  const size = integer(body.size, 1, 40), tanks = integer(body.tanks, 0, 40), heals = integer(body.heals, 0, 40);
  if (tanks + heals > size) throw fail('Tanks und Heiler dürfen zusammen nicht mehr Plätze als die Gruppe belegen.');
  return {
    title: text(body.title, 100, 'Titel'), date, time, size, tanks, heals,
    kind: choice(body.kind, ['hyjal', 'barrow', 'onyxia', 'dungeon', 'other'], 'Ziel'),
    groupId: body.groupId ? uuid(body.groupId) : null,
    description: text(body.description, 1500, 'Beschreibung', true),
    status: choice(body.status || 'open', raidStates, 'Status')
  };
}

export const foreverSchema = `
create table if not exists forever_groups (
 id uuid primary key, guild_id uuid not null references guilds(id) on delete cascade,
 name text not null, created_at timestamptz not null default now(), unique(guild_id,id)
);
create unique index if not exists forever_groups_name on forever_groups(guild_id,lower(name));
create table if not exists forever_characters (
 id uuid primary key, guild_id uuid not null references guilds(id) on delete cascade,
 player_id uuid not null references players(id) on delete cascade,
 name text not null, ruleset text not null check(ruleset in ('normal','pvp','rp')),
 class_name text not null, role text not null check(role in ('tank','heal','dd')),
 created_at timestamptz not null default now(), unique(guild_id,id)
);
create unique index if not exists forever_characters_name on forever_characters(guild_id,ruleset,lower(name));
create table if not exists forever_raids (
 id uuid primary key, guild_id uuid not null references guilds(id) on delete cascade,
 group_id uuid, title text not null, kind text not null,
 starts_at timestamptz not null, size integer not null check(size between 1 and 40),
 tanks integer not null, heals integer not null, description text not null default '',
 status text not null check(status in ('open','closed','cancelled','completed')),
 revision integer not null default 1, created_at timestamptz not null default now(),
 unique(guild_id,id), foreign key(guild_id,group_id) references forever_groups(guild_id,id)
);
create index if not exists forever_raids_calendar on forever_raids(guild_id,starts_at);
create table if not exists forever_signups (
 guild_id uuid not null, raid_id uuid not null, player_id uuid not null references players(id) on delete cascade,
 character_id uuid not null, role text not null check(role in ('tank','heal','dd')),
 status text not null check(status in ('signed','bench','late','tentative','absent')),
 note text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(guild_id,raid_id,player_id),
 foreign key(guild_id,raid_id) references forever_raids(guild_id,id) on delete cascade,
 foreign key(guild_id,character_id) references forever_characters(guild_id,id)
);
create table if not exists forever_audit (
 id bigserial primary key, guild_id uuid not null references guilds(id) on delete cascade,
 raid_id uuid, action text not null, actor text not null, detail text not null,
 created_at timestamptz not null default now()
);`;

export function createForeverRaids({ pool, query }) {
  const admin=createForeverAdmin({pool,query});
  let schema;
  const ensure = () => schema ||= query(foreverSchema+foreverDiscordSchema).catch(error => { schema = null; throw error; });
  const requireLead = actor => { if (!actor.canManage) throw fail('Nur die Gildenleitung und Raidleitung können Termine verwalten.', 403); };
  async function transaction(work) {
    const client = await pool.connect();
    try { await client.query('begin'); const result = await work(client); await client.query('commit'); return result; }
    catch (error) { await client.query('rollback'); if (error.code === '23505') throw fail('Dieser Name ist in eurer Gilde bereits vergeben.', 409); throw error; }
    finally { client.release(); }
  }
  const audit = (db, guild, actor, raid, action, detail) => db.query('insert into forever_audit(guild_id,raid_id,action,actor,detail) values($1,$2,$3,$4,$5)', [guild.id, raid, action, actor.label, detail]);
  async function run(guild, actor, body) {
    await ensure();
    const action = body.action;
    if(action==='discordPublish')return publishForeverDiscord(query,guild,actor,body);
    if(["adminOverview","adminPlayer","adminSettings"].includes(action))return admin.run(guild,actor,body);
    if (action === 'overview') {
      const groups = await query('select id,name from forever_groups where guild_id=$1 order by lower(name)', [guild.id]);
      const characters = actor.playerId ? await query('select id,name,ruleset,class_name,role from forever_characters where guild_id=$1 and player_id=$2 order by lower(name)', [guild.id, actor.playerId]) : { rows: [] };
      // Upcoming events and a bounded archive are returned with signup data in one snapshot.
      const raids = await query(`select r.*, to_char(r.starts_at at time zone 'Europe/Berlin','YYYY-MM-DD') as date,
        to_char(r.starts_at at time zone 'Europe/Berlin','HH24:MI') as time, g.name as group_name,
        coalesce((select json_agg(json_build_object('characterId',c.id,'name',c.name,'className',c.class_name,
          'ruleset',c.ruleset,'role',s.role,'status',s.status,'note',s.note,'mine',s.player_id=$2::uuid)
          order by s.created_at,c.name) from forever_signups s join forever_characters c on c.id=s.character_id and c.guild_id=s.guild_id
          where s.guild_id=r.guild_id and s.raid_id=r.id),'[]'::json) as signups
        from forever_raids r left join forever_groups g on g.id=r.group_id and g.guild_id=r.guild_id
        where r.guild_id=$1 and ${body.archive === true ? "(r.starts_at < now() or r.status in ('completed','cancelled'))" : "r.starts_at >= now() and r.status not in ('completed','cancelled')"}
        and ($3::uuid is null or r.id=$3)
        order by r.starts_at ${body.archive === true ? 'desc' : 'asc'}, r.id limit 100`, [guild.id, actor.playerId || null, body.raidId?uuid(body.raidId):null]);
      const settings=await query("select coalesce(layout_json->'forever','{}'::jsonb) as config from guild_settings where guild_id=$1",[guild.id]);
      const config=settings.rows[0]?.config||{};
      const discord=(await query('select discord_guild_id,channel_id from forever_discord_channels where guild_id=$1',[guild.id])).rows[0]||null;
      const discordPosts=actor.canManage?(await query('select raid_id,message_id,channel_id,discord_guild_id,last_error from forever_discord_posts where guild_id=$1',[guild.id])).rows:[];
      return { success: true, discord,discordPosts, settings:{rules:config.rules||'',discordUrl:config.discordUrl||''}, guild: { slug: guild.slug, name: guild.name }, actor: { canAdmin:!!actor.canAdmin, canManage: actor.canManage, canSignup: !!actor.playerId, label: actor.label }, groups: groups.rows, characters: characters.rows, raids: raids.rows };
    }
    if (action === 'saveCharacter') {
      if (!actor.playerId) throw fail('Für eigene Charaktere bitte mit dem SpielerLogin anmelden.', 403);
      const id = body.id ? uuid(body.id) : randomUUID(), name = body.firstName !== undefined || body.lastName !== undefined ? foreverCharacterName(body.firstName,body.lastName) : text(body.name, 60, 'Charaktername');
      const ruleset = choice(body.ruleset, ['normal','pvp','rp'], 'Regelwerk'), cls = choice(body.className, classes, 'Klasse'), role = choice(body.role, roles, 'Rolle');
      return transaction(async db => {
        // Serialize character edits per account, then lock any name being updated.
        await db.query('select id from players where id=$1 and guild_id=$2 for update', [actor.playerId,guild.id]);
        if (body.id) {
          const result = await db.query('update forever_characters set name=$4,ruleset=$5,class_name=$6,role=$7 where guild_id=$1 and player_id=$2 and id=$3 returning id', [guild.id, actor.playerId,id,name,ruleset,cls,role]);
          if (!result.rows.length) throw fail('Eigener Charakter wurde nicht gefunden.',404);
        } else {
          const count = await db.query('select count(*)::int as count from forever_characters where guild_id=$1 and player_id=$2', [guild.id,actor.playerId]);
          if (count.rows[0].count >= 20) throw fail('Es sind maximal 20 Forever-Charaktere pro SpielerLogin möglich.');
          await db.query('insert into forever_characters(id,guild_id,player_id,name,ruleset,class_name,role) values($1,$2,$3,$4,$5,$6,$7)',[id,guild.id,actor.playerId,name,ruleset,cls,role]);
        }
        await audit(db,guild,actor,null,'character',name);
        return {success:true,id};
      });
    }
    if (action === 'saveGroup') {
      requireLead(actor);
      const name = text(body.name,60,'Gruppenname'), id = body.id ? uuid(body.id) : randomUUID();
      return transaction(async db => {
        if(body.id) {
          const result=await db.query('update forever_groups set name=$3 where guild_id=$1 and id=$2 returning id',[guild.id,id,name]);
          if(!result.rows.length) throw fail('Gruppe nicht gefunden.',404);
        } else await db.query('insert into forever_groups(id,guild_id,name) values($1,$2,$3)',[id,guild.id,name]);
        await audit(db,guild,actor,null,'group',name); return {success:true,id};
      });
    }
    if (action === 'saveRaid') {
      requireLead(actor);
      const value=raidInput(body), id=body.id?uuid(body.id):randomUUID();
      return transaction(async db => {
        if(value.groupId && !(await db.query('select id from forever_groups where guild_id=$1 and id=$2',[guild.id,value.groupId])).rows.length) throw fail('Diese Gruppe gehört nicht zu eurer Gilde.',404);
        const values=[guild.id,id,value.groupId,value.title,value.kind,`${value.date} ${value.time}`,value.size,value.tanks,value.heals,value.description,value.status];
        if(body.id) {
          const previous=(await db.query('select * from forever_raids where guild_id=$1 and id=$2 for update',[guild.id,id])).rows[0];
          if(!previous) throw fail('Termin nicht gefunden.',404);
          if(previous.revision!==integer(body.revision,1,2147483647)) throw fail('Der Termin wurde inzwischen geändert. Bitte neu laden.',409);
          const count=(await db.query("select count(*)::int as count from forever_signups where guild_id=$1 and raid_id=$2 and status='signed'",[guild.id,id])).rows[0].count;
          if(count>value.size) throw fail('Die Gruppe hat mehr Zusagen als die neue Größe. Bitte zuerst die Ersatzbank anpassen.',409);
          await db.query(`update forever_raids set group_id=$3,title=$4,kind=$5,starts_at=$6::timestamp at time zone 'Europe/Berlin',size=$7,tanks=$8,heals=$9,description=$10,status=$11,revision=revision+1 where guild_id=$1 and id=$2`,values);
        } else await db.query(`insert into forever_raids(guild_id,id,group_id,title,kind,starts_at,size,tanks,heals,description,status) values($1,$2,$3,$4,$5,$6::timestamp at time zone 'Europe/Berlin',$7,$8,$9,$10,$11)`,values);
        await audit(db,guild,actor,id,body.id?'raid_updated':'raid_created',`${value.title} · ${value.date} ${value.time} · ${value.status}`);
        return {success:true,id};
      });
    }
    if(action==='signup' || action==='manageSignup') {
      const manage=action==='manageSignup';
      if(manage) requireLead(actor);
      else if(!actor.playerId) throw fail('Bitte mit dem SpielerLogin anmelden.',403);
      const raidId=uuid(body.raidId), characterId=uuid(body.characterId), role=choice(body.role,roles,'Rolle');
      let status=choice(body.status,signupStates,'Anmeldestatus');
      const note=text(body.note,240,'Notiz',true);
      return transaction(async db => {
        const raid=(await db.query('select * from forever_raids where guild_id=$1 and id=$2 for update',[guild.id,raidId])).rows[0];
        if(!raid) throw fail('Termin nicht gefunden.',404);
        if(['cancelled','completed'].includes(raid.status) || (!manage && (raid.status!=='open' || new Date(raid.starts_at)<=new Date()))) throw fail('Die Anmeldung für diesen Termin ist geschlossen.',409);
        const character=(await db.query('select * from forever_characters where guild_id=$1 and id=$2',[guild.id,characterId])).rows[0];
        if(!character || (!manage && character.player_id!==actor.playerId)) throw fail('Dieser Charakter gehört nicht zu deinem SpielerLogin.',403);
        if(manage && !(await db.query('select character_id from forever_signups where guild_id=$1 and raid_id=$2 and character_id=$3',[guild.id,raidId,characterId])).rows.length) throw fail('Anmeldung nicht gefunden.',404);
        const count=(await db.query("select count(*)::int as count from forever_signups where guild_id=$1 and raid_id=$2 and status='signed' and player_id<>$3",[guild.id,raidId,character.player_id])).rows[0].count;
        if(status==='signed' && count>=raid.size) {
          if(manage) throw fail('Alle Plätze sind belegt. Bitte zuerst einen Platz freigeben.',409);
          status='bench';
        }
        await db.query(`insert into forever_signups(guild_id,raid_id,player_id,character_id,role,status,note) values($1,$2,$3,$4,$5,$6,$7)
          on conflict(guild_id,raid_id,player_id) do update set character_id=excluded.character_id,role=excluded.role,status=excluded.status,note=excluded.note,updated_at=now()`,[guild.id,raidId,character.player_id,characterId,role,status,note]);
        await audit(db,guild,actor,raidId,'signup',`${character.name} · ${role} · ${status}`);
        return {success:true,status};
      });
    }
    if(action==='history') {
      requireLead(actor);
      const rows=await query('select action,actor,detail,created_at from forever_audit where guild_id=$1 and raid_id=$2 order by id desc limit 50',[guild.id,uuid(body.raidId)]);
      return {success:true,history:rows.rows};
    }
    throw fail('Unbekannte Forever-Aktion.');
  }
  return { run };
}

export function installForeverRaids(app, dependencies) {
  const service=createForeverRaids(dependencies);
  app.post('/api/forever',async(req,res,next)=>{
    res.set('Cache-Control','no-store');
    try {
      const body=req.body||{};
      dependencies.rateLimit(req,'forever',120,15*60*1000);
      const guild=await dependencies.requireGuild(dependencies.explicitGuild(body.guild));
      const actor=await dependencies.authorize(guild,body);
      return res.json(await service.run(guild,actor,body));
    } catch(error) { next(error); }
  });
}
