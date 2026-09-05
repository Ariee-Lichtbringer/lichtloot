export async function publishGoogleSheet({bridgeUrl,queueToken,guildSlug,analysisId,sourceHash,fetchImpl=fetch}) {
  if(!bridgeUrl||!queueToken)throw new Error('Der automatische Google-Sheets-Zugang ist noch nicht eingerichtet.');
  const bridge=new URL(bridgeUrl);
  if(bridge.protocol!=='https:'||bridge.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(bridge.pathname))throw new Error('Ungültiger Google-Sheets-Zugang.');
  const response=await fetchImpl(bridge.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queueToken,guildSlug,analysisId,sourceHash}),signal:AbortSignal.timeout(240000)});
  if(!response.ok)throw new Error(`Google Sheets konnte nicht erstellt werden (HTTP ${response.status}).`);
  let data;try{data=await response.json();}catch{throw new Error('Der Google-Sheets-Zugang liefert keine gültige Antwort.');}
  if(!data.success||data.mimeType!=='application/vnd.google-apps.spreadsheet')throw new Error(data.error||'Die Google-Sheets-Konvertierung ist fehlgeschlagen.');
  const url=new URL(data.url);
  if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.pathname!==`/spreadsheets/d/${data.spreadsheetId}/edit`||!/^[A-Za-z0-9_-]+$/.test(data.spreadsheetId))throw new Error('Die Antwort enthält keinen gültigen Google-Sheet-Link.');
  return {id:data.spreadsheetId,url:url.href};
}
