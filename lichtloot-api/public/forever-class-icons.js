(() => {
const classes={warrior:['krieger.png','#c79c6e'],paladin:['Pala.png','#f58cba'],hunter:['forever/hunter.png','#abd473'],rogue:['schurke.png','#fff569'],priest:['priester.png','#ffffff'],shaman:['forever/shaman.jpg','#0070de'],mage:['magier.png','#69ccf0'],warlock:['hexenmeister.png','#9482c9'],druid:['druide.png','#ff7d0a']};
window.foreverClassIdentity=(container,info,className)=>{
 const spec=classes[className];if(!spec)return;
 container.classList.add('forever-class-row');container.style.setProperty('--class-color',spec[1]);
 const icon=document.createElement('img');icon.className='forever-class-icon';icon.src='images/'+spec[0];icon.alt='';icon.width=42;icon.height=42;icon.loading='lazy';icon.decoding='async';
 info.classList.add('forever-class-copy');const identity=document.createElement('div');identity.className='forever-class-identity';identity.append(icon,info);container.append(identity);
};
})();
