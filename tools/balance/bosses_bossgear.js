const C=require("./core.js"); const {player,hunt,T0}=require("./hunt.js");
function boss(s,g,seed){ s.hunt={}; s.hunt[g]={kills:99999,wins:0,losses:0};
  const r=C.act(s,"boss",{ground:g,roll:seed},T0); if(!r.ok) return {err:r.error};
  const st=C.advance(r.state,T0+30*60e3); const lb=st.lastBoss||{}; return {won:lb.won, dead:!!st.player.dead}; }
const GR=["grizzlyhelm","grizzlyplate","grizzlygauntlets","grizzlygreaves","grizzlyboots"], GO=["gorgonhelm","gorgonplate","gorgongauntlets","gorgongreaves","gorgonboots"], SY=["sylvancrown","sylvanmail","sylvangrips","sylvanlegs","sylvanboots"];
const cfg=[["grizz+claws berserker", "berserker", GR, ["grizzclaws"]],["gorgon+fang berserker","berserker",GO,["fangspear"]],["sylvan+antlerbow hunter","hunter",SY,["antlerbow","ironarrow"]]];
for (const g of ["coast","deepforest","jungle"]) for (const [name,cls,arm,w] of cfg) { const out=[];
  for (const x of [40,45,50]) { let won=0,d=0; for (let i=0;i<12;i++){ const r=boss(player(x,cls,"accurate",arm,w),g,0.05+i*0.077); if(r.won)won++; if(r.dead)d++; } out.push(`lv${x}:${won}/12${d?" D"+d:""}`); }
  const h=[]; for (const x of [40,50]) { const r=hunt(player(x,cls,"accurate",arm,w),g,12,0.3); h.push(`hunt lv${x}: ${r.kills}k/${r.mins}m`); }
  console.log(g.padEnd(10), name.padEnd(24), out.join(" "), "|", h.join(" "));
}
