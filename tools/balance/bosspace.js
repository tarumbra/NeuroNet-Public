// Kills needed per boss set (armour + weapon), and for the essence spots (ESSENCE_WINS wins), from the
// boss's material drop and the kill gate: the full count once, then the rematch count (rematchKills).
// `node bosspace.js old` shows the 1.0.16 rules for comparison: 3-5 materials a win, full count every attempt.
const C=require("./core.js"); const old=process.argv[2]==="old";
const rows=[];
for (const g of C.HUNT_ORDER) {
  const H=C.HUNTS[g], mon=C.MONSTERS[H.boss], mat=mon.drops[0][0];
  const avg=old?4:(mon.drops[0][1]+mon.drops[0][2])/2;
  const sets={};
  for (const w of C.WORKSHOP_ORDER) for (const r of C.WORKSHOPS[w].recipes) if (r.needs[mat]) {
    const set=(C.ITEMS[r.make].gear||{}).set||"?"; sets[set]=(sets[set]||0)+r.needs[mat]; }
  const kills=(wins)=>old?wins*H.kills:H.kills+(wins-1)*C.rematchKills(H);
  const sl=Object.entries(sets);
  if (!sl.length) sl.push(["(no set)",0]);
  for (const [set,need] of sl) {
    const wins=need?Math.ceil(need/avg):0;
    rows.push(`${g.padEnd(10)} ${H.boss.padEnd(9)} ${set.padEnd(9)} ${String(need).padStart(3)} ${mat.padEnd(13)} ${avg}/win -> ${String(wins).padStart(2)} wins = ${String(need?kills(wins):"-").padStart(6)} kills · essence (${C.ESSENCE_WINS} wins): ${kills(C.ESSENCE_WINS)} kills`);
  }
}
console.log(rows.join("\n"));
