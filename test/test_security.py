"""NeuroNet against remote code execution -- the whole app.

Cam (2026-10-02): "take the perspective of a senior cyber security expert to
ensure there is no chance for remote code execution within the application.
This is as a whole as well please."

THE THREAT. NeuroNet's page holds the bridge to Python
(window.pywebview.api), and Code -> IDE's runner can run commands. So any
foreign script that runs in that page -- from a web site the window was
steered to, a crafted PDF, an imported book or note, an <img onerror> -- would
be code running on Cam's computer. Each door is checked here:

  1. the window only ever shows NeuroNet's own files (navigation_verdict,
     lock_qt_navigation), and new windows only open web/mail links;
  2. the page only runs NeuroNet's own scripts (its Content-Security-Policy:
     no injected <script>, no on...= handlers, no javascript: links);
  3. PDFs: pdf.js without eval (CVE-2024-4367);
  4. imported books and notes: EPUB through an allow-list cleaner, notes'
     markdown escaped, links out only http(s);
  5. frames: the reader and the web playground's preview can't run scripts;
  6. the only local server: 127.0.0.1, a secret in every URL, read-only;
  7. Python never builds JavaScript or shell commands from data (json.dumps
     into evaluate_js; no shell=True but the IDE's own runner; no eval/exec/
     pickle of data); the dock only takes a window address.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import base64, glob, hashlib, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
UI = os.path.join(APP, "ui")
sys.path.insert(0, APP)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


print("\nSecurity: no way for foreign code to run on Cam's computer\n")
import neuronet  # noqa: E402

# ---- 1. where the window may go --------------------------------------------------
ui = os.path.realpath(UI)
APPO = "http://127.0.0.1:41231"          # pywebview serves ui/ from its own server
V = lambda url, main=True, click=False: neuronet.navigation_verdict(url, main, click, ui, APPO)
idx = "file://" + ui + "/index.html"
ok("1. the window shows NeuroNet's own pages (pywebview's server of ui/, or the files)",
   V(APPO + "/index.html") == "allow" and V(APPO + "/index.html#x") == "allow" and V(idx) == "allow")
ok("   only that server: another port on 127.0.0.1 (the media server, another program) is not NeuroNet",
   V("http://127.0.0.1:41232/index.html") == "deny" and V("http://localhost:41231/") == "deny"
   and V("https://127.0.0.1:41231/") == "deny")
ok("   a web page in the window: refused (it would get the bridge)",
   V("https://evil.example/") == "deny" and V("http://127.0.0.1:8000/") == "deny")
ok("   a clicked web or mail link opens in the browser instead",
   V("https://example.com", click=True) == "external" and V("mailto:a@b.c", click=True) == "external")
ok("   data:, javascript:, blob:, about: and other folders: refused in the window",
   all(V(u, click=True) == "deny" for u in ("data:text/html,<script>x</script>", "javascript:alert(1)",
       "blob:file:///x", "about:blank", "file:///etc/passwd", "file://" + ui + "/../neuronet.py",
       "file://" + ui + "x/index.html", "file://evil.host" + ui + "/index.html", "ftp://x/")))
ok("   frames in the page: about:/data:/blob: and NeuroNet's files, never the web",
   V("about:srcdoc", main=False) == "allow" and V("data:image/png,x", main=False) == "allow"
   and V("https://example.com", main=False) == "deny" and V("http://127.0.0.1:1/", main=False) == "deny"
   and V("file:///etc/passwd", main=False) == "deny")
try:
    from webview.platforms import qt as wq
    have_qt = True
except Exception:
    have_qt = False
if have_qt:
    ok("   fitted to pywebview's Qt page, and its new-window handler", neuronet.lock_qt_navigation(ui)
       and getattr(wq.BrowserView.WebPage, "_nn_nav_lock", False)
       and wq.BrowserView.NavigationHandler.acceptNavigationRequest.__name__ == "handler_accept")
    from webview import http as wh
    srv = wh.BottleServer()
    srv.js_callback["x"] = lambda body: "ran"
    ok("   pywebview's HTTP bridge (POST /js_api/<uid>, CORS *) is sealed: nothing can be put behind it",
       "x" not in srv.js_callback and isinstance(srv.js_callback, wh._NNSealed))
else:
    print("  skip  the Qt half (pywebview's Qt platform isn't importable here)")
src = __import__("backend_src").backend_source(APP)
ok("   main() fits it before the window opens", "lock_qt_navigation(ui_dir())" in src
   and src.index("lock_qt_navigation(ui_dir())") < src.index("webview.start(gui=gui) if gui"))

# ---- 2. only NeuroNet's own scripts ----------------------------------------------
html = read(UI, "index.html")
m = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
csp = m.group(1) if m else ""
inline = re.findall(r"<script>(.*?)</script>", html, re.S)
want = ["'sha256-%s'" % base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() for s in inline]
ok("2. the page's Content-Security-Policy comes first in <head>", m and html.index(m.group(0)) < html.index("<script"))
ok("   scripts only from NeuroNet's files, plus its one inline snippet (by hash)",
   csp.startswith("script-src 'self' file: ") and all(w in csp for w in want) and len(inline) == 1
   and "'unsafe-inline'" not in csp.split(";")[0], csp)
ok("   no plugins, no <base>, no form posting", all(x in csp for x in ("object-src 'none'", "base-uri 'none'", "form-action 'none'")))
handlers = []
for f in glob.glob(os.path.join(UI, "**", "*.js"), recursive=True) + [os.path.join(UI, "index.html")]:
    if "/vendor/" in f:
        continue
    t = read(f)
    handlers += [(os.path.relpath(f, UI), h) for h in re.findall(r"""<[a-z][^>]*\son[a-z]+\s*=\s*["']""", t)]
