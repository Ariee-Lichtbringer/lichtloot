import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const nodes=[];
const element=tag=>({tag,children:[],style:{},events:{},classList:{add(){},remove(){}},className:'',textContent:'',open:false,
 append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},setAttribute(){},
 addEventListener(name,callback){this.events[name]=callback},setPointerCapture(){},
 getBoundingClientRect(){return {left:parseFloat(this.style.left)||100,top:parseFloat(this.style.top)||100,width:400,height:300}},
 showModal(){this.open=true},focus(){}});
const context=vm.createContext({window:{innerWidth:1000,innerHeight:800,addEventListener(){}},document:{body:{append:n=>nodes.push(n)},createElement:element}});
vm.runInContext(fs.readFileSync(new URL('../../item-search-ui.js',import.meta.url),'utf8'),context);
context.window.GuildLootItems.open({name:'Reif des Glaubens',quality:'episch',tooltip:'Circlet of Faith | Item Level 88 | +22 Ausdauer | Anlegen: Heilung +75 | Set: Testbonus | Haltbarkeit 37 / 60',raids:['naxx'],itemId:'test'});
const dialog=nodes[0],title=dialog.children.find(n=>n.tag==='header').children.find(n=>n.tag==='h2'),card=dialog.children.find(n=>n.className==='item-search-card');
assert.ok(dialog.className.includes('item-search-wow'));assert.ok(title.className.includes('epic'));
assert.ok(!card.children.some(n=>n.textContent==='Circlet of Faith'),'No duplicate English item title');
assert.ok(card.children.find(n=>n.textContent.startsWith('Anlegen')).className.includes('item-search-effect-start'));
assert.ok(card.children.find(n=>n.textContent.startsWith('Set:')).className.includes('item-search-effect'));
assert.ok(card.children.find(n=>n.textContent.startsWith('Haltbarkeit')).className.includes('item-search-footer-start'));
context.window.GuildLootItems.open({name:'<img onerror=alert(1)>',quality:'rare',stats:['+1 Stärke']});
assert.equal(dialog.children.find(n=>n.tag==='header').children.find(n=>n.tag==='h2').textContent,'<img onerror=alert(1)>','Names remain text, never HTML');
console.log('PASS: quality names, duplicate title suppression, green effects and set bonuses, footer spacing and safe text rendering.');

context.window.GuildLootItems.open({name:'Icon test',icon:'INV_Staff_13',quality:'rare'});
const header=dialog.children.find(n=>n.tag==='header'),icon=header.children[0];
assert.equal(icon.src,'https://wow.zamimg.com/images/wow/icons/large/inv_staff_13.jpg');
const pointer={button:0,pointerId:7,clientX:110,clientY:110,target:{closest:()=>null},preventDefault(){}};
header.events.pointerdown(pointer);header.events.pointermove({...pointer,clientX:10110,clientY:-500});
assert.equal(dialog.style.left,'592px');assert.equal(dialog.style.top,'8px');
header.events.pointercancel();header.events.pointermove({...pointer,clientX:120,clientY:120});assert.equal(dialog.style.left,'592px');
header.events.keydown({target:header,key:'ArrowLeft',shiftKey:false,preventDefault(){}});assert.equal(dialog.style.left,'582px');
header.events.pointerdown({...pointer,target:{closest:()=>({})}});header.events.pointermove({...pointer,clientX:120,clientY:120});assert.equal(dialog.style.left,'582px','Close button does not drag');
context.window.GuildLootItems.open({name:'Next',icon:'javascript:alert(1)'});assert.equal(dialog.style.left,'','Each item opens centered');
assert.ok(dialog.children[0].children[0].src.endsWith('inv_misc_questionmark.jpg'));
console.log('PASS: icon resolution and fallback, drag viewport limits, cancellation, keyboard movement, close-button exclusion and position reset.');
