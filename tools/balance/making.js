const C=require("./core.js"); const {t}=require("./cost.js");
const XP=C.XP;
const bySkill={};
for (const w of C.WORKSHOP_ORDER) { const ws=C.WORKSHOPS[w]; if (ws.npc) continue; for (const r of ws.recipes) (bySkill[ws.skill]=bySkill[ws.skill]||[]).push([w,r]); }
for (const [sk,list] of Object.entries(bySkill)) {
  let hours=0, coins=0, crafts=0, marks={}, used={};
  for (let lv=1; lv<50; lv++) {
    let best=null;
    for (const [w,r] of list) { if ((r.level||1)>lv || !r.xp) continue;
      let c=0, ok=true; for (const [n,q] of Object.entries(r.needs)) { if (!(n in t)) {ok=false;break;} c+=t[n]*q; }
      if (!ok) continue; const rate=r.xp/Math.max(1,c); if (!best||rate>best.rate) best={rate,r,c}; }
    if (!best) { marks[lv]="STUCK"; break; }
    const need=XP[lv+1]-XP[lv], n=need/best.r.xp; crafts+=n; hours+=n*best.c/3600; coins+=n*(best.r.fee||0);
    used[best.r.make]=(used[best.r.make]||0)+1;
    if ([10,20,30,40,49].includes(lv)) marks[lv+1]=Math.round(hours)+"h";
  }
  const lvls=list.map(([w,r])=>r.level||1), maxL=Math.max(...lvls);
  console.log(sk.padEnd(10),"recipes",list.length,"top recipe lv",maxL,"| gather-hours",JSON.stringify(marks),"crafts",Math.round(crafts),"coins",Math.round(coins));
  console.log("    best-xp recipes used:",Object.entries(used).map(([k,v])=>k+"×"+v+"lv").join(" "));
}
