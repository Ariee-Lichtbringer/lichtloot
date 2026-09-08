const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../../guildloot-prio-download.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname,'../../guildloot-all-points.js'),'utf8'));
const input={guild:'test',entries:[{raid:'mc',player:'Äriee',server:'Everlook',item:'Blade',points:11},{raid:'bwl',player:'Äriee',server:'Everlook',item:'Blade',points:5}],catalogs:{mc:[{name:'Blade',item_id:1}],bwl:[{name:'Blade',item_id:1}]}};
const result=GuildLootAllPoints.build(input);assert.equal(result.entries,2);assert.equal((result.text.match(/GLP1;/g)||[]).length,10);assert.match(result.text,/Punkte;11/);assert.match(result.text,/Punkte;5/);
assert.throws(()=>GuildLootAllPoints.build({...input,catalogs:{}}));
assert.throws(()=>GuildLootAllPoints.build({...input,entries:[{...input.entries[0],raid:'unknown'}]}));
assert.equal(GuildLootAllPoints.build({...input,entries:[]}).entries,0);

const variants=GuildLootAllPoints.build({guild:'nachtloot',entries:['zg-mittwoch','zg-prime','zg-late'].map((raid,i)=>({raid,player:'Same',server:'Realm',item:'Blade',points:i+1})),catalogs:Object.fromEntries(['zg-mittwoch','zg-prime','zg-late'].map(raid=>[raid,[{name:'Blade',item_id:1}]]))});
assert.equal(variants.entries,3);for(const raid of ['zg-mittwoch','zg-prime','zg-late'])assert(variants.text.includes('points%3A'+raid));

const sameName=GuildLootAllPoints.build({guild:'nachtloot',entries:[{raid:'zg-late',item:'Blade',itemId:1,player:'Same',server:'Realm',points:3},{raid:'zg-late',item:'Blade',itemId:2,player:'Same',server:'Realm',points:7}],catalogs:{'zg-late':[{name:'Blade',item_id:1},{name:'Blade',item_id:2}]}});assert.equal(sameName.entries,2);assert(sameName.text.includes('1;Blade;Same;Realm;Punkte;3;'));assert(sameName.text.includes('2;Blade;Same;Realm;Punkte;7;'));
