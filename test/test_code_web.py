"""Code -> Web playground, the backend (code_web.py, Api.code_web_*).

Pages are kept by id in neuronet_data/code/web/ -- never by a path the page
sends -- so nothing can read or write outside that folder. All in a temp
folder.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, shutil, sys, tempfile

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


print("\nWeb playground: the pages on disk\n")
import code_web as cw  # noqa: E402

d = tempfile.mkdtemp(prefix="nn-codeweb-")
try:
    r = cw.write(d, None, {"name": "My Site!", "html": "<h1>Hi</h1>", "css": "h1{color:red}"})
    ok("a new page is saved, named from its name", r == {"ok": True, "id": "my-site", "name": "My Site!"}, r)
    ok("  as one file in code/web", os.listdir(os.path.join(d, "code", "web")) == ["my-site.json"])
    ok("  a second with the same name gets its own id", cw.write(d, None, {"name": "My Site!"})["id"] == "my-site-2")
    got = cw.read(d, "my-site")
    ok("read back as written", got["html"] == "<h1>Hi</h1>" and got["css"] == "h1{color:red}" and got["name"] == "My Site!")
    ok("listed, newest first", [p["id"] for p in cw.listing(d)][0] in ("my-site", "my-site-2") and len(cw.listing(d)) == 2)
    outside = os.path.join(d, "outside.json")
    bad = ["../outside", "../../etc/passwd", "/etc/passwd", "a/b", "A-Upper", "", ".hidden", "-x", "x" * 61, None, 5]
    ok("SECURITY: a page is only ever named by a plain id -- no paths, ever",
       all("error" in cw.read(d, b) for b in bad) and all("error" in cw.write(d, b, {"name": "x"}) for b in bad if b)
       and all("error" in cw.delete(d, b) for b in bad) and not os.path.exists(outside))
    ok("  and a file of another kind in the folder isn't listed", (open(os.path.join(d, "code", "web", "notes.txt"), "w").write("x"), len(cw.listing(d)))[1] == 2)
    ok("too big: refused, nothing written", "error" in cw.write(d, "my-site", {"html": "x" * (cw.MAX_CHARS + 1)})
       and cw.read(d, "my-site")["html"] == "<h1>Hi</h1>")
    ok("delete", cw.delete(d, "my-site-2") == {"ok": True} and len(cw.listing(d)) == 1)
    page = cw.as_html({"name": "T<i>", "html": "<p>x</p>", "css": "p{} </style><script>"})
    ok("Export: one standalone .html, the CSS in its head", page.startswith("<!doctype html>") and "<p>x</p>" in page
       and "<title>Ti</title>" in page and "<\\/style><script>" in page and page.count("</style>") == 1)
    whole = cw.as_html({"html": "<!doctype html><html><head><title>A</title></head><body>b</body></html>", "css": "b{}"})
    ok("  a whole document keeps its own head, with the CSS added", whole.count("<head>") == 1 and "b{}" in whole
       and whole.index("b{}") < whole.index("</head>"))
finally:
    shutil.rmtree(d, ignore_errors=True)

api = __import__("backend_src").backend_source(APP)
ok("the Api: list, read, write, delete, export", all("def code_web_%s(self" % n in api for n in ("list", "read", "write", "delete", "export")))

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
