// Shared public item search: no guild configuration or player data is exposed.
export const normalizeItemSearch = value => String(value ?? '').toLowerCase()
  .replace(/ä|ae/g,'a').replace(/ö|oe/g,'o').replace(/ü|ue/g,'u').replace(/ß/g,'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function distance(a,b){
 const rows=Array.from({length:a.length+1},(_,i)=>[i]);
 for(let j=0;j<=b.length;j++)rows[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }
 return rows[a.length][b.length];
}
export function rankItemSearch(rows,term,limit=25){
 const q=normalizeItemSearch(term).slice(0,100),tokens=q.split(/\s+/);
 if(q.length<2)return {items:[],total:0};
 const matches=[];
 for(const row of rows){
  const name=normalizeItemSearch(row.name),fields=normalizeItemSearch([row.name,row.raid_type,row.boss,row.slot,row.type].join(' '));
  const words=fields.split(' ');let score=0;
  if(/^\d+$/.test(q)){if(String(row.item_id)!==q)continue;}
  else {
   let valid=true;
   for(const token of tokens){
    if(fields.includes(token))continue;
    const max=token.length>=7?2:token.length>=4?1:0;
    const best=max?Math.min(...words.filter(w=>Math.abs(w.length-token.length)<=max).map(w=>distance(token,w)),99):99;
    if(best>max){valid=false;break;}score+=best*10;
   }
   if(!valid)continue;
   if(name===q)score-=100;else if(name.startsWith(q))score-=30;else if(name.includes(q))score-=20;
  }
  matches.push({row,score});
 }
 matches.sort((a,b)=>a.score-b.score||a.row.name.localeCompare(b.row.name,'de'));
 // The same WoW item can occur in multiple raids; retain every origin.
 const groups=new Map();
 for(const {row} of matches){
  const key=row.item_id?`id:${row.item_id}`:`row:${row.id}`;
  if(!groups.has(key))groups.set(key,{...row,raids:[]});
  const item=groups.get(key);if(row.raid_type&&!item.raids.includes(row.raid_type))item.raids.push(row.raid_type);
 }
 return {items:[...groups.values()].slice(0,limit),total:groups.size};
}
export async function searchLootCatalog(query,params,normalize){
 const term=String(params.q??'').trim().slice(0,100);
 if(normalizeItemSearch(term).length<2)return {success:true,items:[],total:0};
 const index=await query('select id, item_id, name, raid_type, boss, slot, type from items');
 const ranked=rankItemSearch(index.rows,term);
 if(!ranked.items.length)return {success:true,items:[],total:0};
 const details=await query(`select id, raid_type, item_id, name, quality, icon_url, slot, type, boss, bind, category, wowhead,
 stats_text, tooltip, needed, equip, price, dropchance, token_group, token_name, token_item_id
 from items where id = any($1::uuid[])`,[ranked.items.map(row=>row.id)]);
 const byId=new Map(details.rows.map(row=>[row.id,row]));
 return {success:true,total:ranked.total,items:ranked.items.filter(row=>byId.has(row.id)).map(row=>({...normalize(byId.get(row.id)),raids:row.raids}))};
}
