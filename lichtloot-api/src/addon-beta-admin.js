import { createHash } from 'node:crypto';

export function betaInvitation(pin) {
  return `Hallo! 👋\n\nDu bist zum Betatest unseres GuildLoot-Addons für WoW Classic Era eingeladen.\n\n🔗 Download: https://lichtloot.de/start.html?addonBeta=1\n🔑 Deine Beta-PIN: ${pin}\n\nÖffne den Link, wähle Windows oder deinen Mac-Typ und gib die Beta-PIN ein. Öffne danach die heruntergeladene Installationsdatei. GuildLoot Sync enthält das Addon und startet nach der Installation. Klicke dort auf „Addon installieren / aktualisieren“ und wähle deinen WoW-Ordner. Zum Verbinden nutzt du deinen Spieler-PIN. Starte WoW nach der Addon-Installation neu.\n\nBitte melde uns Fehler und schreib dazu, was du gerade gemacht hast. Teile die Beta-PIN bitte nur nach Absprache weiter.\n\n📝 Fehler oder Verbesserung melden: https://lichtloot.de/addon-beta-feedback.html\n\nVielen Dank fürs Testen!\nAriee / GuildLoot`;
}

export function installAddonBetaAdmin(app, { query, transaction, authorize, ensureMembers, ensureMailbox, enqueue, rateLimit, feedback,
  pin = process.env.ADDON_BETA_PIN || '', pinHash = process.env.ADDON_BETA_PIN_SHA256 || '',
}) {
  const campaign = 'addon-beta:' + pinHash.slice(0, 16);
  const title = 'GuildLoot-Addon · Einladung zum Betatest';
  function config() {
    if (!/^\d{8}$/.test(pin) || createHash('sha256').update(pin).digest('hex') !== pinHash) {
      throw Object.assign(new Error('Die Beta-Einladung ist noch nicht konfiguriert.'), {statusCode:503});
    }
  }
  async function members() {
    const result = await query(`select distinct on (m.user_id) m.user_id as id, m.guild_id, g.slug,
      m.username, coalesce(nullif(m.display_name,''),nullif(m.global_name,''),m.username) as name,
      g.name as guild_name
      from discord_bot_members m join guilds g on g.id=m.guild_id
      where m.bot=false and m.user_id ~ '^[0-9]{15,22}$'
      order by m.user_id, m.updated_at desc, m.guild_id`);
    return result.rows;
  }
  function route(path, handler) {
    app.post(path, async (req,res) => {
      res.set('Cache-Control','no-store');
      try {
        rateLimit(req,'addon-beta-admin',60,15*60*1000);
        authorize(req.body?.masterCode); config();
        await ensureMembers(); await ensureMailbox();
        res.json({success:true,...await handler(req.body || {})});
      } catch(error) {
        res.status(error.statusCode || 500).json({success:false,error:error.statusCode ? error.message : 'Beta-Einladungen konnten nicht verarbeitet werden. Bitte erneut laden.'});
      }
    });
  }
  route('/api/admin/addon-beta/state', async body => {
    const history = await query(`select id, substring(player_pin from 9) as "recipientId", delivery_status as status,
      delivery_error as error, created_at as "createdAt" from player_messages
      where sender_player_pin=$1 order by created_at desc limit 500`,[campaign]);
    return {pin,title,message:betaInvitation(pin),members:await members(),history:history.rows,feedback:await feedback(body.masterCode)};
  });
  route('/api/admin/addon-beta/send', async body => {
    const ids = Array.isArray(body.recipientIds) ? [...new Set(body.recipientIds)] : [];
    if (!/^[0-9a-f-]{36}$/i.test(body.requestId || '') || !ids.length || ids.length>20 || ids.some(id=>typeof id!=='string'||!/^\d{15,22}$/.test(id))) {
      throw Object.assign(new Error('Bitte 1 bis 20 Discord-Nutzer auswählen.'),{statusCode:400});
    }
    const available = await members();
    const selected = ids.map(id=>available.find(m=>m.id===id));
    if(selected.some(m=>!m)) throw Object.assign(new Error('Ein Discord-Nutzer ist nicht mehr verfügbar. Bitte die Liste neu laden.'),{statusCode:400});
    const results = await transaction(async () => {
      const results=[];
      // Stable ordering avoids deadlocks for overlapping recipient selections.
      for(const member of selected.sort((a,b)=>a.id.localeCompare(b.id))) {
        const recipient = 'discord:'+member.id;
        await query('select pg_advisory_xact_lock(hashtext($1))',[campaign+recipient]);
        const previous=await query(`select id,delivery_status as status from player_messages
          where sender_player_pin=$1 and player_pin=$2 and delivery_status in ('queued','delivered')
          order by created_at desc limit 1`,[campaign,recipient]);
        if(previous.rows[0]) {results.push({recipientId:member.id,...previous.rows[0],skipped:true});continue;}
        const hex=createHash('sha256').update(campaign+body.requestId+member.id).digest('hex').slice(0,32);
        const id=hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
        const saved=await query(`insert into player_messages(id,guild_id,player_pin,sender,sender_player_pin,title,body,delivery_channel,delivery_status)
          values($1,$2,$3,'Ariee / GuildLoot',$4,$5,$6,'discord','queued') on conflict(id) do nothing returning id`,
          [id,member.guild_id,recipient,campaign,title,betaInvitation(pin)]);
        if(saved.rows.length) await enqueue({guildId:member.guild_id,type:'player_mailbox_dm',payload:{messageId:id,discordUserId:member.id,guildSlug:member.slug,sender:'Ariee / GuildLoot',title,body:betaInvitation(pin)}});
        results.push({recipientId:member.id,id,status:'queued',skipped:!saved.rows.length});
      }
      return results;
    });
    return {results};
  });
}
