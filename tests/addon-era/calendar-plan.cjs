const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../../guildloot-personal-export.js'),'utf8'));
const before=GuildLootPersonalExport.planCalendar(Date.parse('2026-09-08T10:00:00Z'));
assert(before.some(e=>e.date==='2026-09-09'&&e.title.includes('MC / BWL')&&new Date(e.startsAt*1000).getUTCHours()===7));
assert(before.some(e=>e.date==='2026-10-28'&&e.title.includes('MC / BWL')&&new Date(e.startsAt*1000).getUTCHours()===8));
assert(before.some(e=>e.date==='2026-11-09'&&e.title.includes('beginnt')));
assert(!before.some(e=>e.kind==='dmf'&&e.date==='2026-11-02'));
const winter=GuildLootPersonalExport.planCalendar(Date.parse('2026-12-28T10:00:00Z'));assert(winter.some(e=>e.date==='2027-01-04'&&e.title.includes('beginnt')));
console.log('Calendar plan: EU summer/winter times, Darkmoon and year transition passed.');
