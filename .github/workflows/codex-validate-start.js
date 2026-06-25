const fs = require('fs');
const html = fs.readFileSync('start.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join('\n');
new Function(scripts);
console.log('start.html JS OK');
