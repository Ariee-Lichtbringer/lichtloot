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
const form=document.getElementById('betaLoginForm'),host=document.getElementById('betaClassPicker');
if(!form||!host)return;
const spec=form.elements.specialization,role=form.elements.role;
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
  spec.replaceChildren(new Option('Skillung auswählen',''),...specs.map(([name,r])=>{const o=new Option(name+' · '+({tank:'Tank',dd:'DD',heal:'Heal'}[r]),name);o.dataset.role=r;return o;}));
  spec.disabled=false;role.value='';
  requestAnimationFrame(()=>{menu.open=false;spec.focus();});
 });
}
menu.append(summary,group);host.append(title,menu);
spec.addEventListener('change',()=>{role.value=spec.selectedOptions[0]?.dataset.role||'';});
menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();}});
document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
})();
