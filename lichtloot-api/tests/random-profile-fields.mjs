import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
for(const path of ['../../loot/raid-signup-mirror.js','../public/loot/raid-signup-mirror.js']){
 const source=fs.readFileSync(new URL(path,import.meta.url),'utf8'),start=source.indexOf('  function setRandomPageField('),end=source.indexOf('\n  }',start)+4;
 const context=vm.createContext({Option:class {constructor(text,value){this.text=text;this.value=value;}}});vm.runInContext(source.slice(start,end),context);
 const input={value:''};context.setRandomPageField(input,'Everlook');assert.equal(input.value,'Everlook');
 const select={value:'',options:[],add(option){this.options.push(option)}};context.setRandomPageField(select,'Priester');context.setRandomPageField(select,'Priester');assert.equal(select.options.length,1);assert.equal(select.value,'Priester');
 context.setRandomPageField(null,'ignored');context.setRandomPageField(input,'');assert.equal(input.value,'');
 assert(source.includes('function mountPageSignup(){if(new URLSearchParams(location.search).get("random")==="1")return;'));
 assert(source.includes('mountActiveCharacterPanel();applyRandomPriorityLabels();return;}installProtectedPrioSearch();installArmoryGearPlanner();'));
}
console.log('PASS random character fields support input/select, preserve selection and avoid duplicate options; random mode skips guild signup initialization.');
