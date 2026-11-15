const C=require("./core.js");
const XP=C.XP, L=C.MAX_LEVEL;
console.log("XP to 10:",XP[10],"20:",XP[20],"30:",XP[30],"40:",XP[40],"50:",XP[50]);
const tools={};
for (const [id,it] of Object.entries(C.ITEMS)) if (it.tool) (tools[it.tool.skill]=tools[it.tool.skill]||[]).push([id,it.tool.level,it.tool.tier,it.tool.speed]);
console.log("TOOLS",JSON.stringify(tools));
for (const k of C.GATHERING) {
  const spots=C.SKILLS[k].spots.filter(s=>!s.essence);
  // per level: best xp/h spot among unlocked, with best tool usable at that level (by level & tier), speed applied
  let hours=0, marks={};
  const tl=(tools[k]||[]);
  for (let lv=1; lv<L; lv++) {
    const tool=tl.filter(t=>t[1]<=lv).sort((a,b)=>a[3]-b[3])[0];
    const sp=tool?tool[3]:1, tier=tool?tool[2]:-1;
    let best=0,bestId="";
    for (const s of spots) { if (s.level>lv) continue; if ((s.toolTier||0)>tier && (k==="mining"||k==="lumbering"||k==="foraging") && s.toolTier) continue;
      const r=s.xp*3600/(s.time*sp); if (r>best){best=r;bestId=s.id;} }
    const need=XP[lv+1]-XP[lv]; hours+=need/best;
    if ([10,20,30,40,49].includes(lv)) marks[lv+1]=[Math.round(hours), bestId, Math.round(best)];
  }
  console.log(k.padEnd(10), JSON.stringify(marks));
  // per-spot xp/h table
  console.log("   spots:", spots.map(s=>`${s.id}@${s.level}:${Math.round(s.xp*3600/s.time)}`).join(" "));
}
