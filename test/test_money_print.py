"""The Cashbox logo on everything Money prints.

Cam: "assign the provided logo to all prints and exports from Main Section
Money."

Money prints two pages -- the period sheets and the calculation summary --
and has no other export. Both now open with the shared letterhead carrying
the logo, which means the logo lives in ONE place: replace icons/cashbox.png
and every Money printout changes with it.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
UI = os.path.join(APP, "ui")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nMoney: the Cashbox letterhead\n")
money = open(os.path.join(UI, "money.js"), encoding="utf-8").read()
logo = os.path.join(APP, "icons", "cashbox.png")

ok("the logo is in the app", os.path.isfile(logo))
if os.path.isfile(logo):
    kb = os.path.getsize(logo) / 1024
    # it travels inside every printed page as a data: URI, so size matters
    ok("  and is small enough to travel inside a printed page", kb < 60, f"{kb:.0f} KB")
    try:
        from PIL import Image
        with Image.open(logo) as im:
            ok("  at a sensible size for a letterhead",
               max(im.size) <= 300 and min(im.size) >= 120, im.size)
    except ImportError:
        pass

ok("Money asks the app for the letterhead rather than drawing its own",
   "printHeader: (title, opts) =>" in money and "print_header" in money)
ok("  naming the Cashbox logo", 'logo: "cashbox.png"' in money and 'name: "cashbox"' in money)
# Both pages, not just the one that was easiest to reach -- and checked PAGE
# BY PAGE. This used to count two insertions in the whole file, which passed
# while both sat in the period sheets (letterhead printed twice there) and
# the calculation summary had none: Cam printed it and got a bare page.
def body_of(name):
    start = money.index("function " + name + "(")
    nxt = money.find("\nfunction ", start + 10)
    return money[start:nxt if nxt > 0 else len(money)]
periods_page = body_of("buildPrintDocument")
calc_page = body_of("buildCalcPrintDocument")
ok("the period sheets carry the letterhead once",
   periods_page.count("${letterhead ||") == 1, periods_page.count("${letterhead ||"))
ok("the calculation summary carries it too",
   calc_page.count("${letterhead ||") == 1, calc_page.count("${letterhead ||"))
ok("  and both are handed it when printed",
   "buildPrintDocument(periods, head)" in money
   and "buildCalcPrintDocument(head)" in money)
ok("  and a letterhead that fails to build never stops the printing",
   re.search(r"catch \(e\) \{\s*return \"\";\s*// a page without a letterhead still prints",
             money) is not None)

# The header itself is built in Python, once, for every module that prints.
ph = open(os.path.join(APP, "print_header.py"), encoding="utf-8").read()
ok("the letterhead embeds the logo's bytes, since a printed page is standalone",
   "data:image/png;base64," in ph and "def logo_data_uri" in ph)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
