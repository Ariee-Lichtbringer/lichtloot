(() => {
window.foreverRaidArt=(raid,cls='forever-raid-art')=>{
 const defaults={hyjal:'hyjal',barrow:'barrow',onyxia:'onyxia'},image=document.createElement('img');
 const fallback=defaults[raid.kind]?'images/forever/raids/'+defaults[raid.kind]+'-v1.jpg':'images/forever/adventure.jpg';
 let source=fallback;try{const u=new URL(raid.image_url);if(u.protocol==='https:')source=u.href;}catch{}
 image.src=source;image.alt='';image.className=cls;image.loading='lazy';image.decoding='async';image.width=1672;image.height=941;image.onerror=()=>{image.onerror=null;image.src=fallback;};return image;
};
})();
