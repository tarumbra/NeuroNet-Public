#!/usr/bin/env python3
"""The bench redesign mock-up (2026-10-19, for discussion -- Cam: "If we could reinvent it to look like this but with our
design it might work better and still have the ability to click something and then click the work bench"). Draws the Kitchen
from the game's real recipes and icons: a category picker and an icon grid on the left, the chosen recipe on the right with
its requirements and materials ticked off, the amount slider and Cook. Writes bench-kitchen-after.html beside this file.
    python3 tools/audit/mockups/make_bench_mockup.py"""
import html, json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
js = r'''const vm=require("vm"),fs=require("fs");const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1]+"/ui/pet/petcore.js","utf8"),ctx);const C=ctx.window.PetCore||ctx.PetCore;
const names={};for(const k in C.ITEMS)names[k]=C.ITEMS[k].name;
const rec=C.WORKSHOPS.kitchen.recipes.map(r=>({make:r.make,name:(C.ITEMS[r.make]||{}).name||r.make,level:r.level||1,needs:r.needs,
  heal:(C.ITEMS[r.make]||{}).heal||0,food:(C.ITEMS[r.make]||{}).food||{}}));
console.log(JSON.stringify({names,rec}));'''
D = json.loads(subprocess.run(["node", "-e", js, APP], capture_output=True, text=True, check=True).stdout)
R, names = D["rec"], D["names"]
ICON = "file://" + APP + "/ui/pet/art/icons/%s.webp"
FISH = "shrimp sardine herring trout salmon tuna pike perch lobster swordfish shark monkfish crab eel cod mackerel bass carp ray".split()
MEAT = "pork beef chicken mutton venison meat rabbit duck boar bear egg".split()
def cat(r):
    k = " ".join(list(r["needs"]) + [r["make"]])
    if not r["heal"] and r["food"]: return "Pet treats"
    if any(w in k for w in ("tea", "juice", "milk", "cider", "coffee")): return "Drinks"
    if any(w in k for w in FISH): return "Fish"
    if any(w in k for w in MEAT): return "Meat and eggs"
    return "Baking and sweets"
cats = {}
for r in R: cats.setdefault(cat(r), []).append(r)
LV = 17
pick = "Meat and eggs" if "Meat and eggs" in cats else next(iter(cats))
grid = sorted(cats[pick], key=lambda r: r["level"])
sel = next((r for r in grid if len(r["needs"]) >= 2 and r["level"] <= LV), grid[0])
have = {k: (n * 5 if i == 0 else 0) for i, (k, n) in enumerate(sel["needs"].items())}
def cell(r):
    lock = r["level"] > LV
    return (f'<button class="cell{" on" if r is sel else ""}{" lock" if lock else ""}" title="{html.escape(r["name"])}"><img src="{ICON % r["make"]}" alt="">'
            f'<span class="lv">{r["level"]}</span>{"<span class=pad>locked</span>" if lock else ""}</button>')
mats = "".join(f'<div class="mat{" ok" if have[k] >= n else " no"}"><img src="{ICON % k}" alt=""><span>{html.escape(names.get(k, k))}</span><b>{have[k]}/{n}</b><i>{"✓" if have[k] >= n else "✕"}</i></div>'
               for k, n in sel["needs"].items())
