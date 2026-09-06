// Display reads are database-only. Refreshes run independently of page requests.
export function createWclAttendanceStore({query,fetchAttendance,now=()=>Date.now()}) {
  let schema;
  const pending=new Map();
  function ensure(){
    if(!schema)schema=(async()=>{
      await query(`create table if not exists wcl_attendance_snapshots (
        wcl_guild_id bigint not null, raid text not null, window_size integer not null,
        payload jsonb, fetched_at timestamptz, attempted_at timestamptz,
        lease_until timestamptz, primary key(wcl_guild_id,raid,window_size))`);
      await query(`create table if not exists wcl_attendance_reports (
        wcl_guild_id bigint not null, report_code text not null, raid text not null,
        payload jsonb not null, updated_at timestamptz not null default now(),
        primary key(wcl_guild_id,report_code))`);
    })().catch(error=>{schema=null;throw error;});
    return schema;
  }
  async function read(raid,guild,limit=16){
    await ensure();
    const {rows}=await query(`select payload,fetched_at from wcl_attendance_snapshots
      where wcl_guild_id=$1 and raid=$2 and window_size=$3`,[guild,raid,limit]);
    const row=rows[0];
    return row?.payload?{...row.payload,fetchedAt:row.fetched_at}:null;
  }
  async function refresh(raid,guild,limit=16,maxAgeMs=86400000){
    const key=JSON.stringify([guild,raid,limit]);
    if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      await ensure();
      // A database lease also prevents duplicate fetches during overlapping deployments.
      const {rows}=await query(`insert into wcl_attendance_snapshots
        (wcl_guild_id,raid,window_size,attempted_at,lease_until)
        values($1,$2,$3,now(),now()+interval '10 minutes')
        on conflict(wcl_guild_id,raid,window_size) do update
        set attempted_at=now(),lease_until=now()+interval '10 minutes'
        where (wcl_attendance_snapshots.lease_until is null or wcl_attendance_snapshots.lease_until<now())
          and (wcl_attendance_snapshots.fetched_at is null or wcl_attendance_snapshots.fetched_at<$4)
          and (wcl_attendance_snapshots.attempted_at is null or wcl_attendance_snapshots.attempted_at<now()-interval '15 minutes')
        returning attempted_at::text as attempted_at`,[guild,raid,limit,new Date(now()-maxAgeMs)]);
      if(!rows.length)return read(raid,guild,limit);
      const lease=rows[0].attempted_at;
      try{
        const value=await fetchAttendance(raid,guild,limit);
        for(const report of value.reports||[]){
          if(!report.code)continue;
          await query(`insert into wcl_attendance_reports(wcl_guild_id,report_code,raid,payload)
            values($1,$2,$3,$4::jsonb) on conflict(wcl_guild_id,report_code)
            do update set payload=excluded.payload,raid=excluded.raid,updated_at=now()`,[guild,report.code,raid,JSON.stringify(report)]);
        }
        const {reports,...payload}=value;
        await query(`update wcl_attendance_snapshots set payload=$4::jsonb,fetched_at=now(),lease_until=null
          where wcl_guild_id=$1 and raid=$2 and window_size=$3 and attempted_at=$5`,[guild,raid,limit,JSON.stringify(payload),lease]);
        return read(raid,guild,limit);
      }catch(error){
        await query(`update wcl_attendance_snapshots set lease_until=null
          where wcl_guild_id=$1 and raid=$2 and window_size=$3 and attempted_at=$4`,[guild,raid,limit,lease]);
        throw error;
      }
    })();
    pending.set(key,work);
    try{return await work;}finally{pending.delete(key);}
  }
  async function readReports(raid,guild,date){
    await ensure();
    const {rows}=await query(`select payload from wcl_attendance_reports
      where wcl_guild_id=$1 and raid=$2
        and ((to_timestamp((payload->>'startTime')::numeric/1000) at time zone 'Europe/Berlin')::date)=$3::date`,[guild,raid,date]);
    return rows.map(row=>row.payload);
  }
  return {ensure,read,refresh,readReports};
}
