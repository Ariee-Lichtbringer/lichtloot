const fail = (message, statusCode = 400) => Object.assign(new Error(message), {statusCode});
const identity = c => `${c.name.trim().toLowerCase()}\0${c.server.trim().toLowerCase()}`;

// An additional guild membership gets its own character IDs. Raid records,
// balances, release decisions and administrative permissions remain guild-local.
export function createAccountGuildTransfer({pool, query}) {
  let schema;
  const ensure = () => schema ||= query(`create table if not exists account_guild_transfers (
    id uuid primary key default gen_random_uuid(), source_guild_id uuid not null,
    target_guild_id uuid not null, source_player_id uuid not null, target_player_id uuid not null,
    added_characters integer not null, existing_characters integer not null,
    created_at timestamptz not null default now()
  )`).catch(error => {schema = null; throw error;});

  return async function transfer(sourceGuild, params, write = false) {
    const pin = typeof params.playerPin === 'string' ? params.playerPin.trim().toUpperCase() : '';
    if (!pin || pin.length > 100) throw fail('Bitte zuerst mit deinem SpielerLogin anmelden.', 403);
    if (write && params.confirmed !== true) throw fail('Bitte die Account-Übernahme zuerst prüfen und bestätigen.');
    await ensure();
    const db = await pool.connect();
    try {
      await db.query('begin');
      if (write) await db.query("select pg_advisory_xact_lock(hashtext($1),hashtext('account-guild-transfer'))", [pin]);
      const source = (await db.query(`select p.* from players p
        join guilds g on g.id=p.guild_id left join guild_settings gs on gs.guild_id=g.id
        where p.guild_id=$1 and p.player_pin=$2 and coalesce(gs.layout_json->>'game','era')='era'
        ${write ? 'for update of p' : ''}`, [sourceGuild.id,pin])).rows[0];
      if (!source || source.is_blocked || source.approval_status !== 'approved') {
        throw fail('Dein Account muss in der Ausgangsgilde freigegeben und nicht gesperrt sein.',403);
      }
      const guilds = (await db.query(`select g.id,g.slug,g.name from guilds g
        left join guild_settings gs on gs.guild_id=g.id
        where g.id<>$1 and coalesce(gs.layout_json->>'game','era')='era' order by g.name`, [sourceGuild.id])).rows;
      const characters = (await db.query(`select id,name,server,class_name,role,is_main from characters
        where player_id=$1 order by is_main desc,created_at,id ${write ? 'for update' : ''}`, [source.id])).rows;
      if (!characters.length) throw fail('Dein Account enthält noch keine Charaktere.');
      const base = {success:true,sourceGuild:{slug:sourceGuild.slug,name:sourceGuild.name},guilds:guilds.map(({slug,name})=>({slug,name})),
        characters:characters.map(c=>({name:c.name,server:c.server,className:c.class_name,isMain:c.is_main})),sourcePreserved:true};
      if (!params.targetGuild && !write) {await db.query('rollback'); return base;}
      const targetGuild = guilds.find(g=>g.slug===params.targetGuild);
      if (!targetGuild) throw fail('Bitte eine andere Classic-Era-Lootgilde auswählen.');
      let target = (await db.query(`select * from players where guild_id=$1 and player_pin=$2 ${write?'for update':''}`,[targetGuild.id,pin])).rows[0];
      if (target?.is_blocked || target?.approval_status==='rejected') throw fail('Der Account in der Zielgilde ist gesperrt oder abgelehnt. Bitte wende dich an deren Gildenleitung.',403);
      // Independently salted recovery hashes cannot be compared for equality.
      // Matching PINs alone must not authorize merging different accounts.
      const identityMismatch = target && (!source.security_answer || !source.security_question ||
        source.security_answer!==target.security_answer || source.security_question!==target.security_question);
      const targetCharacters = (await db.query(`select c.*,p.id as owner_id from characters c
        join players p on p.id=c.player_id where p.guild_id=$1`,[targetGuild.id])).rows;
      const matches = new Map();
      for (const c of characters) {
        const rows=targetCharacters.filter(t=>identity(t)===identity(c));
        if(rows.some(t=>t.owner_id!==target?.id)||rows.length>1) throw fail(`Der Charakter ${c.name} (${c.server}) ist in der Zielgilde bereits einem anderen oder mehrdeutigen Account zugeordnet. Bitte die Gildenleitung um Prüfung bitten.`,409);
        if(rows[0]) matches.set(c.id,rows[0]);
      }
      const approvalStatus=target?.approval_status||'pending';
      const plan={...base,targetGuild:{slug:targetGuild.slug,name:targetGuild.name},approvalStatus,
        addedCharacters:characters.length-matches.size,existingCharacters:matches.size,
        characters:base.characters.map((c,i)=>({...c,alreadyPresent:matches.has(characters[i].id)}))};
      if (identityMismatch) {
        if (plan.addedCharacters) throw fail('Der SpielerLogin ist in der Zielgilde bereits anders hinterlegt. Bitte die Gildenleitung um Prüfung bitten.',409);
        // Everything is already present: report success without changing any
        // destination data, credentials, main selection, approval or rights.
        await db.query('rollback');
        return write ? {...plan,completed:true} : plan;
      }
      if (!write) {await db.query('rollback'); return plan;}
      if(!target) target=(await db.query(`insert into players(guild_id,player_pin,security_question,security_answer,role,approval_status)
        values($1,$2,$3,$4,'member','pending') returning *`,[targetGuild.id,pin,source.security_question,source.security_answer])).rows[0];
      let hasMain=targetCharacters.some(c=>c.owner_id===target.id&&c.is_main);
      for(const c of characters){
        let dest=matches.get(c.id);
        if(!dest){
          const isMain=!hasMain&&c.is_main;
          dest=(await db.query(`insert into characters(player_id,name,server,class_name,role,is_main)
            values($1,$2,$3,$4,$5,$6) returning *`,[target.id,c.name,c.server,c.class_name,c.role,isMain])).rows[0];
          hasMain ||= isMain;
        } else if(!hasMain&&c.is_main) {
          await db.query('update characters set is_main=true,updated_at=now() where id=$1',[dest.id]);hasMain=true;
        }

      }
      await db.query(`insert into account_guild_transfers(source_guild_id,target_guild_id,source_player_id,target_player_id,added_characters,existing_characters)
        values($1,$2,$3,$4,$5,$6)`,[sourceGuild.id,targetGuild.id,source.id,target.id,plan.addedCharacters,plan.existingCharacters]);
      await db.query('commit');
      return {...plan,completed:true};
    } catch(error) {await db.query('rollback');throw error;} finally {db.release();}
  };
}
