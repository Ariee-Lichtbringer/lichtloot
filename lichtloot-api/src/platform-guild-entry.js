const fail=(message,statusCode)=>Object.assign(new Error(message),{statusCode});
export async function openPlatformGuildLeadership(body={},deps){
 // Authenticate before querying any guild or reading any guild credential.
 deps.authorize(body.masterCode);
 const slug=String(body.slug||'').trim().toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100)throw fail('Ungültige Gilde.',400);
 const result=await deps.query('select id,slug,name from guilds where lower(slug)=$1 limit 1',[slug]);
 const guild=result.rows[0];if(!guild)throw fail('Diese Gilde existiert nicht mehr. Bitte die Gildenliste aktualisieren.',404);
 const isDefault=[String(deps.defaultGuildSlug||'').toLowerCase(),'lichtloot'].includes(String(guild.slug).toLowerCase());
 const leadershipCode=deps.codeFor(guild.id)||(isDefault?deps.platformCode:'');
 if(!leadershipCode)throw fail('Für diese Gilde ist noch kein Leitungscode eingerichtet.',409);
 return {success:true,guild:{slug:guild.slug,name:guild.name},leadershipCode};
}
