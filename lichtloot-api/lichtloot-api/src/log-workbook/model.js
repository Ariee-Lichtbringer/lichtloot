import { createHash } from 'node:crypto';
export const EXPORT_VERSION = '1';
export const CLASSES = {
  Druid:['Druide','FF7D0A','classicon_druid'],Hunter:['Jäger','ABD473','classicon_hunter'],Mage:['Magier','69CCF0','classicon_mage'],
  Paladin:['Paladin','F58CBA','classicon_paladin'],Priest:['Priester','FFFFFF','classicon_priest'],Rogue:['Schurke','FFF569','classicon_rogue'],
  Warlock:['Hexenmeister','9482C9','classicon_warlock'],Warrior:['Krieger','C79C6E','classicon_warrior'],Shaman:['Schamane','0070DE','classicon_shaman'],
  DeathKnight:['Todesritter','C41F3B','classicon_deathknight'],Unknown:['Unbekannt','CBD5E1','inv_misc_questionmark']
};
export const classInfo = p => CLASSES[p?.className] || CLASSES.Unknown;
export const clean = value => String(value ?? '').trim();
export function cellValue(value) {
  if(value == null || value === '') return null;
  if(typeof value === 'number') return Number.isFinite(value) ? value : null;
  if(typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if(typeof value === 'object') return clean(value.text || value.name || value.itemName || JSON.stringify(value)).slice(0,32767);
  const text=clean(value);
  if(/^-?\d+(\.\d+)?%$/.test(text)) return Number(text.slice(0,-1))/100;
  if(/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text.slice(0,32767); // ExcelJS treats strings as text, never as formulas.
}
export function raidTimestamp(web, analysis={}) {
  const raw=web?.report?.startTime ?? web?.rpb?.report?.startTime ?? analysis.summary?.reportStartTime;
  if(raw == null || raw === '') return null;
  const date=new Date(typeof raw === 'number' || /^\d+$/.test(String(raw)) ? Number(raw) : raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function workbookLinks({guild,analysis,publicBaseUrl,apiBaseUrl}) {
  if(!guild?.slug || !analysis?.id) throw new Error('Gilde und Analyse-ID fehlen.');
  const web=new URL('/raid-analyse.html',publicBaseUrl);web.searchParams.set('id',analysis.id);web.searchParams.set('guild',guild.slug);
  const sheet=new URL(`/api/guilds/${encodeURIComponent(guild.slug)}/log-analyses/${encodeURIComponent(analysis.id)}/workbook.xlsx`,apiBaseUrl);
  const report=clean(analysis.reportUrl || analysis.report_url);
  const parsed=new URL(report);
  if(parsed.protocol!=='https:' || !(parsed.hostname==='warcraftlogs.com'||parsed.hostname.endsWith('.warcraftlogs.com')) || !parsed.pathname.startsWith('/reports/'))throw new Error('Ungültiger Warcraft-Logs-Report-Link.');
  return {analysisUrl:web.href,sheetUrl:sheet.href,reportUrl:parsed.href};
}
export function analysisBrand(guild) { return ({nachtloot:'NachtLoot',lichtloot:'LichtLoot'})[clean(guild.slug).toLowerCase()] || 'GuildLoot'; }
export function sourceDigest(web, guild) {
  // Export timestamps and queue state are not source data.
  const stripAnalysis = value => { const {analysis, ...source} = value || {}; return source; };
  const source = stripAnalysis(web);
  if(source.rpb) source.rpb = stripAnalysis(source.rpb);
  if(source.cla) source.cla = stripAnalysis(source.cla);
  return createHash('sha256').update(JSON.stringify([EXPORT_VERSION,guild.slug,guild.name,guild.logoUrl,source])).digest('hex');
}
export function activityByClass(web) {
  const rpb=web.rpb || web,players=rpb.players || [],rows=rpb.sections?.find(s=>s.id==='general')?.rows || [];
  const single=rows.find(r=>r.label==='Sekunden aktiv auf Einzelziel')?.values || {};
  const aoe=rows.find(r=>r.label==='Sekunden aktiv auf AoE')?.values || {};
  const values=new Map(),maxima=new Map();
  for(const p of players){const a=single[p.name],b=aoe[p.name];const known=(a!==''&&a!=null)||(b!==''&&b!=null);const seconds=known?(Number(a)||0)+(Number(b)||0):null;values.set(p.name,seconds);if(seconds!=null)maxima.set(p.className,Math.max(maxima.get(p.className)||0,seconds));}
  return {values,maxima};
}
export function buildPostPayload({guild,analysis,web,links,channelId}) {
  const startedAt=raidTimestamp(web,analysis), date=startedAt?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium'}).format(new Date(startedAt)):clean(web.report?.raidDate||analysis.raidDate||analysis.raid_date);
  return {analysisId:analysis.id,guildId:guild.id,guildSlug:guild.slug,guildName:guild.name||guild.slug,discordGuildId:clean(guild.discordGuildId),
    analysisBrand:analysisBrand(guild),raid:clean(web.report?.raid||analysis.raid||analysis.title),raidName:clean(web.report?.raid||analysis.raid||analysis.title),reportTitle:clean(web.report?.title||analysis.title),raidDate:date,
    startedAt,raidTime:startedAt?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(startedAt)):'Nicht im Log erfasst',timeZone:'Europe/Berlin',channelId:clean(channelId),...links};
}