missing = [names.get(k, k).lower() for k, n in sel["needs"].items() if have[k] < n]
does = "".join(f"<span>{html.escape(k.title())} {v:+d}</span>" for k, v in sel["food"].items() if v) + (f"<span>Heals you {sel['heal']}</span>" if sel["heal"] else "")
CSS = open(os.path.join(HERE, "bench.css")).read() if os.path.exists(os.path.join(HERE, "bench.css")) else ""
page = f'''<!doctype html><html><head><meta charset="utf-8"><title>Kitchen, after (mock-up)</title><style>
body{{margin:0;width:1100px;height:720px;background:#1b120c;font:15px/1.4 "Noto Sans",sans-serif;color:#3b2213;display:grid;place-items:center}}
.frame{{width:1040px;height:660px;background:#d8b67f;border:10px solid #6a3f27;border-radius:14px;box-shadow:inset 0 0 0 3px #a97a49,0 20px 60px #000a;display:grid;grid-template-rows:auto 1fr;overflow:hidden}}
.head{{display:flex;gap:14px;align-items:center;padding:12px 18px;border-bottom:2px solid #a97a49}} .head img{{width:44px;height:44px}} .head b{{font-size:20px}} .stamp{{color:#6f4a2b;font-size:13px}}
.xp{{margin-left:auto;width:220px}} .bar{{height:8px;border-radius:4px;background:#a97a49;overflow:hidden}} .bar i{{display:block;height:100%;width:38%;background:#4e8a2c}}
.body{{display:grid;grid-template-columns:430px 1fr;min-height:0}}
.left{{padding:14px;border-right:2px solid #a97a49;display:flex;flex-direction:column;gap:10px;min-height:0}}
.sel{{display:flex;gap:6px;flex-wrap:wrap}} .tab{{padding:5px 11px;border-radius:999px;background:#ecd3a4;border:1px solid #a97a49;font-size:13px;font-weight:700}} .tab.on{{background:#7a3c25;color:#fff4dc;border-color:#7a3c25}}
.search{{background:#f3e3c3;border:1px solid #a97a49;border-radius:8px;padding:7px 10px;color:#8a6643;font-size:14px}}
.grid{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;overflow:hidden;padding:3px}} .cell{{min-width:0}}
.cell{{position:relative;aspect-ratio:1;border-radius:8px;border:2px solid #8a5434;background:#ecd3a4;padding:6px}} .cell img{{width:100%;height:100%;object-fit:contain}}
.cell .lv{{position:absolute;left:4px;top:1px;font-size:11px;font-weight:800;color:#5a3a24}} .cell.on{{border-color:#4e8a2c;box-shadow:0 0 0 3px #4e8a2c66;background:#f6ead2}}
.cell.lock img{{filter:grayscale(1) opacity(.4)}} .cell .pad{{position:absolute;right:3px;bottom:2px;font-size:9px;font-weight:800;color:#7a3c25;text-transform:uppercase}}
.right{{padding:16px 20px;display:flex;flex-direction:column;gap:8px;min-height:0}}
.top{{display:flex;gap:14px;align-items:center}} .top img{{width:72px;height:72px;background:#ecd3a4;border-radius:12px;padding:6px;border:2px solid #8a5434}} .top b{{font-size:22px}}
.does{{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}} .does span{{padding:2px 9px;border-radius:999px;background:#f3e3c3;border:1px solid #a97a49;font-size:13px}}
h4{{margin:6px 0 2px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6f4a2b}}
.req,.mat{{display:grid;grid-template-columns:24px 1fr auto 22px;gap:8px;align-items:center;padding:6px 10px;border-radius:8px;background:#f3e3c3;margin-bottom:4px}}
.mat img{{width:24px;height:24px}} .req i,.mat i{{font-style:normal;font-weight:900;text-align:center}} .ok i{{color:#3f7a32}} .no i,.no b{{color:#b8402a}} .mat span{{text-decoration:underline dotted #8a6643}}
.amt{{margin-top:auto;display:grid;grid-template-columns:34px 1fr 34px 80px;gap:8px;align-items:center}} .amt button{{height:30px;border-radius:6px;border:0;background:#7a3c25;color:#fff4dc;font-weight:800}}
.amt input{{width:100%;accent-color:#4e8a2c}} .amt .n{{background:#f3e3c3;border:1px solid #a97a49;border-radius:6px;text-align:center;padding:5px;font-weight:700}}
.cook{{height:42px;border-radius:8px;border:0;background:#4e8a2c;color:#fff8e6;font:800 17px "Noto Sans";letter-spacing:.06em}} .cook[disabled]{{background:#8a7a6a}}
.from{{background:#eef3e2;border-left:4px solid #4e8a2c;padding:6px 10px;border-radius:0 8px 8px 0;font-size:13px}}
</style></head><body><div class="frame">
<div class="head"><img src="{ICON % "obj_kitchen"}" alt=""><div><b>Kitchen</b> <span class="stamp">Cooking level {LV} · 17,206 coins</span><div class="stamp">"Your own stove. Better dishes at higher levels."</div></div>
 <div class="xp"><div class="stamp">521 xp to level {LV + 1}</div><div class="bar"><i></i></div></div></div>
<div class="body"><div class="left">
 <div class="from">From your bag: <b>{html.escape(names.get(list(sel["needs"])[0], "").lower())}</b>. Showing what it cooks into here first.</div>
 <div class="sel">{"".join(f'<span class="tab{" on" if c == pick else ""}">{html.escape(c)} {len(v)}</span>' for c, v in cats.items())}</div>
 <div class="search">Find a recipe or an ingredient…</div>
 <div class="grid">{"".join(cell(r) for r in grid[:30])}</div>
</div><div class="right">
 <div class="top"><img src="{ICON % sel["make"]}" alt=""><div><b>{html.escape(sel["name"])}</b><div class="does">{does}</div></div></div>
 <h4>Requirements</h4>
 <div class="req ok"><span></span><span>Cooking level {sel["level"]}</span><b>yours: {LV}</b><i>✓</i></div>
 <div class="req ok"><span></span><span>A kitchen (your estate)</span><b></b><i>✓</i></div>
 <h4>Materials <span style="text-transform:none;letter-spacing:0">(click one for where to get it)</span></h4>
 {mats}
 <div class="amt"><button>−</button><input type="range" min="0" max="1" value="0"><button>+</button><div class="n">0</div></div>
 <div class="stamp">{"Enough for none -- missing " + ", ".join(missing) + "." if missing else "Enough for 5."}</div>
 <button class="cook" {"disabled" if missing else ""}>COOK</button>
</div></div></div></body></html>'''
open(os.path.join(HERE, "bench-kitchen-after.html"), "w").write(page)
print(sel["name"], {c: len(v) for c, v in cats.items()})
