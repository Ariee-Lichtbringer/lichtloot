// Explicit Classic AQ40 T2.5 set identities; tokens and imperial weapons are not set pieces.
const sets=[
 [
  [
   21329,
   21330,
   21331,
   21332,
   21333
  ],
  "krieger kriegerin warrior eroberer conqueror"
 ],
 [
  [
   21387,
   21388,
   21389,
   21390,
   21391
  ],
  "paladin pala racher avenger"
 ],
 [
  [
   21365,
   21366,
   21367,
   21368,
   21370
  ],
  "jager jagerin hunter hetzer striker"
 ],
 [
  [
   21359,
   21360,
   21361,
   21362,
   21364
  ],
  "schurke schurkin rogue todesbote deathdealer"
 ],
 [
  [
   21348,
   21349,
   21350,
   21351,
   21352
  ],
  "priester priesterin priest orakel oracle"
 ],
 [
  [
   21372,
   21373,
   21374,
   21375,
   21376
  ],
  "schamane schamanin shaman sham sturmrufer stormcaller"
 ],
 [
  [
   21343,
   21344,
   21345,
   21346,
   21347
  ],
  "magier magierin mage mysterium enigma"
 ],
 [
  [
   21334,
   21335,
   21336,
   21337,
   21338
  ],
  "hexenmeister hexenmeisterin warlock hexer verdammnisrufer doomcaller"
 ],
 [
  [
   21353,
   21354,
   21355,
   21356,
   21357
  ],
  "druide druidin druid genesis"
 ]
];
const aliases=new Map();
for(const [ids,keywords] of sets)for(const id of ids)aliases.set(String(id),`t25 aq40 set ${keywords}`);
export const aq40SearchAliases=itemId=>aliases.get(String(itemId))||'';
