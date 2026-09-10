export function createSupportDiscordReplies({query, ensureNotices, ensureMembers}) {
  const text=v=>String(v||'').trim();
  const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
  async function ticket(id){
    const row=(await query('select id,guild_id,contact_discord from platform_support_tickets where id=$1',[id])).rows[0];
    if(!row)fail('Supportmeldung nicht gefunden.',404);
    return row;
  }
  async function recipient(row){
    await ensureMembers();
    const contact=text(row.contact_discord).replace(/^<@!?(\d+)>$/,'$1').replace(/^@/,'');
    if(!contact)return null;
    const matches=await query(`select distinct user_id,username from discord_bot_members
      where guild_id=$1 and (user_id=$2 or lower(username)=lower($2)) limit 2`,[row.guild_id,contact]);
    if(matches.rows.length!==1)return null;
    const match=matches.rows[0];
    if(!/^\d{15,22}$/.test(match.user_id))return null;
    return {id:match.user_id,name:match.username||match.user_id};
  }
  function normalize(row){
    const p=row.payload||{};
    const state=p.deliveryState==='sending'&&Date.now()-Date.parse(p.deliveryStartedAt)>300000?'unknown':p.deliveryState||'queued';
    return {id:p.requestId,channel:'discord',recipient:p.targetName+' · '+p.targetUserId,subject:p.subject,message:p.message,status:state,
      createdAt:row.created_at,sentAt:state==='sent'?row.resolved_at:null,error:p.deliveryError||''};
  }
  async function history(id){
    await ensureNotices();const row=await ticket(id),target=await recipient(row);
    const result=await query(`select payload,created_at,resolved_at from bot_update_queue where type='po_support_notice' and payload->>'kind'='reply' and payload->>'ticketId'=$1 order by created_at`,[id]);
    return {success:true,recipient:target,contact:row.contact_discord,replies:result.rows.map(normalize)};
  }
  async function send(body){
    const id=text(body.id),requestId=text(body.requestId),subject=text(body.subject),message=text(body.message);
    if(!/^[0-9a-f-]{36}$/i.test(requestId)||!subject||subject.length>180||!message||message.length>3500)fail('Bitte Betreff und Antwort (maximal 3.500 Zeichen) eingeben.');
    await ensureNotices();const row=await ticket(id);
    const key='support-reply:'+requestId;
    const existing=(await query(`select payload,created_at,resolved_at from bot_update_queue where type='po_support_notice' and payload->>'noticeKey'=$1`,[key])).rows[0];
    if(existing){const p=existing.payload;if(p.ticketId!==id||p.subject!==subject||p.message!==message)fail('Dieser Versandvorgang gehört zu einer anderen Antwort.',409);return {success:true,reply:normalize(existing)};}
    const target=await recipient(row);if(!target)fail('Der Discord-Kontakt wurde in dieser Gilde nicht eindeutig gefunden. Es wurde keine DM gesendet.');
    const payload={noticeKey:key,kind:'reply',ticketId:id,requestId,targetUserId:target.id,targetName:target.name,subject,message};
    const inserted=await query(`insert into bot_update_queue(guild_id,type,payload,status) values($1,'po_support_notice',$2::jsonb,'open') on conflict do nothing returning payload,created_at,resolved_at`,[row.guild_id,JSON.stringify(payload)]);
    if(!inserted.rows.length)return send(body);
    return {success:true,reply:normalize(inserted.rows[0])};
  }
  return {history,send};
}