ok("   NeuroNet itself writes no on...= handlers into its HTML (the policy would block them)", not handlers, handlers[:3])

# ---- 3. PDFs -------------------------------------------------------------------
calls = []
for f in glob.glob(os.path.join(UI, "**", "*.js"), recursive=True):
    if "/vendor/" in f:
        continue
    calls += [(os.path.relpath(f, UI), c) for c in re.findall(r"getDocument\(\{[^}]*\}\)", read(f))]
ok("3. every PDF opens with isEvalSupported: false (CVE-2024-4367)", calls and all("isEvalSupported: false" in c for _, c in calls), calls)

# ---- 4. imported books and notes -----------------------------------------------------
import ebooks  # noqa: E402
c = ebooks._Clean(lambda s: s, lambda h: "")
c.feed('<p onclick="x()">Hi<img src="a.png" onerror="alert(1)"><script>alert(2)</script>'
       '<a href="javascript:alert(3)">l</a><iframe src="x"></iframe><svg><script>y</script></svg></p>')
c.close()
clean = "".join(c.out)
ok("4. an EPUB chapter keeps its words, loses everything that could act",
   "Hi" in clean and not re.search(r"on\w+=|<script|javascript:|<iframe|<svg|alert\(2\)", clean), clean)
notes = read(UI, "notes", "app.js")
ok("   notes' markdown is escaped before it is HTML", "text = escapeHtml(text);" in notes)
nb = read(APP, "notes_backend.py")
ok("   a link out of a note opens only http(s), in the browser",
   re.search(r'if re\.match\(r"\^https\?://", url or ""\):\s+webbrowser\.open\(url\)', nb) is not None)

# ---- 5. frames ---------------------------------------------------------------------
reader = read(UI, "reader", "reader.js")
ok("5. the book reader's frame runs no scripts", 'sandbox="allow-same-origin"' in reader and "allow-scripts" not in reader)
web = read(UI, "code", "web.js")
ok("   the web playground's preview is sandbox=\"\" with its own no-loading CSP",
   'sandbox="" title="Your page"' in web and 'const SANDBOX = "";' in web and "default-src 'none'" in web
   and "allow-scripts" not in web.split("SECURITY.", 1)[1].split("*/", 1)[1])

# ---- 6. the local server ----------------------------------------------------------------
ok("6. the media server: 127.0.0.1 only, a secret in every URL, compared in constant time",
   'ThreadingHTTPServer(("127.0.0.1", 0)' in src and "secrets.token_urlsafe" in src and "secrets.compare_digest(tok, token)" in src
   and "def do_POST" not in src)

# ---- 7. Python never runs data ----------------------------------------------------------
py = [f for f in glob.glob(os.path.join(APP, "*.py")) + glob.glob(os.path.join(APP, "crux", "py", "*.py"))
      + glob.glob(os.path.join(APP, "api", "*.py"))]
shell = [os.path.basename(f) for f in py if "shell=True" in read(f)]
ok("7. shell=True only in the IDE's own runner (commands Cam types)", shell == ["code_runner.py"], shell)
evals = [(os.path.basename(f), l.strip()) for f in py for l in read(f).splitlines()
         if re.search(r"(^|[^.\w])(eval|exec)\(|pickle\.loads?\(|yaml\.load\(", l) and not l.strip().startswith("#")
         # the one allowed: neuronet.py running its own api/<section>.py files (the backend split, 2026-10-06)
         and not (os.path.basename(f) == "neuronet.py" and l.strip().startswith('exec(compile(f.read(), path, "exec"), g)'))]
_nn = read(os.path.join(APP, "neuronet.py"))
ok("   the backend's sections are run only from api/, by a fixed list of names",
   'here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "api")' in _nn
   and "API_PARTS = [" in _nn and _nn.count("exec(compile(") == 1)
ok("   no eval / exec / pickle / yaml.load of data", not evals, evals)
mp = read(APP, "mpris.py")
js_calls = re.findall(r"_queue_js\((.*?)\)\n", mp, re.S)
ok("   JavaScript sent to the page quotes its data with json.dumps", js_calls and all("{json.dumps(" in j or "json.dumps" in j for j in js_calls
   if "{" in j), js_calls)
ok("   the popup's dock only takes a window address", '[[ "$other" =~ ^0x[0-9a-fA-F]+$ ]] || exit 0' in read(APP, "neuronet-quick"))

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
