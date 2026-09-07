// Explicit Classic T3 item identities, including the directly dropped set rings.
const sets=[
 [22416,23059,'krieger kriegerin warrior schreckenspanzer dreadnaught'],
 [22424,23066,'paladin paladine pala erlosung redemption'],
 [22436,23067,'jager jagerin hunter gruftpirscher cryptstalker'],
 [22464,23065,'schamane schamanin shaman sham erderschutterer earthshatter'],
 [22476,23060,'schurke schurkin rogue schnitter bonescythe'],
 [22488,23064,'druide druidin druid traumwandler dreamwalker'],
 [22496,23062,'magier magierin mage frostfeuer frostfire'],
 [22504,23063,'hexenmeister hexenmeisterin warlock hexer verseuchtes herz plagueheart'],
 [22512,23061,'priester priesterin priest glauben faith']
];
const aliases=new Map();for(const [start,ring,keywords] of sets){const words=`t3 t 3 tier3 tier 3 set naxxramas ${keywords}`;for(let id=start;id<start+8;id++)aliases.set(String(id),words);aliases.set(String(ring),words);}
export const t3SearchAliases=itemId=>aliases.get(String(itemId))||'';
