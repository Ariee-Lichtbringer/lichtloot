const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../../guildloot-prio-download.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../../guildloot-all-points.js'),'utf8'));
const input={guild:'test',entries:[{raid:'mc',player:'Äriee',server:'Everlook',item:'Blade',points:11},{raid:'bwl',player:'Äriee',server:'Everlook',item:'Blade',points:5}],catalogs:{mc:[{name:'Blade',item_id:1}],bwl:[{name:'Blade',item_id:1}]}};
const result=GuildLootAllPoints.build(input);assert.equal(result.entries,2);assert.equal((result.text.match(/GLP1;/g)||[]).length,7);assert.match(result.text,/Punkte;11/);assert.match(result.text,/Punkte;5/);
assert.throws(()=>GuildLootAllPoints.build({...input,catalogs:{}}));
assert.throws(()=>GuildLootAllPoints.build({...input,entries:[{...input.entries[0],raid:'unknown'}]}));
assert.equal(GuildLootAllPoints.build({...input,entries:[]}).entries,0);
