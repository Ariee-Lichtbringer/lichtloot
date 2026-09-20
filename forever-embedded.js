(() => {
if(self===top)return;
function notify(){parent.postMessage({type:'forever-tool-navigation',name:location.hash.slice(1)},location.origin);}
addEventListener('forever-panel',notify);addEventListener('hashchange',notify);notify();
document.addEventListener('click',event=>{const a=event.target.closest('a');if(!a)return;const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;if(url.pathname.endsWith('/forever.html')){url.searchParams.set('embedded','1');const guild=new URLSearchParams(location.search).get('guild');if(guild)url.searchParams.set('guild',guild);a.href=url.href;a.removeAttribute('target');}} ,true);
})();
