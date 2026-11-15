"""Fleeting -> Export all to PDF (fleeting_pdf.py, Api.fleeting_export_pdf).

Cam (2026-10-02): "I want the ability to be able to export all the fleeting
notes into a pdf. Then i can provide this to you, so you have all the changes
that i require in the one document."

The page: every note in queue order, its number and when it was written,
the text as typed (escaped, line breaks kept). The call: asks where to save,
renders, opens the PDF, counts the export. The real render (Chromium) runs
too when Chromium is here.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import datetime, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nFleeting notes to PDF\n")
import fleeting_pdf  # noqa: E402

notes = [{"n": 1, "text": "Scrapbook <b>bug</b> & more\nsecond line", "written": 1790000000},
         {"n": 2, "text": "", "written": 0},
         {"n": 3, "text": "Card pull flashes", "written": 1790000300}]
page = fleeting_pdf.build_html(notes, header="<div>LETTERHEAD</div>", today=datetime.date(2026, 10, 2))
ok("every note, in queue order", page.index(">#1<") < page.index(">#2<") < page.index(">#3<"))
ok("  the text exactly as typed: escaped, not read as markup",
   "&lt;b&gt;bug&lt;/b&gt; &amp; more" in page and "<b>bug</b>" not in page)
ok("  line breaks kept", "white-space: pre-wrap" in page and "more\nsecond line" in page)
ok("  an empty note says so", 'class="tx empty">Empty' in page)
ok("  no time for a note without one (not 1 January 1970)", "1970" not in page)
ok("  under the letterhead, with a count and the date", page.index("LETTERHEAD") < page.index(">#1<")
   and "<b>Notes</b> 3" in page and "2 October 2026" in page and 'class="nn-title"' in page)
ok("  a note isn't split across pages", "break-inside: avoid" in page)

# ---- the call --------------------------------------------------------------
root = tempfile.mkdtemp(prefix="nn-fleeting-pdf-")
try:
    import neuronet  # noqa: E402
    vault = os.path.join(root, "vault")
    os.makedirs(os.path.join(vault, "Fleeting"))
    neuronet.notes_backend.vault_dir = lambda: vault
    for n, t in ((1, "first thing"), (2, "second thing")):
        with open(os.path.join(vault, "Fleeting", "Fleeting note %d.md" % n), "w") as f:
            f.write(t)

    api = neuronet.Api()
    counted, opened, rendered = [], [], []
    api._count = lambda k: counted.append(k)

    class Win:
        answer = os.path.join(root, "out", "mine")
        def create_file_dialog(self, kind, save_filename=""):
            Win.asked = save_filename
            return Win.answer
    os.makedirs(os.path.join(root, "out"))
    api._window = Win()
    import guidebook_pdf as gp
    real_pdf, real_open = gp.html_to_pdf, gp.open_file
    gp.open_file = lambda p: opened.append(p) or True
    gp.html_to_pdf = lambda html, path: (rendered.append((html, path)), open(path, "w").write("%PDF"), {"ok": True})[2]

    r = api.fleeting_export_pdf()
    ok("asks where to save it, named for today",
       Win.asked == "Fleeting notes %s.pdf" % datetime.date.today().isoformat(), Win.asked)
    ok("  .pdf added to a name without it", r.get("path") == Win.answer + ".pdf", r)
    ok("  every note is in it", rendered and "first thing" in rendered[0][0] and "second thing" in rendered[0][0])
    ok("  under Scribe's letterhead (the Vault, renamed)", rendered and "Fleeting notes" in rendered[0][0] and "Scribe" in rendered[0][0])
    ok("  then the PDF is opened", opened == [Win.answer + ".pdf"], opened)
    ok("  and counted as an export (App stats)", counted == ["export:fleeting-pdf"], counted)
    ok("  says how many notes", r.get("ok") and r.get("notes") == 2, r)

    Win.answer = None
    ok("cancelling the save dialog does nothing", api.fleeting_export_pdf() == {"cancelled": True}
       and len(rendered) == 1)
    for name in os.listdir(os.path.join(vault, "Fleeting")):
        os.remove(os.path.join(vault, "Fleeting", name))
    ok("no notes: says so, asks nothing", "error" in api.fleeting_export_pdf() and len(rendered) == 1)

    gp.html_to_pdf, gp.open_file = real_pdf, real_open
    if gp.find_chromium():
        out = os.path.join(root, "real.pdf")
        res = gp.html_to_pdf(fleeting_pdf.build_html(notes), out)
        ok("the real render makes a PDF", res.get("ok") and open(out, "rb").read(4) == b"%PDF", res)
    else:
        print("  skip  the real render (no Chromium here)")
finally:
    shutil.rmtree(root, ignore_errors=True)

ui = open(os.path.join(APP, "ui", "fleeting", "fleeting.js"), encoding="utf-8").read()
ok("the Fleeting page has Export all to PDF", 'id="fl-pdf"' in ui and '"fleeting_export_pdf"' in ui)
stats = open(os.path.join(APP, "ui", "stats", "stats.js"), encoding="utf-8").read()
ok("  and App stats has a name for the export", '"fleeting-pdf": "Fleeting notes to PDF"' in stats)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
