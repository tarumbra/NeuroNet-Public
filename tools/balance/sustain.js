// The level at which each area first lasts a full 12-hour idle hunt: with no food (regen and armour
// only), and with 2000 of a level-matched cooked fish on auto-eat (how many it eats is shown).
const C=require("./core.js"); const {player,hunt,foodFor}=require("./hunt.js");
for (const withFood of [false,true]) {
  console.log(withFood ? "-- with auto-eat (level-matched cooked fish; e = eaten in the trip)" : "-- no food");
  for (const g of C.HUNT_ORDER) {
    const L=C.HUNTS[g].level, x0=Math.max(1,Math.ceil(L/1.25)); const line=[];
    for (let x=x0; x<=50; x+=4) {
      const res=[]; for (let i=0;i<4;i++) res.push(hunt(player(x,"berserker","accurate",null,null,withFood?[foodFor(x),2000]:null),g,12,0.11+i*0.21));
      const k=res.reduce((a,r)=>a+r.kills,0)/4, m=res.reduce((a,r)=>a+r.mins,0)/4, dead=res.filter(r=>r.dead).length, e=res.reduce((a,r)=>a+r.ate,0)/4;
      line.push(`lv${x}:${Math.round(k)}k/${Math.round(m)}m${withFood?"/"+Math.round(e)+"e":""}${dead?" D"+dead:""}`);
      if (m>=700) break;
    }
    console.log(g.padEnd(10),"L"+L, line.join("  "));
  }
}
