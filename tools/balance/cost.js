// seconds of gathering (at a good tool speed) to get one of each item; recipes compose; monsters by kill time
const C=require("./core.js");
const SPEED={mining:0.6,lumbering:0.6,foraging:0.6,fishing:0.7,digging:1};
const t={}, src={};
function setT(id,v,how){ if(!(id in t)||v<t[id]){t[id]=v;src[id]=how;} }
for (const k of C.GATHERING) for (const s of C.SKILLS[k].spots) {
  if (s.essence) continue;
  const tot=s.loot.reduce((a,l)=>a+l[1],0);
  for (const [it,w] of s.loot) setT(it, s.time*SPEED[k]*tot/w, k+":"+s.id);
  if (s.rare) setT(s.rare[0], s.time*SPEED[k]*s.rare[1], k+":"+s.id+"(rare)");
}
// herbs in pots: a seed from foraging gives 2-4 (the pot's growing time is idle, so not counted)
for (const [h,d] of Object.entries(C.HERBS)) if (d.seed in t) setT(h, t[d.seed]/((d.yield[0]+d.yield[1])/2), "pot:"+h);
// monsters: a kill ~ (hunt wait avg + fight ~6 rounds*2.4s)
for (const [g,h] of Object.entries(C.HUNTS)) {
  const tot=h.monsters.reduce((a,m)=>a+m[1],0);
  for (const [m,w] of h.monsters) {
    const mon=C.MONSTERS[m], killT=((5+h.time)/2+15)*tot/w;
    for (const d of mon.drops) { const avg=(d[1]+d[2])/2*d[3]; if (avg>0) setT(d[0], killT/avg, "hunt:"+g+":"+m); }
  }
}
// merchant: coins -> treat 1 coin as ~ (seconds to earn a coin) later; record separately
const buy={}; C.MERCHANT_STOCK.forEach(([i,p])=>buy[i]=p);
// recipes, iterate to fixpoint
const recs=[];
for (const w of C.WORKSHOP_ORDER) for (const r of C.WORKSHOPS[w].recipes) recs.push([w,r]);
for (let it=0; it<10; it++) for (const [w,r] of recs) {
  let c=0, ok=true; for (const [n,q] of Object.entries(r.needs)) { if (!(n in t)) { ok=false; break; } c+=t[n]*q; }
  if (ok) setT(r.make, c/(r.n||1), "make:"+w);
}
module.exports={t,src,buy,recs};
if (require.main===module) { const keys=Object.keys(t).sort((a,b)=>t[a]-t[b]); console.log(keys.map(k=>k+"="+Math.round(t[k])+"s("+src[k]+")").join("\n")); 
  console.log("NO SOURCE:", Object.keys(C.ITEMS).filter(k=>!(k in t)).join(" ")); }
