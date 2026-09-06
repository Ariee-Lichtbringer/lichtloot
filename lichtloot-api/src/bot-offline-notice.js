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
    const existing = await client.query(`select id from bot_update_queue where guild_id=$1 and coalesce(payload->>'noticeKind','bot')=$2 and type in ('po_offline_notice','lichtbuff_offline_notice') and (status in ('open','processing') or created_at > now() - interval '5 minutes') limit 1`, [guildId, kind]);
    if (existing.rows.length) {
      await client.query("commit");
      return {success:true, alreadyQueued:true};
    }
    if (!targets.length) throw new Error("Keine Bot-Postchannels gefunden.");
    for (const target of targets) {
      await client.query(`insert into bot_update_queue(guild_id,type,payload,status) values($1,$2,$3::jsonb,'open')`, [target.guildId, target.bot + "_offline_notice", JSON.stringify({...target, noticeKind:kind, content})]);
    }
    await client.query("commit");
    return {success:true, queued:true, channelCount:targets.length};
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
  const result = await db.query(`with latest as (
    select distinct on (payload->>'channelId') id, type, payload, status
    from bot_update_queue where guild_id=$1
      and type in ('po_offline_notice','lichtbuff_offline_notice')
      and coalesce(payload->>'noticeKind','bot')=$2
      and coalesce(payload->>'editOnly','false') <> 'true'
    order by payload->>'channelId',created_at desc,id desc
  ) select latest.*, exists (
    select 1 from bot_update_queue edits where edits.guild_id=$1
      and edits.type=latest.type and edits.payload->>'sourceQueueId'=latest.id::text
      and edits.payload->>'editOnly'='true'
  ) as edit_queued from latest`, [guildId, kind]);
  const pendingCount = result.rows.filter(row=>['open','processing'].includes(row.status)).length;
  const pending = pendingCount > 0;
  const targets = result.rows.filter(row=>row.status==='done' && /^\d+$/.test(row.payload.messageId||'') && !row.edit_queued)
    .map(row=>({...row.payload, guildId, sourceQueueId:row.id, editOnly:true, content:onlineNoticeContent(kind)}));
  return {targets,pending,pendingCount,alreadyQueued:result.rows.some(row=>row.edit_queued)};
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
