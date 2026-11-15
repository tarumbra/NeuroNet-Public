"""The Vault's Import, Import folder and Import PDF buttons.

Cam: "when i try to import into vault in the notes section i cannot, none of
those 3 bottom buttons work in the vault subsection."

Notes has its own backend object (notes_backend.NotesApi), and its file
dialogs open on a window it holds. main() gave the window to NeuroNet's Api
but never to Notes, so every picker died on None.create_file_dialog -- an
exception the page never showed, so the buttons just seemed dead.

Checked here: main() hands the window over; the pickers work with a window
and return a readable error without one; the page shows that error.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import re
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nThe Vault's import buttons\n")

src = __import__("backend_src").backend_source(APP)
main_body = src[src.index("def main():"):]
ok("main() gives Notes the window",
   re.search(r"_notes\._window\s*=\s*window", main_body))

# A stand-in pywebview, so the pickers can run without a real window.
fake = types.ModuleType("webview")
fake.OPEN_DIALOG, fake.FOLDER_DIALOG, fake.SAVE_DIALOG = 10, 20, 30
fake.windows = []
sys.modules["webview"] = fake
import notes_backend                                   # noqa: E402


class Win:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def create_file_dialog(self, *a, **kw):
        self.calls.append(a)
        return self.answer


api = notes_backend.NotesApi()
api._window = Win(("/tmp/a.md", "/tmp/b.md"))
ok("Import files returns the picked paths",
   api.pick_import() == {"paths": ["/tmp/a.md", "/tmp/b.md"]}, api.pick_import())
api._window = Win("/tmp/vault")
ok("Import folder returns the folder", api.pick_import_folder() == {"paths": ["/tmp/vault"]})
api._window = Win(["/tmp/x.pdf"])
ok("Import PDF returns the PDF", api.pick_pdf() == {"paths": ["/tmp/x.pdf"]})
api._window = Win(None)
ok("a closed dialog is a cancel", api.pick_import() == {"cancelled": True})

api._window = None
for name in ("pick_import", "pick_import_folder", "pick_pdf", "pick_image"):
    try:
        got = getattr(api, name)()
        ok(f"{name} without a window returns an error", "error" in got, got)
    except Exception as e:                              # the original bug
        ok(f"{name} without a window returns an error", False, repr(e))

fake.windows = [Win(["/tmp/c.md"])]
ok("falls back to pywebview's window list", api.pick_import() == {"paths": ["/tmp/c.md"]})

js = open(os.path.join(APP, "ui", "notes", "app.js"), encoding="utf-8").read()
for fn in ("async function importFlow", "async function importPdfFlow"):
    body = js[js.index(fn):js.index(fn) + 900]
    ok(f"{fn.split()[-1]} shows a picker error", "picked.error" in body)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
