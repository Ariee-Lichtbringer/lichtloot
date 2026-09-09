import { createHash } from 'node:crypto';

const text = value => String(value ?? '').trim();
const md = value => text(value).replace(/[\\*_`~|<>]/g, '\\$&');

export function buildPrioConfirmation({ raid, character, items, p0Selected, p0Plus, points = null }) {
  const date = raid.raid_date instanceof Date ? raid.raid_date.toISOString().slice(0, 10) : text(raid.raid_date).slice(0, 10);
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('.') : date;
  const priorities = p0Selected
    ? [{ label: p0Plus ? 'P0+' : 'P0', item: text(items[0]?.name) }]
    : items.flatMap((item, index) => item?.name ? [{ label: `P${index + 1}`, item: text(item.name) }] : []);
  return {
    player: character.name, raid: text(raid.name || raid.raid_type),
    date: dateLabel, time: text(raid.raid_time).slice(0, 5), prioPin: text(raid.raid_pin),
    priorities, p0Selected: Boolean(p0Selected),
    points: p0Selected && points !== null && Number.isFinite(Number(points)) ? Number(points) : null
  };
}

export function prioConfirmationMessage(saved) {
  return [
    `Hallo ${md(saved.player)}!`, '',
    `Du hast für **${md(saved.raid)}** am **${md(saved.date)}**${saved.time ? ` um **${md(saved.time)} Uhr**` : ''} mit der **Prio-PIN ${md(saved.prioPin)}** folgende Prio gespeichert:`, '',
    ...saved.priorities.map(prio => `**${prio.label}** · ${md(prio.item)}`),
    ...(saved.p0Selected ? ['', `Deine aktuellen P0-Punkte für dieses Item: **${saved.points === null ? 'nicht verfügbar' : saved.points.toLocaleString('de-DE')}**`] : [])
  ].join('\n');
}

// Run on the save transaction: the bot cannot see a notification until the
// priority commit succeeds. No player_messages entry or public message exists.
export async function queuePrioConfirmation(client, { guildId, character, prioId, confirmation }) {
  const linked = await client.query(
    `select d.discord_user_id from discord_player_links d
     join characters c on c.id=d.character_id
     join players p on p.id=c.player_id
     where d.guild_id=$1 and p.guild_id=$1 and p.id=$2
     order by (c.id=$3) desc, d.updated_at desc limit 1`,
    [guildId, character.player_id, character.id]
  );
  const recipient = text(linked.rows[0]?.discord_user_id);
  if (!/^\d+$/.test(recipient)) return { queued: false, reason: 'no_discord_link' };
  const signature = createHash('sha256').update(JSON.stringify([prioId, recipient, confirmation])).digest('hex');
  const result = await client.query(
    `insert into bot_update_queue(guild_id,type,payload)
     select $1,'prio_saved_notice',$2::jsonb
     where not exists(select 1 from bot_update_queue
       where guild_id=$1 and type='prio_saved_notice' and payload->>'signature'=$3
         and created_at>now()-interval '30 seconds') returning id`,
    [guildId, JSON.stringify({ discordUserId: recipient, signature, prioId,
      prioSaveConfirmation: true, sender: 'LichtLoot',
      title: '✓ Prio erfolgreich gespeichert', body: prioConfirmationMessage(confirmation),
      deliveryStatus: 'queued' }), signature]
  );
  return { queued: true, deduplicated: !result.rows.length };
}

export async function prioDmStatus(query, guildId, params, complete = false) {
  const result = complete
    ? await query(`update bot_update_queue set payload=payload || $3::jsonb
        where guild_id=$1 and id=$2 and type='prio_saved_notice'
        returning payload`, [guildId, params.messageId, JSON.stringify({
          deliveryStatus: params.status === 'delivered' ? 'delivered' : 'failed',
          deliveryError: params.status === 'delivered' ? '' : text(params.error).slice(0, 300)
        })])
    : await query(`select payload from bot_update_queue where guild_id=$1 and id=$2 and type='prio_saved_notice'`, [guildId, params.messageId]);
  if (!result.rows.length) throw Object.assign(new Error('Prio-Bestätigung nicht gefunden.'), { statusCode: 404 });
  const payload = result.rows[0].payload;
  return { success: true, status: payload.deliveryStatus || 'queued', error: payload.deliveryError || '' };
}
