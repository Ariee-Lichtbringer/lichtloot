export const OFFLINE_MESSAGE = "⚠️ **Bot vorübergehend offline**\n\nDer Bot ist für etwa **2 Stunden offline**.\n**P0-Eintragungen über LichtLoot oder NachtLoot sind weiterhin möglich.**";
export const UPDATE_MESSAGE = "🛠️ **GuildLoot vorübergehend nicht erreichbar**\n\nGuildLoot ist gerade nicht erreichbar, da ein Update durchgeführt wird.";
export function noticeContent(kind = "bot") {
  if (kind === "bot") return OFFLINE_MESSAGE;
  if (kind === "update") return UPDATE_MESSAGE;
  throw new Error("Unbekannter Hinweis-Typ.");
}

// Only configured posting destinations and recorded bot posts, never every
// channel the bot can access. One owner per channel avoids duplicate notices.
export function collectOfflineTargets(guilds, posts, channels) {
  const targets = new Map();
  const add = (guild, channelId, bot) => {
    channelId = String(channelId || "").trim();
    if (!/^\d+$/.test(channelId) || !guild?.discordGuildId) return;
    const known = channels.find(c => c.channel_id === channelId);
    if (known?.discord_guild_id && known.discord_guild_id !== guild.discordGuildId) return;
    if (!targets.has(channelId)) targets.set(channelId, {guildId:guild.guildId, guildSlug:guild.slug, discordGuildId:guild.discordGuildId, channelId, channelName:known?.channel_name || channelId, bot});
  };
  for (const guild of guilds) {
    const layout = guild.layout || {};
    for (const key of ["worldbuffChannelId", "hordenbuffChannelId", "worldbuffBackupChannelId", "logAnalysisChannelId"]) add(guild, layout[key], "lichtbuff");
    for (const key of ["raidAnnouncementChannelId", "p0PlusBackupChannelId"]) add(guild, layout[key], "po");
    for (const post of posts.filter(p => p.guild_id === guild.guildId)) add(guild, post.channel_id, post.bot);
  }
  return [...targets.values()];
}

export async function queueOfflineNotice(pool, targets, guildId, kind = "bot") {
  const content = noticeContent(kind);
  if (!guildId || targets.some(target => target.guildId !== guildId)) throw new Error("Hinweis enthält Channels einer anderen Gilde.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(73924061)");
    if (!targets.length) throw new Error("Keine Bot-Postchannels gefunden.");
    let queued=0;
    for (const target of targets) {
      const history=await client.query(`select id,type,payload,status from bot_update_queue
        where guild_id=$1 and coalesce(payload->>'noticeKind','bot')=$2
          and type in ('po_offline_notice','lichtbuff_offline_notice') and payload->>'channelId'=$3
        order by created_at desc,id desc`,[guildId,kind,target.channelId]);
      const latest=history.rows[0];
      const state=latest?.payload.noticeState || (latest?.payload.editOnly===true?'online':'offline');
      if(latest && state==='offline' && ['open','processing','done'].includes(latest.status))continue;
      if(latest && ['open','processing'].includes(latest.status))throw new Error("Die vorherige Hinweisänderung wird noch zugestellt. Bitte anschließend erneut versuchen.");
      const saved=history.rows.find(row=>/^\d+$/.test(row.payload.messageId||''));
      const payload={...target,noticeKind:kind,noticeState:'offline',content};
      if(saved){Object.assign(payload,{bot:saved.payload.bot,messageId:saved.payload.messageId,editOnly:true,sourceQueueId:saved.id});}
      await client.query(`insert into bot_update_queue(guild_id,type,payload,status) values($1,$2,$3::jsonb,'open')`,[guildId,payload.bot+"_offline_notice",JSON.stringify(payload)]);
      queued++;
    }
    await client.query("commit");
    return {success:true,queued:queued>0,alreadyQueued:queued===0,channelCount:queued};
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function onlineNoticeContent(kind = "bot") {
  noticeContent(kind);
  return kind === "bot" ? "✅ **PO Bot ist wieder erreichbar.**" : "✅ **GuildLoot ist wieder erreichbar.**";
}

export async function recoveryTargets(db, guildId, kind) {
  noticeContent(kind);
  const result = await db.query(`select distinct on (payload->>'channelId') id,type,payload,status
    from bot_update_queue where guild_id=$1
      and type in ('po_offline_notice','lichtbuff_offline_notice')
      and coalesce(payload->>'noticeKind','bot')=$2
    order by payload->>'channelId',created_at desc,id desc`,[guildId,kind]);
  const state=row=>row.payload.noticeState||(row.payload.editOnly===true?'online':'offline');
  const pendingCount=result.rows.filter(row=>['open','processing'].includes(row.status)).length;
  const targets=result.rows.filter(row=>row.status==='done' && state(row)==='offline' && /^\d+$/.test(row.payload.messageId||''))
    .map(row=>({...row.payload,guildId,sourceQueueId:row.id,editOnly:true,noticeState:'online',content:onlineNoticeContent(kind)}));
  return {targets,pending:pendingCount>0,pendingCount,alreadyQueued:result.rows.some(row=>state(row)==='online')};
}

export async function queueOnlineNotice(pool, guildId, kind) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(73924061)");
    const state = await recoveryTargets(client, guildId, kind);
    if (state.pending && !state.targets.length && !state.alreadyQueued) throw new Error("Der Offline-Hinweis wird noch zugestellt. Bitte kurz warten und erneut versuchen.");
    if (!state.targets.length && !state.alreadyQueued) throw new Error("Keine gespeicherte Offline-Nachricht zum Bearbeiten vorhanden.");
    for (const target of state.targets) {
      await client.query(`insert into bot_update_queue(guild_id,type,payload,status) values($1,$2,$3::jsonb,'open')`, [guildId, target.bot+"_offline_notice", JSON.stringify(target)]);
    }
    await client.query("commit");
    return {success:true,queued:state.targets.length>0,alreadyQueued:!state.targets.length,channelCount:state.targets.length,pendingCount:state.pendingCount};
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
