const fs = require('fs');
const path = 'start.html';
let text = fs.readFileSync(path, 'utf8');
const oldText = `  if(params.action === "getPublicWorldbuffs"){
    return await fetchRailwayApi("/api/apps-script?action=getPublicWorldbuffs");
  }

  if(params.action === "getPublicHordenbuffs"){
    return await fetchRailwayApi("/api/apps-script?action=getPublicHordenbuffs");
  }`;
const newText = `  if(params.action === "getPublicWorldbuffs"){
    const days=params.days ? "&days="+encodeURIComponent(params.days) : "";
    return await fetchRailwayApi("/api/apps-script?action=getPublicWorldbuffs"+days);
  }

  if(params.action === "getPublicHordenbuffs"){
    const days=params.days ? "&days="+encodeURIComponent(params.days) : "";
    return await fetchRailwayApi("/api/apps-script?action=getPublicHordenbuffs"+days);
  }`;
if (text.includes(oldText)) {
  text = text.replace(oldText, newText);
  fs.writeFileSync(path, text);
  console.log('start.html patched');
} else if (text.includes('getPublicWorldbuffs"+days') && text.includes('getPublicHordenbuffs"+days')) {
  console.log('start.html already patched');
} else {
  throw new Error('target pattern not found');
}
