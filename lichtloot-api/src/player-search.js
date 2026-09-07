import {normalizeItemSearch,rankItemSearch} from './item-search.js';
export function rankPlayerSearch(rows,term){
 const ranked=rankItemSearch(rows.map((r,index)=>({...r,id:String(index),item_id:'',raid_type:r.server})),term,25);
 return {success:true,total:ranked.total,players:ranked.items.map(r=>({name:r.name,server:r.server,className:r.class_name||''}))};
}
export async function searchGuildPlayers(query,guildId,term){
 if(normalizeItemSearch(term).length<2)return {success:true,total:0,players:[]};
 const result=await query(`select distinct name,server,max(class_name) as class_name from (
 select c.name,coalesce(c.server,'') as server,coalesce(c.class_name,'') as class_name
 from characters c join players p on p.id=c.player_id where p.guild_id=$1
 union all
 select player_name as name,coalesce(server,'') as server,'' as class_name
 from unlinked_p0plus_points where guild_id=$1
 ) candidates group by name,server order by name,server`,[guildId]);
 return rankPlayerSearch(result.rows,String(term||'').slice(0,100));
}
export function publicPlayerPoints(entries,name,server){
 // Preserve accents in identity matching; fuzzy search must not merge different characters.
 const exact=v=>String(v||'').trim().normalize('NFC').toLowerCase();
 const points=entries.filter(r=>exact(r.player)===exact(name)&&exact(r.server)===exact(server))
 .map(r=>({raid:r.raid,item:r.item,points:Number(r.points)||0}));
 return {success:true,name,server,entries:points,total:Math.round(points.reduce((sum,r)=>sum+r.points,0)*100)/100};
}
