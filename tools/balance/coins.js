const C=require("./core.js");
const SPEED={mining:0.6,lumbering:0.6,foraging:0.6,fishing:0.7,digging:1};
const rows=[];
for (const k of C.GATHERING) for (const s of C.SKILLS[k].spots) { if (s.essence) continue;
  const tot=s.loot.reduce((a,l)=>a+l[1],0); let v=0; for (const [i,w] of s.loot) v+=C.priceOf(i)*w/tot;
  const perH=3600/(s.time*SPEED[k]); rows.push([k,s.id,s.level,Math.round(v*perH),s.loot[0][0]+"="+C.priceOf(s.loot[0][0])]); }
rows.sort((a,b)=>a[2]-b[2]);
for (const lv of [1,10,20,30,40,50]) { const best=rows.filter(r=>r[2]<=lv).sort((a,b)=>b[3]-a[3]).slice(0,3); console.log("lv",lv,"best coins/h:",best.map(r=>r.join(":")).join(" | ")); }
console.log("SELL table by gem:",[1,2,4,7,12,20,32,50,75,110,160].join(","));
// hunting coins
for (const [g,h] of Object.entries(C.HUNTS)) { const tot=h.monsters.reduce((a,m)=>a+m[1],0); let v=0;
  for (const [m,w] of h.monsters) for (const d of C.MONSTERS[m].drops) v+=w/tot*C.priceOf(d[0])*(d[1]+d[2])/2*d[3];
  const killsH=3600/((5+h.time)/2+15); console.log("hunt",g,"coins/kill",v.toFixed(1),"~coins/h",Math.round(v*killsH)); }
// fees
console.log("fees: smelt",C.WORKSHOPS.furnace.recipes.map(r=>r.make+":"+r.fee).join(" "));
console.log("tanner",C.WORKSHOPS.tanner.recipes.map(r=>r.make+":"+r.fee+" sells "+C.priceOf(r.make)+" from "+Object.keys(r.needs).map(n=>n+"="+C.priceOf(n)).join("+")).join(" | "));
const an=C.WORKSHOPS.anvil.recipes.filter(r=>r.fee); console.log("anvil fee sample", an.slice(0,8).map(r=>r.make+":"+r.fee+"→sells "+C.priceOf(r.make)).join(" "));
console.log("alchemy:",C.WORKSHOPS.alchemist.recipes.map(r=>Object.entries(r.needs).map(([a,b])=>b+a).join("+")+"→"+r.make+" fee"+r.fee+" (in "+Object.entries(r.needs).reduce((a,[n,q])=>a+C.priceOf(n)*q,0)+"c, out "+C.priceOf(r.make)+"c)").join("\n  "));
