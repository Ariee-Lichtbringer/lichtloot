// Calendar values are SQL DATE strings; posting times are always Europe/Berlin.
export function calendarDate(value) {
  if (!value) return '';
  if (value instanceof Date) return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
  return String(value).slice(0,10);
}
export function shiftDate(value, days) {
  const d=new Date(calendarDate(value)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
export function berlinNow(now=new Date()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function scheduleWindow(s, now=new Date()) {
  const today=berlinNow(now).slice(0,10), step=Math.max(1,Number(s.interval_weeks)||1)*7;
  let raid=calendarDate(s.next_raid_date);
  if(!raid){const day=new Date(today+'T12:00:00Z').getUTCDay()||7;raid=shiftDate(today,(Number(s.weekday)-day+7)%7);}
  let post=calendarDate(s.next_post_date)||raid;
  // A post after this week's start opens registration for the next occurrence.
  while(post+'T'+(s.post_time||'00:00')>=raid+'T'+(s.raid_time||'00:00'))raid=shiftDate(raid,step);
  while(raid+'T'+(s.raid_time||'23:59')<berlinNow(now)){raid=shiftDate(raid,step);post=shiftDate(post,step);}
  return {raid,post,step,due:post+'T'+(s.post_time||'00:00')<=berlinNow(now)};
}
export function createWeeklyScheduler({query,transaction,createRaid,enqueue,randomCode}) {
  return async function process({guildId,force=false,scheduleId=''}) {
    const ids=(await query('select id from raid_helper_schedules where guild_id=$1 and enabled=true and ($2::text=\'\' or id::text=$2) order by id',[guildId,scheduleId])).rows;
    const result=[];
    for(const {id} of ids){
      try {result.push(await transaction(async()=>{
        const s=(await query('select * from raid_helper_schedules where guild_id=$1 and id=$2 and enabled=true for update skip locked',[guildId,id])).rows[0];
        if(!s)return {scheduleId:id,skipped:true,reason:'locked'};
        const w=scheduleWindow(s);
        if(!w.due&&!force)return {scheduleId:id,skipped:true,reason:'not_due',nextRaidDate:w.raid,nextPostDate:w.post};
        if(!s.discord_channel_id)throw Error('Discord-Kanal fehlt.');
        const occurrenceId=`schedule-${id}-${w.raid}`;
        const previous=(await query('select discord_message_id,discord_channel_id from raids where guild_id=$1 and id=$2',[guildId,s.last_raid_id])).rows[0];
        const raid=await createRaid({guildId,query:{raidId:occurrenceId,raid:s.raid_type,raidName:s.title,raidDate:w.raid,raidTime:s.raid_time,playerPin:randomCode(3),leadPin:randomCode(4),status:'geschlossen',p0PlusFreigabe:'geöffnet',createdBy:s.created_by||'Gildenleitung',raidHelperEnabled:'true',prioEnabled:s.prio_enabled===false?'false':'true',showWorldbuffs:s.show_worldbuffs===false?'false':'true',discordChannelId:s.discord_channel_id,description:s.description,maxPlayers:s.max_players,tankSlots:s.tank_slots,healSlots:s.heal_slots,ddSlots:s.dd_slots,signupDeadline:s.signup_deadline,linkUrl:s.link_url,linkText:s.link_text,linkIcon:s.link_icon,raidImageUrl:s.raid_image_url}});
        if(raid.success===false)throw Error(raid.error||'Raid konnte nicht erstellt werden.');
        const actualId=raid.raidId||raid.external_raid_id||raid.id;
        if(!actualId||!raid.id)throw Error('Gespeicherte Raid-ID fehlt.');
        // A reused raid keeps both its public ID and its canonical post/channel.
        const channel=raid.discordMessageId ? raid.discordChannelId : s.discord_channel_id;
        const job=await enqueue({guildId,type:'raid_announcement',payload:{raidId:actualId,raidDate:w.raid,raidTime:s.raid_time,channelId:channel,discordChannelId:channel,source:'raid_helper_schedule',scheduleId:id,updateExistingOnly:Boolean(raid.discordMessageId),clearChannelBeforePost:s.clear_channel_before_post===true,previousMessageId:previous?.discord_channel_id===channel?previous?.discord_message_id:'',postMode:'raid_p0',raidSignupEnabled:'true'}});
        if(job.success===false)throw Error(job.error||'Versandauftrag konnte nicht gespeichert werden.');
        await query('update raid_helper_schedules set next_raid_date=$3,next_post_date=$4,last_raid_date=$5,last_raid_id=$6,last_error=null,updated_at=now() where guild_id=$1 and id=$2',[guildId,id,shiftDate(w.raid,w.step),shiftDate(w.post,w.step),w.raid,raid.id]);
        return {scheduleId:id,raidId:actualId,queued:true,nextRaidDate:w.raid,nextPostDate:w.post};
      }));}catch(error){await query('update raid_helper_schedules set last_error=$3 where guild_id=$1 and id=$2',[guildId,id,error.message]);result.push({scheduleId:id,queued:false,error:error.message});console.warn('Wochenrhythmus fehlgeschlagen:',id,error.message);}
    }
    return result;
  };
}
