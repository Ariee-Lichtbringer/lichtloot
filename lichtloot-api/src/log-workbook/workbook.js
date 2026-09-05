import ExcelJS from 'exceljs';
import {CLASSES,analysisBrand,classInfo,cellValue,activityByClass,raidTimestamp,clean} from './model.js';
import {workbookImage,workbookIconUrl} from './images.js';
const NAVY='19283E',STRIPE='F0F3F7';
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const sectionNames={general:'Allgemein',caster:'Zauberer',healer:'Heiler',physical:'Nahkampf',tank:'Tanks','caster-casts':'Zauberer','healer-casts':'Heiler','physical-casts':'Nahkampf','tank-casts':'Tanks','cla-combat-buffs':'Kampfbuffs','cla-gear-listing':'Ausrüstung Quelle','cla-gear-issues':'Verzauberungen fehlen','cla-ignites':'Ignite','cla-validate':'Logprüfung'};
export async function buildRaidWorkbook({web,guild,analysis,links,publicDir,publicBaseUrl,images=true}) {
  const rpb=web.rpb||web,players=rpb.players||[],report=web.report||rpb.report||{};
  if(!players.length)throw new Error('Die Loganalyse enthält noch keine Charakterdaten.');
  const wb=new ExcelJS.Workbook();wb.creator='GuildLoot';wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;
  const imageJobs=[],imageIds=new Map(),sheets=[],activity=activityByClass(web),records=[];
  const overview=wb.addWorksheet('Übersicht');
  function picture(s,icon,c,r,logo=false){if(images&&icon)imageJobs.push({s,icon,c,r,logo});}
  function init(name,headers,rows,{widths={},formats={},matrixPlayers=null,icons=[]}={}){
    name=name.replace(/[\\/*?:\[\]]/g,' ').slice(0,31);let unique=name,n=2;while(wb.getWorksheet(unique)&&name!=='Übersicht')unique=(name.slice(0,27)+' '+n++).slice(0,31);
    const s=name==='Übersicht'?overview:wb.addWorksheet(unique);sheets.push(s);
    s.views=[{state:'frozen',ySplit:8,xSplit:matrixPlayers?3:2,topLeftCell:matrixPlayers?'D9':'C9',showGridLines:false}];
    s.properties.tabColor={argb:/Heil/.test(name)?'438575':/Ausrüstung|Verbrauch|Worldbuff/.test(name)?'8970AC':'4F7EA7'};
    for(let c=1;c<=Math.max(headers.length,8);c++)s.getColumn(c).width=widths[c]||20;
    s.mergeCells(1,1,2,Math.max(8,headers.length));s.getCell('A1').value=`         ${guild.name||guild.slug} · ${name}`;s.getCell('A1').font={name:'Calibri',size:20,bold:true,color:{argb:NAVY}};s.getRow(1).height=23;s.getRow(2).height=23;
    s.mergeCells(3,1,3,8);s.getCell('A3').value=`${report.raid||analysis.raid||analysis.title} · ${report.raidDate||analysis.raidDate||''} · ${players.length} Charaktere · ${report.bossKills??'–'} Bosskills · © Ariee-Everlook`;
    s.mergeCells(4,1,4,8);s.getCell('A4').value=`Dieses Sheet bietet eine kompakte Übersicht. Die ausführliche Analyse findest du auf ${analysisBrand(guild)} – Link direkt darunter.`;s.getCell('A4').alignment={wrapText:true,vertical:'middle'};s.getRow(4).height=30;s.getCell('A4').font={size:10,color:{argb:'627084'}};
    s.mergeCells(5,1,5,8);s.getCell('A5').value={text:`${guild.name||guild.slug}: Loganalyse auf GuildLoot öffnen`,hyperlink:links.analysisUrl};s.getCell('A5').fill={type:'pattern',pattern:'solid',fgColor:{argb:'DCEAF5'}};s.getCell('A5').font={size:15,bold:true,color:{argb:'174F7B'}};s.getRow(5).height=32;
    s.getCell('A6').value={text:'Warcraft-Logs-Report öffnen',hyperlink:links.reportUrl};s.getCell('D6').value={text:'Aktuelle Excel-Datei herunterladen',hyperlink:links.sheetUrl};
    if(s!==overview)s.getCell('H6').value={text:'Zur Übersicht',hyperlink:"#'Übersicht'!A1"};
    headers.forEach((v,i)=>{const c=s.getCell(8,i+1);c.value=v;c.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};c.alignment={vertical:'middle',wrapText:true};});s.getRow(8).height=32;
    rows.forEach((a,i)=>{const row=s.getRow(i+9);row.height=28;a.forEach((v,j)=>{const c=row.getCell(j+1);c.value=v===undefined?null:v;c.font={name:'Calibri',size:11,color:{argb:NAVY}};c.alignment={vertical:'middle',wrapText:true};c.numFmt=formats[j+1]||'#,##0';if(i%2)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:STRIPE}};});
      if(!matrixPlayers){const p=players.find(p=>p.name===a[0]);if(p){row.getCell(1).font={name:'Calibri',size:11,bold:true,color:{argb:p.className==='Priest'?'526174':classInfo(p)[1]}};row.getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:classInfo(p)[1]}};row.getCell(2).font={name:'Calibri',size:11,bold:true,color:{argb:NAVY}};}}
    });
    s.autoFilter={from:{row:8,column:1},to:{row:Math.max(9,rows.length+8),column:headers.length}};
    if(matrixPlayers)matrixPlayers.forEach((p,i)=>s.getCell(8,i+4).font={name:'Calibri',size:12,bold:true,color:{argb:classInfo(p)[1]}});
    headers.forEach((h,i)=>{if(h==='Icon'){s.getColumn(i+1).width=10;s.getCell(8,i+1).alignment={vertical:'middle',wrapText:false};}if(/-ID$/.test(h))for(let r=9;r<=rows.length+8;r++)s.getCell(r,i+1).numFmt='0';});
    picture(s,guild.logoUrl,0,0,true);icons.forEach((icon,i)=>picture(s,icon,headers.length-1,i+8));return s;
  }
  function compareRow(s,row,start,end){
    const cells=[];for(let c=start;c<=end;c++){const cell=s.getCell(row,c),v=cell.value;const n=typeof v==='number'?v:v&&typeof v==='object'&&typeof v.result==='number'?v.result:null;if(n!==null&&Number.isFinite(n))cells.push([cell,n]);}
    if(!cells.length)return;const maximum=Math.max(...cells.map(([,n])=>n));
    for(const[cell,n]of cells){const ratio=maximum>0?Math.max(0,Math.min(1,n/maximum)):1;
      const stops=ratio<=.5?[[180,35,45],[154,103,0],ratio*2]:[[154,103,0],[24,120,65],(ratio-.5)*2];
      const color=stops[0].map((v,i)=>Math.round(v+(stops[1][i]-v)*stops[2]).toString(16).padStart(2,'0')).join('').toUpperCase();
      cell.font={...cell.font,color:{argb:color},bold:n===maximum};
    }
  }
  function styleMatrix(s,rows,count){
    rows.forEach((values,i)=>{
      values.slice(3).forEach((value,j)=>{
        const match=typeof value==='string'&&value.match(/^(\d+) Einsätze? · (\d+(?:[.,]\d+)?)% Overheal$/);
        if(match){const cell=s.getCell(i+9,j+4);cell.value=Number(match[1]);cell.numFmt='#,##0" ('+match[2]+' % OH)"';s.getCell(i+9,3).value='Einsätze (OH)';}
      });compareRow(s,i+9,4,count+3);
    });
    s.getCell('A4').value='Vergleich je Fähigkeit innerhalb der Klasse: höchster Wert grün, relativ dazu gelb bis rot. OH = Overheal in Klammern.';
  }
  const summary=players.map(p=>[p.name,classInfo(p)[0],p.signupRole||p.raidRole||'',p.damageDone,p.healingDone,p.deaths,p.activityPercent==null?null:p.activityPercent/100,p.worldBuffCount,activity.values.get(p.name),p.specialization?.name||p.specName||'Nicht im Log erfasst']);
  init('Übersicht',['Charakter','Klasse','Raidrolle','Schaden','Heilung','Tode','WCL-Aktivität','Worldbuffs','Aktivsekunden','Spezialisierung'],summary,{formats:{7:'0.0%'},widths:{1:22,3:23,10:30}});
  const stamp=raidTimestamp(web,analysis);overview.getCell('F6').value=stamp?`Raidbeginn: ${new Date(stamp).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})}`:'Raidbeginn: nicht im Log erfasst';
  const classSource=wb.addWorksheet('Aktivitätsdaten',{state:'hidden'});classSource.addRow(['Charakter','Klasse','Einzelziel (s)','AoE (s)','Gesamt (s)']);const actRows=new Map();
  const general=rpb.sections?.find(s=>s.id==='general')?.rows||[];const ez=general.find(r=>r.label==='Sekunden aktiv auf Einzelziel')?.values||{},aoe=general.find(r=>r.label==='Sekunden aktiv auf AoE')?.values||{};
  players.forEach((p,i)=>{const known=activity.values.get(p.name)!=null;classSource.addRow([p.name,classInfo(p)[0],known?(Number(ez[p.name])||0):null,known?(Number(aoe[p.name])||0):null,known?{formula:`SUM(C${i+2}:D${i+2})`,result:activity.values.get(p.name)}:'Nicht erfasst']);actRows.set(p.name,i+2);});
  for(const section of [...(rpb.sections||[]),...(web.cla?.sections||[])]){
    // Keep every populated source metric, including characters outside a role's display filter.
    let group='';for(const r of section.rows||[]){if(r.type==='header'){group=r.label;continue;}for(const p of players){const v=r.values?.[p.name];if(v!==''&&v!=null)records.push([p.name,classInfo(p)[0],sectionNames[section.id]||section.label,group,r.label,cellValue(v),typeof v==='string'&&v.endsWith('%')?'%':'',r.icon||'']);}}
    if(section.id==='cla-world-buffs')continue;
    if(section.id?.endsWith('-casts')){
      const roster=section.playerFilter?players.filter(p=>section.playerFilter.includes(p.name)):players;
      for(const klass of new Set(roster.map(p=>p.className))){const groupPlayers=roster.filter(p=>p.className===klass),rows=[];let owner='';
        for(const r of section.rows||[]){if(r.type==='header'){owner=r.className||r.label;continue;}if(owner!==klass||/Sekunden aktiv|Aktiv auf|Aktiv gesamt|WCL-Aktivität/.test(r.label))continue;if(!groupPlayers.some(p=>r.values?.[p.name]!==''&&r.values?.[p.name]!=null))continue;rows.push([null,r.label,Object.values(r.values||{}).some(v=>typeof v==='string'&&v.endsWith('%'))?'%':'',...groupPlayers.map(p=>cellValue(r.values?.[p.name]))]);}
        if(!rows.length)continue;
        const secondsRow=rows.length+9,maxRefs=players.filter(p=>p.className===klass).map(p=>`'Aktivitätsdaten'!E${actRows.get(p.name)}`).join(',');
        rows.push([null,'Aktivzeit (Einzelziel + AoE)','Sekunden',...groupPlayers.map(p=>activity.values.get(p.name)==null?'Nicht erfasst':{formula:`'Aktivitätsdaten'!E${actRows.get(p.name)}`,result:activity.values.get(p.name)})]);
        rows.push([null,'Klassenvergleich · Maximum = 100 %','%',...groupPlayers.map((p,i)=>activity.values.get(p.name)==null?'Nicht erfasst':{formula:`IF(MAX(${maxRefs})=0,"Nicht erfasst",${col(i+3)}${secondsRow}/MAX(${maxRefs}))`,result:activity.maxima.get(klass)?activity.values.get(p.name)/activity.maxima.get(klass):'Nicht erfasst'})]);
        const s=init(`${sectionNames[section.id]} - ${classInfo(groupPlayers[0])[0]}`,['Icon','Fähigkeit','Einheit',...groupPlayers.map(p=>p.name)],rows,{matrixPlayers:groupPlayers,widths:{1:6,2:45,3:12}});
        picture(s,classInfo(groupPlayers[0])[2],0,6);let ri=9;owner='';for(const r of section.rows||[]){if(r.type==='header'){owner=r.className||r.label;continue;}if(owner!==klass||/Sekunden aktiv|Aktiv auf|Aktiv gesamt|WCL-Aktivität/.test(r.label)||!groupPlayers.some(p=>r.values?.[p.name]!==''&&r.values?.[p.name]!=null))continue;picture(s,r.icon,0,ri-1);if(Object.values(r.values||{}).some(v=>typeof v==='string'&&v.endsWith('%')))for(let c=4;c<=groupPlayers.length+3;c++)s.getCell(ri,c).numFmt='0.0%';ri++;}
        for(let c=4;c<=groupPlayers.length+3;c++)s.getCell(secondsRow+1,c).numFmt='0.0%';
        styleMatrix(s,rows,groupPlayers.length);
      }
    }else{
      const rows=(section.rows||[]).filter(r=>r.type!=='header'),roster=section.playerFilter?players.filter(p=>section.playerFilter.includes(p.name)):players;
      const s=init(sectionNames[section.id]||section.label||section.id,['Charakter','Klasse',...rows.map(r=>r.label)],roster.map(p=>[p.name,classInfo(p)[0],...rows.map(r=>cellValue(r.values?.[p.name]))]));
      rows.forEach((r,j)=>roster.forEach((p,i)=>{if(typeof r.values?.[p.name]==='string'&&r.values[p.name].endsWith('%'))s.getCell(i+9,j+3).numFmt='0.0%';}));
    }
  }
  const bosses=rpb.encounters||[],buffs=Object.keys(rpb.worldBuffMetadata||{});
  const worldRows=players.map(p=>{const fights=bosses.filter(b=>b.players?.[p.name]);return[p.name,classInfo(p)[0],...buffs.map(b=>fights.length?fights.filter(f=>(f.players[p.name].worldBuffs||[]).some(v=>(typeof v==='string'?v:v.name)===b)).length/fights.length:null)];});
  const worlds=init('Worldbuffs',['Charakter','Klasse',...buffs],worldRows,{formats:Object.fromEntries(buffs.map((_,i)=>[i+3,'0.0%']))});worlds.getCell('A4').value='Anteil der Bosskämpfe mit Buff. Fehlende Teilnahme bleibt leer; keine zeitliche Uptime.';buffs.forEach((b,i)=>picture(worlds,rpb.worldBuffMetadata[b]?.icon,i+2,6));
  const gear=[],cons=[],heals=[],combat=[],fights=[],casts=[],fightHeals=[],deaths=[],gearIcons=[],consIcons=[],healIcons=[];
  for(const p of players){
    for(const item of p.gear||[]){gear.push([p.name,classInfo(p)[0],item.slot,item.name,item.enchant||(item.missingEnchant?'FEHLT':'Nicht erfasst'),item.itemLevel,item.quality,item.missingEnchant?'Ja':'Nein',item.itemId,item.wowhead?{text:'Gegenstand ansehen',hyperlink:item.wowhead}:null,null]);gearIcons.push(item.iconUrl);records.push([p.name,classInfo(p)[0],'Ausrüstung',item.slot,item.name,item.enchant||'', '',item.itemId]);}
    for(const item of rpb.consumableUsage?.players?.[p.name]?.items||[]){cons.push([p.name,classInfo(p)[0],item.category||(/flask|fläsch|destilliert/i.test(item.label)?'Fläschchen':'Verbrauchsgut'),item.label,item.uses,item.fightsUsed,rpb.consumableUsage.bossCount,item.percent==null?null:item.percent/100,item.spellId,null]);consIcons.push(item.icon);records.push([p.name,classInfo(p)[0],'Verbrauch',item.category||'',item.label,item.uses,'Anwendungen',item.percent==null?'':`${item.percent}% Bossabdeckung`]);}
    for(const spell of rpb.healingSummary?.players?.[p.name]?.spells||[]){heals.push([p.name,classInfo(p)[0],spell.name,spell.spellId,spell.amount,spell.overheal,spell.hits,spell.crits,spell.overhealPercent==null?null:spell.overhealPercent/100,null]);healIcons.push(spell.icon);}
    for(const m of rpb.combatStatistics?.metrics||[]){const v=rpb.combatStatistics.players?.[p.name]?.values?.[m.key];if(v)combat.push([p.name,classInfo(p)[0],m.label,v.count,v.denominator,v.percentage==null?null:v.percentage/100]);}
  }
  for(const f of rpb.fights||[])for(const p of players){const v=f.players?.[p.name];if(!v)continue;const base=[p.name,classInfo(p)[0],f.id,f.name,f.isBoss?'Boss':'Trash'];fights.push([...base,f.durationMs/1000,v.damageDone,v.healingDone,v.overheal,v.damageTaken,v.threat,v.deaths,v.activityPercent==null?null:v.activityPercent/100,v.parsePercent==null?null:v.parsePercent/100]);if(v.deaths)deaths.push([...base,v.deaths]);for(const[spell,count]of Object.entries(v.abilityCasts||{}))casts.push([...base,spell,count]);for(const[id,h]of Object.entries(v.healingSpells||{}))fightHeals.push([...base,(rpb.healingSummary?.players?.[p.name]?.spells||[]).find(s=>String(s.spellId)===id)?.name||id,h.amount,h.overheal,h.hits,h.crits]);}
  init('Ausrüstung Details',['Charakter','Klasse','Slot','Gegenstand','Verzauberung','Itemlevel','Qualität','Enchant fehlt','Item-ID','Link','Icon'],gear,{widths:{4:38,5:45,11:7},icons:gearIcons});
  init('Verbrauch Details',['Charakter','Klasse','Kategorie','Gegenstand','Anwendungen','Bosskämpfe aktiv','Bosskämpfe gesamt','Abdeckung','Zauber-ID','Icon'],cons,{widths:{4:38,10:7},formats:{8:'0.0%'},icons:consIcons});
  const healingViews=[];
  const definitions=new Map();
  for(const section of rpb.sections||[])if(section.id?.endsWith('-casts'))for(const row of section.rows||[])if(row.tone==='healing')for(const id of row.spellIds||[row.spellId])if(id)definitions.set(Number(id),row);
  for(const klass of new Set(players.map(p=>p.className))){
    const group=players.filter(p=>p.className===klass),abilities=new Map();
    for(const player of group)for(const spell of rpb.healingSummary?.players?.[player.name]?.spells||[]){
      const def=definitions.get(Number(spell.spellId)),label=def?.label||spell.name;
      if(!abilities.has(label))abilities.set(label,{label,icon:def?.icon||spell.icon,values:new Map()});
      const a=abilities.get(label),v=a.values.get(player.name)||{amount:0,overheal:0};v.amount+=Number(spell.amount)||0;v.overheal+=Number(spell.overheal)||0;a.values.set(player.name,v);
    }
    if(!abilities.size)continue;
    const spells=[...abilities.values()],rows=spells.map(a=>[null,a.label,'Heilung (OH)',...group.map(p=>a.values.has(p.name)?a.values.get(p.name).amount:null)]);
    const sheet=init('Heilzauber - '+classInfo(group[0])[0],['Icon','Heilzauber','Einheit',...group.map(p=>p.name)],rows,{matrixPlayers:group,widths:{1:10,2:45,3:16}});
    styleMatrix(sheet,rows,group.length);picture(sheet,classInfo(group[0])[2],0,6);
    spells.forEach((a,i)=>{picture(sheet,a.icon,0,i+8);group.forEach((p,j)=>{const v=a.values.get(p.name);if(v){const percent=v.amount+v.overheal?Math.round(v.overheal*100/(v.amount+v.overheal)):0;sheet.getCell(i+9,j+4).numFmt='#,##0" ('+percent+' % OH)"';}});});
    healingViews.push([classInfo(group[0])[0],{text:sheet.name,hyperlink:"#'"+sheet.name+"'!A1"},group.length]);
  }
  init('Heilzauber',['Klasse','Klassenvergleich öffnen','Charaktere'],healingViews,{widths:{1:20,2:38}});
  const healingDetails=init('Heilzauber Details',['Charakter','Klasse','Heilzauber','Zauber-ID','Heilung','Überheilung','Treffer','Kritisch','Overheal','Icon'],heals,{widths:{3:38,10:10},formats:{9:'0.0%'},icons:healIcons});
  healingDetails.getColumn(4).hidden=true;

  init('Kampfstatistik',['Charakter','Klasse','Kennzahl','Anzahl','Basis','Anteil'],combat,{widths:{3:38},formats:{6:'0.0%'}});
  init('Kämpfe',['Charakter','Klasse','Kampf-ID','Kampf','Bereich','Dauer (s)','Schaden','Heilung','Überheilung','Schaden erhalten','Bedrohung','Tode','Aktivität','Parse'],fights,{widths:{4:30},formats:{6:'0.000',13:'0.0%',14:'0.0%'}});
  init('Zauber je Kampf',['Charakter','Klasse','Kampf-ID','Kampf','Bereich','Fähigkeit','Anwendungen'],casts,{widths:{4:30,6:45}});
  init('Heilung je Kampf',['Charakter','Klasse','Kampf-ID','Kampf','Bereich','Heilzauber','Heilung','Überheilung','Treffer','Kritisch'],fightHeals,{widths:{4:30,6:38}});
  init('Tode',['Charakter','Klasse','Kampf-ID','Kampf','Bereich','Tode'],deaths,{widths:{4:30}});
  init('Bosse',['Kampf-ID','Boss','Ergebnis','Dauer (s)','Tode','Charaktere'],bosses.map(b=>[b.id,b.name,b.kill===false?'Nicht besiegt':'Besiegt',b.durationMs/1000,b.deaths,Object.keys(b.players||{}).length]),{widths:{2:32},formats:{4:'0.000'}});
  const details=init('Charakterdetails',['Charakter','Klasse','Bereich','Kategorie','Kennzahl','Wert','Einheit','Details'],records,{widths:{3:25,4:25,5:44,6:38,8:40}});details.getCell('A4').value='Charakter in Spalte A filtern: alle erfassten Quellwerte, Fähigkeiten, Ausrüstung und Verbrauch.';records.forEach((r,i)=>{if(r[6]==='%')details.getCell(i+9,6).numFmt='0.0%';});
  const navRow=summary.length+11;overview.getCell(navRow,1).value='Bereiche öffnen';sheets.filter(s=>s!==overview).forEach((s,i)=>{overview.getCell(navRow+i+1,1).value={text:s.name,hyperlink:`#'${s.name.replaceAll("'","''")}'!A1`};});
  // Resolve identical images once; limit concurrent CDN requests, preserving all requested icons.
  const unique=[...new Map(imageJobs.map(j=>[(j.logo?'logo:':'icon:')+j.icon,j])).entries()];let next=0;
  await Promise.all(Array.from({length:Math.min(8,unique.length)},async()=>{while(next<unique.length){const[key,j]=unique[next++];const img=await workbookImage(j.icon,{publicDir,publicBaseUrl,logo:j.logo});if(img)imageIds.set(key,wb.addImage(img));}}));
  for(const j of imageJobs){const id=imageIds.get((j.logo?'logo:':'icon:')+j.icon);if(id!==undefined)j.s.addImage(id,{tl:{col:j.c+.05,row:j.r+.05},ext:{width:j.logo?38:23,height:j.logo?38:23},editAs:'oneCell'});}
  // Google imports Excel drawings as floating pictures, which drift on filter/scroll.
  // The bridge replaces them with IMAGE values at these explicit cell addresses.
  const manifest=wb.addWorksheet('_GoogleIcons',{state:'veryHidden'});
  manifest.addRow(['Blatt','Zeile','Spalte','URL']);
  for(const j of imageJobs){const url=!j.logo&&workbookIconUrl(j.icon);if(url)manifest.addRow([j.s.name,j.r+1,j.c+1,url]);}
  const fileName=`${guild.slug}_${clean(report.raid||analysis.raid||'Raid').replace(/[^\p{L}\p{N}_-]/gu,'_')}_${clean(report.raidDate||analysis.raidDate||'Report')}.xlsx`;
  return {buffer:Buffer.from(await wb.xlsx.writeBuffer()),fileName,stats:{players:players.length,sourceMetrics:records.length,sheets:wb.worksheets.length,images:imageIds.size}};
}
