(() => {
'use strict';
const classes={
  "warrior": [
    "Krieger",
    "krieger.png",
    [
      [
        "Waffen",
        "dd"
      ],
      [
        "Furor",
        "dd"
      ],
      [
        "Schutz",
        "tank"
      ]
    ]
  ],
  "paladin": [
    "Paladin",
    "Pala.png",
    [
      [
        "Heilig",
        "heal"
      ],
      [
        "Schutz",
        "tank"
      ],
      [
        "Vergeltung",
        "dd"
      ]
    ]
  ],
  "hunter": [
    "Jäger",
    "forever/hunter.png",
    [
      [
        "Tierherrschaft",
        "dd"
      ],
      [
        "Treffsicherheit",
        "dd"
      ],
      [
        "Überleben",
        "dd"
      ]
    ]
  ],
  "rogue": [
    "Schurke",
    "schurke.png",
    [
      [
        "Meucheln",
        "dd"
      ],
      [
        "Kampf",
        "dd"
      ],
      [
        "Täuschung",
        "dd"
      ]
    ]
  ],
  "priest": [
    "Priester",
    "priester.png",
    [
      [
        "Disziplin",
        "heal"
      ],
      [
        "Heilig",
        "heal"
      ],
      [
        "Schatten",
        "dd"
      ]
    ]
  ],
  "shaman": [
    "Schamane",
    "forever/shaman.jpg",
    [
      [
        "Elementar",
        "dd"
      ],
      [
        "Verstärkung",
        "dd"
      ],
      [
        "Wiederherstellung",
        "heal"
      ]
    ]
  ],
  "mage": [
    "Magier",
    "magier.png",
    [
      [
        "Arkan",
        "dd"
      ],
      [
        "Feuer",
        "dd"
      ],
      [
        "Frost",
        "dd"
      ]
    ]
  ],
  "warlock": [
    "Hexenmeister",
    "hexenmeister.png",
    [
      [
        "Gebrechen",
        "dd"
      ],
      [
        "Dämonologie",
        "dd"
      ],
      [
        "Zerstörung",
        "dd"
      ]
    ]
  ],
  "druid": [
    "Druide",
    "druide.png",
    [
      [
        "Gleichgewicht",
        "dd"
      ],
      [
        "Wildheit (Katze)",
        "dd"
      ],
      [
        "Wildheit (Bär)",
        "tank"
      ],
      [
        "Wiederherstellung",
        "heal"
      ]
    ]
  ]
};
const specIcons={"warrior": {"Waffen": "ability_rogue_eviscerate", "Furor": "ability_warrior_innerrage", "Schutz": "inv_shield_06"}, "paladin": {"Heilig": "spell_holy_holybolt", "Schutz": "spell_holy_devotionaura", "Vergeltung": "spell_holy_auraoflight"}, "hunter": {"Tierherrschaft": "ability_hunter_beasttaming", "Treffsicherheit": "ability_marksmanship", "Überleben": "ability_hunter_swiftstrike"}, "rogue": {"Meucheln": "ability_rogue_eviscerate", "Kampf": "ability_backstab", "Täuschung": "ability_stealth"}, "priest": {"Disziplin": "spell_holy_wordfortitude", "Heilig": "spell_holy_guardianspirit", "Schatten": "spell_shadow_shadowwordpain"}, "shaman": {"Elementar": "spell_nature_lightning", "Verstärkung": "spell_nature_lightningshield", "Wiederherstellung": "spell_nature_magicimmunity"}, "mage": {"Arkan": "spell_holy_magicalsentry", "Feuer": "spell_fire_firebolt02", "Frost": "spell_frost_frostbolt02"}, "warlock": {"Gebrechen": "spell_shadow_deathcoil", "Dämonologie": "spell_shadow_metamorphosis", "Zerstörung": "spell_shadow_rainoffire"}, "druid": {"Gleichgewicht": "spell_nature_starfall", "Wilder Kampf": "ability_racial_bearform", "Wiederherstellung": "spell_nature_healingtouch", "Wildheit (Katze)": "ability_druid_catform", "Wildheit (Bär)": "ability_racial_bearform"}};
const form=document.getElementById('betaLoginForm'),host=document.getElementById('betaClassPicker');
if(!form||!host)return;
const role=form.elements.role,specHost=document.getElementById('betaSpecPicker');
const specTitle=document.createElement('span');specTitle.textContent='Skillung';specTitle.id='betaSpecLabel';
const specMenu=document.createElement('details');specMenu.className='beta-class-menu beta-spec-menu';
const specSummary=document.createElement('summary');specSummary.id='betaSpecValue';specSummary.textContent='Zuerst Klasse auswählen';specSummary.setAttribute('aria-labelledby','betaSpecLabel betaSpecValue');specSummary.setAttribute('aria-disabled','true');
const specGroup=document.createElement('fieldset');specGroup.setAttribute('aria-labelledby','betaSpecLabel');
specMenu.append(specSummary,specGroup);specHost.append(specTitle,specMenu);
specSummary.addEventListener('click',event=>{if(specSummary.getAttribute('aria-disabled')==='true')event.preventDefault();});
function specIcon(key,name,fallback){const image=icon(fallback);const id=specIcons[key]?.[name];if(id){image.src='https://wow.zamimg.com/images/wow/icons/large/'+id+'.jpg';image.onerror=()=>{image.onerror=null;image.src='images/'+fallback;};}return image;}
function renderSpecs(key,path,specs){
 specGroup.replaceChildren();specMenu.open=false;specSummary.textContent='Skillung auswählen';specSummary.removeAttribute('aria-disabled');role.value='';
 for(const [name,r] of specs){
  const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
  const caption=name+' · '+({tank:'Tank',dd:'DD',heal:'Heal'}[r]);
  input.type='radio';input.name='specialization';input.value=name;input.required=true;input.setAttribute('aria-label',caption);text.textContent=caption;
  label.append(input,specIcon(key,name,path),text);specGroup.append(label);
  input.addEventListener('invalid',()=>{specMenu.open=true;});
  input.addEventListener('change',()=>{if(!input.checked)return;role.value=r;specSummary.replaceChildren(specIcon(key,name,path),document.createTextNode(caption));requestAnimationFrame(()=>{specMenu.open=false;specSummary.focus();});});
 }
}
specMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){specMenu.open=false;specSummary.focus();}});
document.addEventListener('click',event=>{if(!specMenu.contains(event.target))specMenu.open=false;});
const title=document.createElement('span');title.textContent='Klasse';title.id='betaClassLabel';
const menu=document.createElement('details');menu.className='beta-class-menu';
const summary=document.createElement('summary');summary.textContent='Klasse auswählen';summary.setAttribute('aria-labelledby','betaClassLabel betaClassValue');summary.id='betaClassValue';
const group=document.createElement('fieldset');group.setAttribute('aria-labelledby','betaClassLabel');
function icon(path){const image=document.createElement('img');image.src='images/'+path;image.alt='';image.width=30;image.height=30;return image;}
for(const [key,[name,path,specs]] of Object.entries(classes)){
 const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
 input.setAttribute('aria-label',name);input.type='radio';input.name='className';input.value=key;input.required=true;text.textContent=name;
 label.append(input,icon(path),text);group.append(label);
 input.addEventListener('invalid',()=>{menu.open=true;});
 input.addEventListener('change',()=>{
  if(!input.checked)return;
  summary.replaceChildren(icon(path),document.createTextNode(name));menu.open=false;
  renderSpecs(key,path,specs);
  requestAnimationFrame(()=>{menu.open=false;specSummary.focus();});
 });
}
menu.append(summary,group);host.append(title,menu);
menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();}});
document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
})();
