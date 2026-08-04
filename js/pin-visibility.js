(function(){
  function installStyles(){
    if(document.getElementById("lichtloot-pin-visibility-styles"))return;
    const style=document.createElement("style");
    style.id="lichtloot-pin-visibility-styles";
    style.textContent='.lichtloot-pin-row{display:flex;align-items:stretch;gap:7px;width:100%}.lichtloot-pin-row>input{flex:1;min-width:0}.lichtloot-pin-toggle{flex:0 0 auto;min-height:36px;padding:7px 11px;border:1px solid rgba(250,204,21,.58);border-radius:8px;background:rgba(250,204,21,.1);color:#fde68a;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.lichtloot-pin-toggle:hover{background:#facc15;color:#321800}@media(max-width:560px){.lichtloot-pin-row{flex-wrap:wrap}.lichtloot-pin-toggle{width:100%}}';
    document.head.appendChild(style);
  }

  function addToggle(input){
    if(!input || input.dataset.pinVisibilityReady==="true")return;
    input.dataset.pinVisibilityReady="true";
    input.type="password";
    const row=document.createElement("div");
    row.className="lichtloot-pin-row";
    input.parentNode.insertBefore(row,input);
    row.appendChild(input);
    const button=document.createElement("button");
    button.type="button";
    button.className="lichtloot-pin-toggle";
    button.textContent="LichtLoot-PIN anzeigen";
    button.setAttribute("aria-pressed","false");
    button.addEventListener("click",function(){
      const show=input.type==="password";
      input.type=show?"text":"password";
      button.textContent=show?"LichtLoot-PIN verbergen":"LichtLoot-PIN anzeigen";
      button.setAttribute("aria-pressed",show?"true":"false");
    });
    row.appendChild(button);
  }

  function init(){
    installStyles();
    addToggle(document.getElementById("myPriosPin"));
    addToggle(document.getElementById("twinkPlayerPin"));
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
