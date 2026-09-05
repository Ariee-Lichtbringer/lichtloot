import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {buildRaidWorkbook} from '../src/log-workbook/workbook.js';
import {activityByClass,workbookLinks,buildPostPayload,cellValue,sourceDigest,analysisBrand} from '../src/log-workbook/model.js';
import {createRaidWorkbookService} from '../src/log-workbook/service.js';
const guild={id:'guild-a',slug:'testgilde',name:'Testgilde',discordGuildId:'123456789012345678'};
const analysis={id:'12345678-1234-4234-8234-123456789abc',raid:'Naxxramas',reportUrl:'https://vanilla.warcraftlogs.com/reports/AbCdEfGh12345678'};
const players=[{name:'Eins',className:'Druid',damageDone:100,healingDone:20,deaths:1,activityPercent:60,gear:[{slot:'Kopf',name:'Helm',enchant:'+10',itemLevel:80,itemId:'1'}]},{name:'Zwei',className:'Druid',damageDone:50,healingDone:100,deaths:0,activityPercent:50},{name:'Drei',className:'Druid',damageDone:2},{name:'=HYPERLINK("https://evil.invalid")',className:'Mage',damageDone:2}];
const activityRows=[{label:'Sekunden aktiv auf Einzelziel',values:{Eins:'100',Zwei:'40',Drei:''}},{label:'Sekunden aktiv auf AoE',values:{Eins:'20',Zwei:'20',Drei:''}}];
const web={report:{raid:'Naxxramas',raidDate:'2026-09-04',startTime:Date.parse('2026-09-04T18:00:00Z'),bossKills:1},rpb:{players,sections:[{id:'general',rows:activityRows},{id:'healer-casts',playerFilter:['Eins','Zwei','Drei'],rows:[{type:'header',className:'Druid',label:'Druid'},{label:'Heilung',icon:'spell_nature_healingtouch',values:{Eins:'5',Zwei:'2'}}]}],encounters:[{id:1,name:'Boss',kill:true,durationMs:1000,players:{Eins:{worldBuffs:['Nef/Ony']},Zwei:{worldBuffs:[]}}}],worldBuffMetadata:{'Nef/Ony':{icon:'inv_misc_head_dragon_01'}},consumableUsage:{bossCount:1,players:{Eins:{items:[{label:'Flask',originalLabel:'Flask',uses:1,fightsUsed:1,percent:100}]}}}},cla:{sections:[]}};
const links=workbookLinks({guild,analysis,publicBaseUrl:'https://guildloot.example',apiBaseUrl:'https://api.guildloot.example'});
assert.match(links.analysisUrl,/guild=testgilde/);assert.match(links.sheetUrl,/guilds\/testgilde\/log-analyses/);
assert.throws(()=>workbookLinks({guild,analysis:{...analysis,reportUrl:'https://warcraftlogs.com.evil.invalid/reports/a'},publicBaseUrl:'https://guildloot.example',apiBaseUrl:'https://api.guildloot.example'}));
assert.equal(activityByClass(web).values.get('Eins'),120);assert.equal(activityByClass(web).values.get('Drei'),null);
const payload=buildPostPayload({guild,analysis,web,links,channelId:'234567890123456789'});assert.equal(payload.raidTime,'20:00');assert.equal(payload.raidDate,'04.09.2026');assert.equal(payload.guildSlug,guild.slug);
assert.equal(cellValue('50%'),.5);assert.equal(typeof cellValue('=SUM(1,2)'),'string');
const out=await buildRaidWorkbook({web,guild,analysis,links,images:false});const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(out.buffer);
const cast=workbook.getWorksheet('Heiler - Druide');assert.equal(cast.views[0].ySplit,8);assert.equal(cast.getCell('D8').value,'Eins');assert.equal(cast.getCell('D10').value.result,120);assert.equal(cast.getCell('E11').value.result,.5);assert.equal(cast.getCell('F11').value,'Nicht erfasst');assert.equal(cast.getCell('E11').numFmt,'0.0%');
assert.equal(workbook.getWorksheet('Übersicht').getCell('A12').type,ExcelJS.ValueType.String);assert.equal(workbook.getWorksheet('Ausrüstung Details').getCell('E9').value,'+10');
assert.equal(workbook.getWorksheet('Verbrauch Details').getCell('H9').value,1);assert.equal(workbook.getWorksheet('Übersicht').getCell('A5').value.hyperlink,links.analysisUrl);
let generated=0,queued=0,stored;const contexts={a:{...analysis,guild_slug:guild.slug,guild_name:guild.name,discord_guild_id:guild.discordGuildId,guild_layout:{logWorkbookAutoPost:true}}};
const db=async(sql,params=[])=>{
 if(sql.includes('from log_analyses la'))return {rows:params[0]==='guild-a'?[contexts.a]:[]};
 if(sql.startsWith('select file_name'))return {rows:stored?[stored]:[]};
 if(sql.startsWith('select analysis_id'))return {rows:stored?[{analysis_id:analysis.id}]:[]};
 if(sql.startsWith('insert into log_analysis_workbooks')){stored={source_hash:params[2],file_name:params[3],content:params[4]};return {rows:[]};}
 if(sql.startsWith('insert into bot_update_queue')){queued++;assert.match(sql,/on conflict/);const p=JSON.parse(params[1]);assert.equal(p.guildSlug,'testgilde');assert.equal(p.channelId,'234567890123456789');}
 return {rows:[]};
};
const service=createRaidWorkbookService({query:db,getWeb:async()=>({webAnalysis:web}),resolveChannel:async()=> '234567890123456789',publicBaseUrl:'https://guildloot.example',apiBaseUrl:'https://api.guildloot.example',publishSheet:async()=>({id:"test_sheet_id",url:"https://docs.google.com/spreadsheets/d/test_sheet_id/edit"}),build:async()=>{generated++;return out;}});
await service.afterAnalysis({guildId:'guild-a',analysisId:analysis.id,web});assert.equal(generated,1);assert.equal(queued,1);
await service.generate('guild-a',analysis.id);assert.equal(generated,1);
await assert.rejects(service.generate('guild-b',analysis.id),e=>e.statusCode===404);
contexts.a.guild_layout.logWorkbookAutoPost=false;
await service.afterAnalysis({guildId:'guild-a',analysisId:analysis.id,web:{...web,report:{...web.report,bossKills:2}}});assert.equal(generated,2);assert.equal(queued,1);
console.log('Workbook, frozen names, source values, class activity, guild isolation, post metadata and refresh/opt-out verified.');

