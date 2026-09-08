import {readFile} from 'node:fs/promises';

export async function installPrioHistory(query) {
  const sql=await readFile(new URL('../migrations/041_prio_history.sql',import.meta.url),'utf8');
  await query(sql);
}

export async function installP0PlusNotices(query) {
  await query(await readFile(new URL('../migrations/042_p0plus_player_notices.sql',import.meta.url),'utf8'));
}
