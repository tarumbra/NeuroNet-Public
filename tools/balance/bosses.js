// Boss win rates: 12 seeded attempts per level step (metal armour), then the late bosses with boss sets.
const C=require("./core.js"); const {player,T0}=require("./hunt.js");
function boss(s,g,seed){ s.hunt=s.hunt||{}; s.hunt[g]={kills:99999,wins:0,losses:0};
  const r=C.act(s,"boss",{ground:g,roll:seed},T0); if(!r.ok) return {err:r.error};
  const st=C.advance(r.state,T0+30*60e3); const lb=st.lastBoss||{}; return {won:lb.won, dead:!!st.player.dead, fled:lb.fled}; }
for (const g of C.HUNT_ORDER) {
  const L=C.HUNTS[g].level, x0=Math.max(1,Math.ceil(L/1.25)); const out=[];
  for (let x=x0; x<=50; x+=4) { let w=0,d=0,n=12; for (let i=0;i<n;i++){ const r=boss(player(x,"berserker","accurate"),g,0.05+i*0.077); if(r.err){out.push(r.err);break;} if(r.won)w++; if(r.dead)d++; }
    out.push(`lv${x}:${w}/12${d?" DEAD"+d:""}`); if (w===12) break; }
  console.log(g.padEnd(10),C.HUNTS[g].boss.padEnd(9),out.join("  "));
}
