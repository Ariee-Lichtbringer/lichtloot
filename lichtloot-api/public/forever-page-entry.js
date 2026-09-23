(() => {
const match=location.pathname.match(/forever-(hyjal|barrow|onyxia|pluendermeister)\.html$/);
if(match&&!location.hash){const u=new URL(location.href);if(match[1]!=='pluendermeister')u.searchParams.set('loot',match[1]);u.hash=match[1]==='pluendermeister'?'pluendermeister':'prioseiten';history.replaceState(null,'',u);}
document.addEventListener('DOMContentLoaded',()=>{for(const a of document.querySelectorAll('a[href="#pluendermeister"]')){const u=new URL('forever-pluendermeister.html',location.href);u.search=location.search;u.hash='pluendermeister';a.href=u.href;}});
})();