assert.equal(sourceDigest(web,guild),sourceDigest({...web,analysis:{summary:{workbookGeneratedAt:'changed'}},rpb:{...web.rpb,analysis:{summary:{workbookUrl:'changed'}}}},guild));
assert.notEqual(sourceDigest(web,guild),sourceDigest({...web,report:{...web.report,bossKills:2}},guild));
assert.equal(analysisBrand({slug:'nachtloot'}),'NachtLoot');
assert.equal(analysisBrand({slug:'lichtloot'}),'LichtLoot');
assert.equal(analysisBrand({slug:'other'}),'GuildLoot');
assert.match(workbook.getWorksheet('Übersicht').getCell('A4').value,/kompakte Übersicht.*GuildLoot/);

const {publishGoogleSheet}=await import('../src/log-workbook/google-sheets.js');
const publishArgs={bridgeUrl:'https://script.google.com/macros/s/test/exec',queueToken:'test-token',guildSlug:guild.slug,analysisId:analysis.id,sourceHash:'a'.repeat(64)};
const native={success:true,mimeType:'application/vnd.google-apps.spreadsheet',spreadsheetId:'native_id',url:'https://docs.google.com/spreadsheets/d/native_id/edit'};
assert.deepEqual(await publishGoogleSheet({...publishArgs,fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.guildSlug,guild.slug);assert.equal(body.analysisId,analysis.id);return {ok:true,json:async()=>native};}}),{id:'native_id',url:native.url});
for(const bad of [{...native,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},{...native,url:'https://docs.google.com.evil.invalid/spreadsheets/d/native_id/edit'},{success:false,error:'Unauthorized'}])await assert.rejects(publishGoogleSheet({...publishArgs,fetchImpl:async()=>({ok:true,json:async()=>bad})}));
console.log('Native Google Sheet identity and rejected invalid publisher responses verified.');
contexts.a.guild_layout.logWorkbookAutoPost=true;
const before=queued;
assert.equal(service.enqueueBackfill({guildId:'guild-a',analysisId:analysis.id}).queued,true);
assert.equal(service.enqueueBackfill({guildId:'guild-a',analysisId:analysis.id}).reason,'already-queued');
await new Promise(resolve=>setImmediate(resolve));
assert.equal(queued,before+1);
console.log('Completed-data backfill publishes independently and coalesces duplicate requests.');
