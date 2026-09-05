import {clean} from './model.js';

// Actor presence in masterData is not proof of participation: use WCL fight membership.
export async function prepareRaidWorkbookWeb(web,{analysis},{getReport,getSpellMetadata}){
  const source=web.rpb||web;
  let players=source.players||[],participation=null;
  const code=clean(analysis.report_code||analysis.reportCode);
  if(code && web.source!=='combat-log'){
    const base=await getReport(code);
    const selected=new Set((source.fights||source.encounters||[]).map(f=>Number(f.id)));
    const fights=(base.fights||[]).filter(f=>!selected.size||selected.has(Number(f.id)));
    if(!fights.length||fights.some(f=>!Array.isArray(f.friendlyPlayers)))throw new Error('Warcraft-Logs-Teilnehmer konnten nicht vollständig geprüft werden.');
    const ids=new Set(fights.flatMap(f=>f.friendlyPlayers).map(Number));
    const excluded=[...new Set([...(web.participation?.excluded||[]),...players.filter(p=>!ids.has(Number(p.id))).map(p=>p.name)])];
    players=players.filter(p=>ids.has(Number(p.id)));
    participation={source:'warcraftlogs-friendlyPlayers',excluded,names:players.map(p=>p.name)};
  }
  const names=new Set(players.map(p=>p.name));
  const select=values=>Object.fromEntries(Object.entries(values||{}).filter(([name])=>names.has(name)));
  const healingPlayers=select(source.healingSummary?.players);
  const spellIds=Object.values(healingPlayers).flatMap(p=>(p.spells||[]).map(s=>Number(s.spellId))).filter(Boolean);
  const metadata=await getSpellMetadata(spellIds);
  const healingSummary={...source.healingSummary,players:Object.fromEntries(Object.entries(healingPlayers).map(([name,p])=>[name,{...p,spells:(p.spells||[]).map(spell=>{
    const m=metadata.get(Number(spell.spellId));
    return {...spell,name:clean(m?.name)||spell.name,icon:clean(m?.icon)&&m.icon!=='classic_temp'?m.icon:spell.icon};
  })}]))};
  const rpb={...source,players,healingSummary,
    fights:(source.fights||[]).map(f=>({...f,players:select(f.players)})),
    encounters:(source.encounters||[]).map(f=>({...f,players:select(f.players)}))};
  return web.rpb?{...web,rpb,participation}:{...rpb,participation};
}
