(() => {
  'use strict';
  const form=document.getElementById('betaFeedback'),status=document.getElementById('feedbackStatus'),button=form.querySelector('button');let sending=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(sending||!form.reportValidity())return;sending=true;button.disabled=true;status.textContent='Deine Rückmeldung wird gesendet …';
    const values=Object.fromEntries(new FormData(form));
    const message=['Art: '+values.kind,'Addon-Version: '+values.version,'','Beschreibung:',values.description,'','Schritte zum Nachstellen:',values.steps||'Nicht angegeben','','Erwartetes Verhalten:',values.expected||'Nicht angegeben'].join('\n');
    try{
      const response=await fetch('https://lichtloot-production.up.railway.app/api/apps-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submitSupportTicket',guild:'lichtloot',category:'addon_beta',subject:'[Addon-Betatest] '+values.subject,message,contactName:values.contactName,contactDiscord:values.contactDiscord,contactEmail:values.contactEmail,pageUrl:location.href})});
      const result=await response.json().catch(()=>({}));if(!response.ok||!result.success)throw Error(result.error||'Die Rückmeldung konnte nicht gesendet werden.');
      form.reset();status.textContent='Danke! Deine Rückmeldung ist im Adminbereich angekommen. Vorgangsnummer: '+result.ticket.id;button.textContent='Weitere Rückmeldung senden';
    }catch(error){status.textContent=error.message+' Deine Eingaben bleiben erhalten.';}finally{sending=false;button.disabled=false;}
  });
})();
