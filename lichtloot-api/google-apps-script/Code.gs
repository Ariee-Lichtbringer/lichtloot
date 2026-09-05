/** GuildLoot: creates native Google Sheets from completed, authorized raid exports. */
const API_BASE = 'https://lichtloot-production.up.railway.app';
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
function doGet() { return json_({success:true,service:'GuildLoot Google Sheets'}); }
function doPost(e) {
  let lock;
  try {
    const p=JSON.parse(e.postData.contents);
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.guildSlug||'') || !/^[0-9a-f-]{36}$/i.test(p.analysisId||'') || !/^[0-9a-f]{64}$/.test(p.sourceHash||'') || typeof p.queueToken!=='string') throw Error('Ungültiger Auftrag.');
    const base=API_BASE+'/api/guilds/'+p.guildSlug+'/log-analyses/';
    const auth=UrlFetchApp.fetch(base+'workbook-backfill',{method:'post',contentType:'application/json',payload:JSON.stringify({queueToken:p.queueToken,dryRun:true,analysisIds:[p.analysisId]}),muteHttpExceptions:true});
    if(auth.getResponseCode()!==200)throw Error('Auftrag nicht autorisiert.');
    const verified=JSON.parse(auth.getContentText());
    if(!verified.success || verified.guild!==p.guildSlug || verified.raids.length!==1 || verified.raids[0].id!==p.analysisId)throw Error('Gilde oder Analyse stimmt nicht überein.');
    lock=LockService.getScriptLock();lock.waitLock(25000);
    const q="trashed = false and mimeType = '"+SHEET_MIME+"' and appProperties has { key='guildlootAnalysisId' and value='"+p.analysisId+"' } and appProperties has { key='guildlootGuild' and value='"+p.guildSlug+"' }";
    const previous=Drive.Files.list({q:q,fields:'files(id,name,webViewLink,appProperties)',pageSize:10}).files||[];
    if(previous.length>1)throw Error('Mehrere Sheets für diese Analyse vorhanden.');
    let file=previous[0];
    if(!file || file.appProperties.sourceHash!==p.sourceHash){
      const response=UrlFetchApp.fetch(base+p.analysisId+'/workbook.xlsx',{muteHttpExceptions:true});
      if(response.getResponseCode()!==200)throw Error('Raid-Auswertung noch nicht verfügbar.');
      const blob=stripFloatingIcons_(response.getBlob());
      const raid=verified.raids[0],name=p.guildSlug+' · '+raid.raid+' · '+String(raid.date||'').slice(0,10);
      const meta={name:name,mimeType:SHEET_MIME,appProperties:{guildlootAnalysisId:p.analysisId,guildlootGuild:p.guildSlug,sourceHash:p.sourceHash}};
      if(file)file=Drive.Files.update(meta,file.id,blob,{fields:'id,name,mimeType,webViewLink'});
      else{const folders=DriveApp.getRootFolder().getFoldersByName('ChatGPT');const folder=folders.hasNext()?folders.next():DriveApp.getRootFolder().createFolder('ChatGPT');meta.parents=[folder.getId()];file=Drive.Files.create(meta,blob,{fields:'id,name,mimeType,webViewLink'});}
      const sheet=SpreadsheetApp.openById(file.id);sheet.setSpreadsheetLocale('de_DE');sheet.setSpreadsheetTimeZone('Europe/Berlin');
      sheet.getSheets().forEach(function(tab){if(!tab.isSheetHidden()){tab.setFrozenColumns(0);tab.setFrozenRows(8);tab.setHiddenGridlines(true);}});
      installCellIcons_(sheet);
      SpreadsheetApp.flush();
    }
    DriveApp.getFileById(file.id).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    const spreadsheet=SpreadsheetApp.openById(file.id);
    if(!spreadsheet.getSheetByName('Übersicht'))throw Error('Die Übersichtsseite fehlt nach der Konvertierung.');
    return json_({success:true,spreadsheetId:file.id,url:spreadsheet.getUrl(),mimeType:SHEET_MIME,title:spreadsheet.getName(),sheets:spreadsheet.getSheets().length});
  } catch(error){return json_({success:false,error:String(error.message||error).slice(0,400)});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

function installCellIcons_(spreadsheet){
  const manifest=spreadsheet.getSheetByName('_GoogleIcons');
  if(!manifest)return;
  const groups={},images={};
  manifest.getDataRange().getValues().slice(1).forEach(function(row){
    const name=String(row[0]),r=Number(row[1]),c=Number(row[2]),url=String(row[3]);
    const prefix='https://wow.zamimg.com/images/wow/icons/large/';
    if(!url.startsWith(prefix)||!url.endsWith('.jpg')||!/^[a-z0-9_]+$/.test(url.slice(prefix.length,-4))||r<1||c<1)throw Error('Ungültiger Icon-Eintrag.');
    const key=JSON.stringify([name,c]);if(!groups[key])groups[key]=[];groups[key].push({r:r,url:url});
  });
  Object.keys(groups).forEach(function(key){
    const parts=JSON.parse(key),tab=spreadsheet.getSheetByName(parts[0]),column=parts[1];
    if(!tab)throw Error('Icon-Blatt fehlt.');
    const rows=groups[key].sort(function(a,b){return a.r-b.r;});
    let start=0;
    while(start<rows.length){let end=start+1;while(end<rows.length&&rows[end].r===rows[end-1].r+1)end++;
      tab.getRange(rows[start].r,column,end-start,1).setValues(rows.slice(start,end).map(function(row){if(!images[row.url])images[row.url]=SpreadsheetApp.newCellImage().setSourceUrl(row.url).build();return [images[row.url]];}));start=end;
    }
  });
  spreadsheet.getSheets().forEach(function(tab){tab.getImages().forEach(function(image){const a=image.getAnchorCell();if(a.getRow()!==1||a.getColumn()!==1)image.remove();});});
  manifest.hideSheet();
}

function stripFloatingIcons_(blob){
  const parts=Utilities.unzip(blob.setContentType('application/zip'));
  parts.forEach(function(part){
    if(!/^xl\/drawings\/drawing[0-9]+\.xml$/.test(part.getName()))return;
    const doc=XmlService.parse(part.getDataAsString()),root=doc.getRootElement(),ns=root.getNamespace();
    root.getChildren().slice().forEach(function(anchor){const from=anchor.getChild('from',ns);if(!from||from.getChildText('row',ns)!=='0'||from.getChildText('col',ns)!=='0')root.removeContent(anchor);});
    part.setDataFromString(XmlService.getRawFormat().format(doc));
  });
  return Utilities.zip(parts,'raid.xlsx').setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
