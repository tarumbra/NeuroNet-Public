"""Every NeuroNet printout shares one house style (2026-10-05).

Cam, after the Training print refresh: "That is amazing, it looks clean and
professional. I would like all printouts from Neuronet to be handled in this
way please."

The stylesheet is written once, in print_header.py (HOUSE_CSS), beside the
letterhead. Python builders put it in their page; the JavaScript ones ask for
it across the bridge (Api.print_house_css) through SS.PrintHouse. This test
keeps every printing module on it, and keeps the old serif-and-two-tone-rule
dress from creeping back.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import re
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)

passed = failed = 0
lines = []


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        lines.append("  ok    " + name)
    else:
        failed += 1
        lines.append("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def read(*p):
    with open(os.path.join(APP, *p), encoding="utf-8") as f:
        return f.read()


import print_header as ph  # noqa: E402
import neuronet as nn  # noqa: E402

ok("the house style is written once, beside the letterhead",
   "nn-title-block" in ph.HOUSE_CSS and "nn-foot" in ph.HOUSE_CSS and "@page" in ph.HOUSE_CSS)
ok("  and handed to the JavaScript side across the bridge",
   nn.Api().print_house_css() == ph.HOUSE_CSS)
block = ph.title_block_html("Recipe", "Soup <hot>", [("Serves", "4"), ("Empty", "")])
ok("  a title block says what it is, names it, lists its facts (escaped, empty ones left off)",
   'class="nn-kicker">Recipe<' in block and "Soup &lt;hot&gt;" in block and "<b>Serves</b> 4" in block
   and "Empty" not in block)
ok("  a footer carries the print date", "printed" in ph.footer_html("x"))

index = read("ui", "index.html")
ok("SS.PrintHouse loads right after app.js",
   index.index('src="print-house.js"') > index.index('src="app.js"') >= 0)
house_js = read("ui", "print-house.js")
ok("  it fetches the style rather than keeping a copy", "print_house_css" in house_js and "nn-title" in house_js
   and "@page" not in house_js)

MODULES = {
    "recipes, lists and recipe books": ("ui", "cookery-print.js"),
    "Stuff (media and inventories)": ("ui", "stuff", "stuff.js"),
    "notebooks": ("ui", "notes", "books-print.js"),
    "Notes guides": ("ui", "notes", "guides.js"),
    "App stats": ("ui", "stats", "stats.js"),
    "Money (sheets, calculation, books)": ("ui", "money.js"),
}
for name, path in MODULES.items():
    src = read(*path)
    ok(f"{name} print in the house style", "PrintHouse" in src, "/".join(path))

ok("Training's sheets put the house style first",
   "_house_css()" in read("training_documents.py") and "{_house_css()}{PRINT_CSS}" in read("training_documents.py"))
ok("the fleeting notes PDF too", "ph.HOUSE_CSS" in read("fleeting_pdf.py"))

# the old dress -- serif body text and the two-tone rule -- is gone from every printout
old = []
for path in [("ui", "cookery-print.js"), ("ui", "notes", "books-print.js"), ("ui", "games", "cranium.js"),
             ("guidebook_pdf.py",), ("fleeting_pdf.py",)]:
    src = read(*path)
    if re.search(r"font:[^;]*Georgia|font-family:\s*Georgia", src):
        old.append("/".join(path) + " (Georgia)")
    if "#d8d2ca 34%" in src or "#d8d2ca 30%" in src:
        old.append("/".join(path) + " (two-tone rule)")
stuff_print = read("ui", "stuff", "stuff.js")
stuff_print = stuff_print[stuff_print.index("const PRINT_CSS"):stuff_print.index("function buildHtml")]
if "Georgia" in stuff_print:
    old.append("ui/stuff/stuff.js (Georgia)")
ok("no printout is left in the old serif and two-tone dress", not old, ", ".join(old))

ok("letterheads say what a document is; its title block names it",
   'letterhead("Recipe", {})' in read("ui", "cookery-print.js")
   and 'title: "Notebook"' in read("ui", "notes", "books.js")
   and 'cashboxHeader("Money book", "")' in read("ui", "money.js")
   and 'CR.Store.letterhead("Puzzle book", "")' in read("ui", "games", "cranium.js"))

print("\ntest_print_house.py -- one house style for every printout")
print("\n".join(lines))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
