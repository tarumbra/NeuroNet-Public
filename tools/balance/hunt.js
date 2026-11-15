const C=require("./core.js");
const T0=1700000000000;
const TIERS=[[1,"bronze"],[10,"iron"],[20,"steel"],[30,"mithril"],[40,"adamant"],[50,"rune"]];
const SETS={bronze:["bronzehelm","bronzeplate","bronzegloves","bronzelegs","bronzeboots"],iron:["ironhelm","ironplate","irongloves","ironlegs","ironboots"],
 steel:["steelhelm","steelplate","steelgloves","steellegs","steelboots"],mithril:["mithrilhelm","mithrilplate","mithrilgloves","mithrillegs","mithrilboots"],
 adamant:["adamanthelm","adamantplate","adamantgloves","adamantlegs","adamantboots"],rune:["runehelm","runeplate","runegloves","runelegs","runeboots"]};
const SWORD={bronze:"bronzesword",iron:"ironsword",steel:"steelsword",mithril:"mithrilsword",adamant:"adamantsword",rune:"runesword"};
const BOW={bronze:["shortbow","bronzearrow"],iron:["longbow","ironarrow"],steel:["compoundbow","steelarrow"],mithril:["yewbow","mithrilarrow"],adamant:["magicbow","adamantarrow"],rune:["magicbow","runearrow"]};
// food: [item, count] to carry and auto-eat (2026-10-05); by default none, so "no food" runs stay comparable
function player(x, cls, style, armourOverride, weaponOverride, food) {
  let s=C.act(C.empty(),"player",{name:"Sim"},T0).state;
  Object.assign(s.player.skills,{attack:C.XP[x],ranged:C.XP[x],defence:C.XP[x],hitpoints:C.XP[Math.max(10,x)]});
  s.player.hp=Math.max(10,x); s.player.at=T0;
  const tier=TIERS.filter(t=>t[0]<=x).pop()[1];
  const arm=armourOverride||SETS[tier];
  arm.forEach(k=>{ s.bag[k]=1; const r=C.act(s,"equip",{item:k},T0); if(r.ok) s=r.state; });
  if (cls) { const r=C.act(s,"class",{cls},T0); if (r.ok) s=r.state; }
  if (cls==="hunter") { const [b,a]=weaponOverride||BOW[tier]; s.bag[b]=1; s.bag[a]=5000;
    const qt=C.arrowTier(a), q=qt<=2?"leatherquiver":qt<=4?"studdedquiver":"gatorquiver"; s.bag[q]=1; s.player.gear.quiver=q;   // a quiver that holds them (Part 10)
    for (const k of [b,a]) { const r=C.act(s,"equip",{item:k},T0); if(r.ok) s=r.state; else console.log("eq fail",k,r.error);} }
  else { const w=(weaponOverride&&weaponOverride[0])||SWORD[tier]; s.bag[w]=1; const r=C.act(s,"equip",{item:w},T0); if(r.ok) s=r.state; else console.log("eq fail",w,r.error); }
  if (style) { const r=C.act(s,"combat",{style},T0); if(r.ok) s=r.state; }
  if (food) { s.bag[food[0]]=food[1]; const r=C.act(s,"settings",{food:food[0]},T0); if(r.ok) s=r.state; else console.log("food fail",r.error); }
  return s;
}
function hunt(s, ground, hours, seed) {
  const r=C.act(s,"hunt",{ground,roll:seed},T0); if(!r.ok) return {err:r.error};
  let st=r.state; const end=T0+hours*3600e3; let t=T0;
  while (t<end) { t=Math.min(end,t+10*60e3); st=C.advance(st,t); if (!st.player.job) break; }
  const pl=st.player, trip=pl.job||pl.lastTrip;
  const ate=trip&&trip.ate?Object.values(trip.ate).reduce((a,b)=>a+b,0):0;
  return {dead:!!pl.dead, ate, kills:trip?trip.count:0, mins:Math.round(((pl.job?t:(pl.lastTrip?pl.lastTrip.ended:t))-T0)/60e3), hp:Math.round(pl.hp), max:C.levelOf(pl.skills.hitpoints)};
}
// cooked food a player of level x could have made: fish up the ladder with their level
function foodFor(x) { return x>=40?"monkfish":x>=30?"swordfish":x>=20?"lobster":x>=10?"tuna":"herring"; }
// V17 (armour weights): SIM_KIT=own dresses each class in its own weight's best armour for its level, instead of metal for all
const OWN_KIT={
  light:(x)=>x>=40?["frostcap","frostbody","frostvambraces","frostchaps","frostboots"]:x>=30?["tigercap","tigerbody","tigervambraces","tigerchaps","tigerboots"]:x>=20?["snakecap","snakebody","snakevambraces","snakechaps","snakeboots"]:x>=10?["hardcap","hardbody","hardvambraces","hardchaps","hardboots"]:["leathercap","leathertunic","leathergloves","leathertrousers","leatherboots"],
  cloth:(x)=>{ const hat=x>=50?["archmagecirclet","archmagecloak"]:x>=40?["sorcerercrown","sorcerercloak"]:x>=30?["magehat","magecloak"]:x>=20?["adepthood","adeptcloak"]:x>=10?["apprenticehat","apprenticecloak"]:["wizardhat"];
    const rk=["apprentice","adept","mage","sorcerer","archmage"][Math.min(5,Math.floor(x/10))-1];   // C8: robes for each mage rank
    if (process.env.SIM_CLOTH === "bat") return hat.concat(["linenrobe"], x>=20?["batchaps","batvambraces","batboots"]:["leathertrousers","leathergloves","leatherboots"]);   // (the kit before C8)
    return hat.concat(rk?[rk+"robetop",rk+"robebottoms",rk+"gloves",rk+"boots"]:["linenrobe","leathertrousers","leathergloves","leatherboots"]); }};
function dressOwn(s, cls, x) {
  const w=(C.ARMOUR.fit||{})[cls]; if (!OWN_KIT[w]) return s;
  for (const k of ["helmet","torso","arms","legs","feet","cloak"]) delete s.player.gear[k];
  OWN_KIT[w](x).forEach((id)=>{ s.bag[id]=1; s.player.gear[C.ITEMS[id].gear.slot]=id; });
  return s;
}
module.exports={player,hunt,T0,foodFor,dressOwn};
if (require.main===module) {
  for (const g of C.HUNT_ORDER) {
    const L=C.HUNTS[g].level, x=Math.max(1,Math.ceil(L/1.25));
    for (const [cls,style] of [["berserker","accurate"],["hunter","accurate"],["berserker","defensive"]]) {
      const res=[]; for (let i=0;i<6;i++) res.push(hunt(player(x,cls,style),g,12,0.1+i*0.13));
      const dead=res.filter(r=>r.dead).length, k=res.reduce((a,r)=>a+r.kills,0)/res.length, m=res.reduce((a,r)=>a+r.mins,0)/res.length;
      console.log(`${g.padEnd(10)} L${L} lv${x} ${cls.padEnd(9)} ${style.padEnd(9)} deaths ${dead}/6  avg kills ${k.toFixed(0)} in ${m.toFixed(0)}min  (${(k/(m/60)).toFixed(1)}/h)  ${res.map(r=>r.dead?"DEAD@"+r.mins:r.kills+"k/"+r.mins+"m").join(" ")}`);
    }
  }
}
