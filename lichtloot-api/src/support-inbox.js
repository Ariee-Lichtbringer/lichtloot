// Import only structurally linked replies from the ticket's recorded correspondent.
const header=(m,name)=>(m.payload?.headers||[]).find(h=>String(h.name).toLowerCase()===name)?.value||'';
const ids=value=>String(value).match(/<[^<>\s]{1,998}>/g)||[];
const address=value=>{const match=String(value).match(/<([^<>]+)>/);const email=(match?match[1]:String(value)).trim().toLowerCase();return /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email)?email:'';};
export function supportMessageText(payload){
  const parts=[];function walk(p){if(!p||p.filename)return;if(p.body?.data&&['text/plain','text/html'].includes(p.mimeType)){const encoding=(p.headers||[]).find(h=>String(h.name).toLowerCase()==='content-type')?.value?.match(/charset=["']?([^;\s"']+)/i)?.[1]||'utf-8';let text;try{text=new TextDecoder(encoding).decode(Buffer.from(p.body.data,'base64url'));}catch{text=Buffer.from(p.body.data,'base64url').toString('utf8');}parts.push({type:p.mimeType,text});}for(const child of p.parts||[])walk(child);}walk(payload);
  const plain=parts.filter(p=>p.type==='text/plain');let text=plain.length?plain.map(p=>p.text).join('\n'):parts.map(p=>p.text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\s*(?:br|\/p|\/div|\/li)\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x])).join('\n');
  text=text.replace(/\u0000/g,'').trim();return text.length>50000?text.slice(0,50000)+'\n[Nachricht gekürzt – vollständige Nachricht in Gmail]':text||'[Kein Textinhalt. Bitte die Nachricht in Gmail öffnen.]';
}
export function relatedSupportMessages(messages,anchors,recipient,sender,known=[]){
  const trusted=new Set(known.filter(Boolean)),ownIds=new Set(anchors.map(a=>a.gmail_message_id).filter(Boolean));
  for(const a of anchors)trusted.add(`<support-reply-${a.id}@lichtloot.de>`);
  // Gmail IDs anchor our own messages even if Gmail rewrote their RFC Message-ID.
  for(const m of messages)if(ownIds.has(m.id))for(const id of ids(header(m,'message-id')))trusted.add(id);
  const accepted=new Map();let changed=true;
  while(changed){changed=false;for(const m of messages){if(accepted.has(m.id)||m.labelIds?.some(x=>['SENT','DRAFT','TRASH','SPAM'].includes(x)))continue;
    if(address(header(m,'from'))!==recipient.toLowerCase()||address(header(m,'from'))===sender.toLowerCase())continue;
    if(!ids(header(m,'in-reply-to')+' '+header(m,'references')).some(id=>trusted.has(id)))continue;
    accepted.set(m.id,m);for(const id of ids(header(m,'message-id')))trusted.add(id);changed=true;
  }}return [...accepted.values()];
}
export function createSupportInbox({query,gmailApi,ensureReplySchema}){
  let schemaPromise;
  async function ensure(){if(!schemaPromise)schemaPromise=(async()=>{
    await ensureReplySchema();
    await query(`create table if not exists platform_support_incoming (
      gmail_id text primary key,ticket_id uuid not null references platform_support_tickets(id) on delete cascade,
      thread_id text not null,rfc_id text not null default '',sender text not null,subject text not null,message text not null,
      received_at timestamptz not null,imported_at timestamptz not null default now(),read_at timestamptz,attachments integer not null default 0)`);
    await query(`create index if not exists idx_support_incoming_ticket on platform_support_incoming(ticket_id,received_at)`);
    await query(`create table if not exists platform_support_inbox_sync(ticket_id uuid primary key references platform_support_tickets(id) on delete cascade,attempted_at timestamptz,success_at timestamptz,error text not null default '',locked_until timestamptz)`);
  })().catch(e=>{schemaPromise=null;throw e});return schemaPromise;}
  async function history(id){await ensure();const rows=await query('select * from platform_support_incoming where ticket_id=$1 order by received_at,gmail_id',[id]);const sync=(await query('select success_at,error from platform_support_inbox_sync where ticket_id=$1',[id])).rows[0];return {incoming:rows.rows.map(r=>({id:r.gmail_id,direction:'incoming',sender:r.sender,subject:r.subject,message:r.message,createdAt:new Date(r.received_at).toISOString(),unread:!r.read_at,attachments:r.attachments})),sync:{lastSuccess:sync?.success_at?new Date(sync.success_at).toISOString():'',error:sync?.error||''}};}
  async function markRead(id,messageIds){await ensure();const list=Array.isArray(messageIds)?messageIds.filter(x=>typeof x==='string').slice(0,500):[];await query('update platform_support_incoming set read_at=now() where ticket_id=$1 and gmail_id=any($2::text[]) and read_at is null',[id,list]);return {success:true};}
  async function latest(id){await ensure();return (await query('select rfc_id,thread_id from platform_support_incoming where ticket_id=$1 order by received_at desc limit 1',[id])).rows[0]||null;}
  async function syncTicket(id){
    await ensure();const state=await gmailApi.status();if(!state.readConnected)return {skipped:true,reason:'Bitte Google-Freigabe für den E-Mail-Eingang erneuern.'};
    await query('insert into platform_support_inbox_sync(ticket_id) values($1) on conflict do nothing',[id]);
    const lock=await query("update platform_support_inbox_sync set locked_until=now()+interval '10 minutes',attempted_at=now() where ticket_id=$1 and (locked_until is null or locked_until<now()) returning ticket_id",[id]);if(!lock.rows.length)return {skipped:true,reason:'Abruf läuft bereits.'};
    try{
      const ticket=(await query('select contact_email from platform_support_tickets where id=$1',[id])).rows[0];
      const anchors=(await query("select id,gmail_message_id,gmail_thread_id from platform_support_replies where ticket_id=$1 and status in ('sent','unknown')",[id])).rows;
      const known=(await query('select rfc_id from platform_support_incoming where ticket_id=$1',[id])).rows.map(r=>r.rfc_id);
      let imported=0;
      if(ticket?.contact_email&&anchors.length){
        const messages=await gmailApi.supportThreadMetadata(anchors);
        const candidates=relatedSupportMessages(messages,anchors,ticket.contact_email,state.email,known);
        const relatedIds=[...known,...candidates.flatMap(m=>ids(header(m,'message-id')))];
        for(const meta of candidates){
          if((await query('select gmail_id from platform_support_incoming where gmail_id=$1',[meta.id])).rows.length)continue;
          const full=await gmailApi.supportMessage(meta.id);
          // Recheck fetched headers, never trust a cached subject or thread membership alone.
          if(!relatedSupportMessages([full],anchors,ticket.contact_email,state.email,relatedIds).length)continue;
          let attachments=0;function count(p){if(p?.filename)attachments++;for(const c of p?.parts||[])count(c);}count(full.payload);
          const date=new Date(Number(full.internalDate));if(!Number.isFinite(date.getTime()))continue;
          const added=await query(`with inserted as (
            insert into platform_support_incoming(gmail_id,ticket_id,thread_id,rfc_id,sender,subject,message,received_at,attachments)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(gmail_id) do nothing returning ticket_id
          ), reopened as (update platform_support_tickets set status=case when status='resolved' then 'in_progress' else status end,resolved_at=null,updated_at=now() where id in(select ticket_id from inserted) returning id)
          select ticket_id from inserted`,[full.id,id,full.threadId,ids(header(full,'message-id'))[0]||'',ticket.contact_email,header(full,'subject').replace(/\u0000/g,'').slice(0,500),supportMessageText(full.payload),date.toISOString(),attachments]);
          imported+=added.rows.length;
        }
      }
      await query("update platform_support_inbox_sync set success_at=now(),error='',locked_until=null where ticket_id=$1",[id]);return {imported};
    }catch(e){await query('update platform_support_inbox_sync set error=$2,locked_until=null where ticket_id=$1',[id,e.code==='GMAIL_READ_REQUIRED'?'Google-Lesefreigabe fehlt. Bitte erneut verbinden.':'Gmail-Abruf fehlgeschlagen. Bestehende Nachrichten bleiben erhalten.']);return {error:'Gmail-Abruf fehlgeschlagen. Bitte die Verbindung prüfen.'};}
  }
  async function tick(){if(!(await gmailApi.status()).readConnected)return;await ensure();const tickets=await query(`select t.id from platform_support_tickets t left join platform_support_inbox_sync s on s.ticket_id=t.id where exists(select 1 from platform_support_replies r where r.ticket_id=t.id and r.status in ('sent','unknown')) and (s.locked_until is null or s.locked_until<now()) order by s.attempted_at nulls first limit 5`);for(const t of tickets.rows)await syncTicket(t.id);}
  return {ensure,history,markRead,latest,syncTicket,tick};
}
