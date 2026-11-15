// Every player item by slot: requirements and stats; flags items another item outclasses. A class piece
// (bone, class leathers) is judged as its own class wears it: its class bonus added, compared only with
// what that class can wear (unclassed pieces, and class bonuses that suit it). OUTCLASSED CLASS PIECES
// at the end should be empty.
const C=require("./core.js");
const where={}; for (const w of C.WORKSHOP_ORDER) for (const r of C.WORKSHOPS[w].recipes) where[r.make]=w+"@"+(r.level||1)+":"+Object.entries(r.needs).map(([a,b])=>b+a).join("+");
const KEYS=["power","def","att","rng","xp","speed","dodge","brace","regen","reflect","acc","trueStrike","stun","double","maxHit","soak","success","rare"];
const gear=Object.entries(C.ITEMS).filter(([k,v])=>v.gear&&v.gear.who==="player");
const classOf=(g)=>g.cls||(g.clsBonus&&g.clsBonus.cls)||"";
// the stats a wearer of class `cls` gets from it
function eff(g, cls) { const e=Object.assign({},g); if (g.clsBonus&&g.clsBonus.cls===cls) for (const b in g.clsBonus) if (b!=="cls") e[b]=(e[b]||0)+g.clsBonus[b]; return e; }
const bySlot={}; for (const [k,v] of gear) (bySlot[v.gear.slot]=bySlot[v.gear.slot]||[]).push([k,v]);
const outclassedClass=[];
for (const [slot,list] of Object.entries(bySlot)) {
  console.log("== "+slot);
  list.sort((a,b)=>{const ra=Object.values(a[1].gear.req||{})[0]||0, rb=Object.values(b[1].gear.req||{})[0]||0; return ra-rb;});
  for (const [k,v] of list) { const g0=v.gear, cls=classOf(g0), g=eff(g0,cls);
    const stats=KEYS.filter(x=>g[x]&&!(x==="speed"&&g[x]===1)).map(x=>x+"="+g[x]).join(",");
    const reqv=g0.req||{};
    const dom=list.filter(([k2])=>k2!==k).filter(([k2,v2])=>{const h0=v2.gear,r2=h0.req||{};
      if (h0.cls&&h0.cls!==cls) return false; if (g0.style && h0.style!==g0.style) return false; if (g0.ammo && h0.ammo!==g0.ammo) return false;   // bows vs crossbows, arrows vs bolts
      const h=eff(h0,cls);
      const reqOk=Object.keys(r2).every(q=>(r2[q]||0)<=(reqv[q]||0));
      const statOk=KEYS.every(x=>x==="speed"?((h.speed||1)<=(g.speed||1)):((h[x]||0)>=(g[x]||0)));
      const better=KEYS.some(x=>x==="speed"?((h.speed||1)<(g.speed||1)):((h[x]||0)>(g[x]||0)));
      return reqOk&&statOk&&better;}).map(x=>x[0]);
    if (dom.length && cls) outclassedClass.push(k);
    console.log(`  ${k.padEnd(18)} req=${JSON.stringify(reqv).padEnd(28)} ${(cls?(g0.cls?"":"+")+cls:"").padEnd(10)} ${stats.padEnd(40)} ${g0.set?"set:"+g0.set:""} ${where[k]||"(drop/boss?)"} ${dom.length?"DOMINATED BY "+dom.join(","):""}`);
  }
}
console.log("\nOUTCLASSED CLASS PIECES: "+(outclassedClass.join(", ")||"none"));
