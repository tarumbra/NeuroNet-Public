"""NeuroNet's remote on the session bus (mpris.py, org.neuronet.App).

It was NeuroNet on the Linux media bus as a music player too (MPRIS), until the music went to NeuroStream on
19 Nov 2026 (V31). What's left is checked here, on a PRIVATE session bus (dbus-run-session) so a running
NeuroNet is never disturbed:

  - Quick and Compact become SS.quickMode(...) calls, and a command sent before the page is ready waits for
    it (the page says so through Api.app_bus_ready -> ready());
  - Raise brings the window forward;
  - Do waits for the page's answer (neuronet-call prints it);
  - NeuroNet no longer claims a music player's name (that's NeuroStream's, org.mpris.MediaPlayer2.neurostream).
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import re
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import mpris                                            # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


# Re-run inside a private bus, once.
if not os.environ.get("NN_MPRIS_PRIVATE_BUS"):
    env = dict(os.environ, NN_MPRIS_PRIVATE_BUS="1")
    r = subprocess.run(["dbus-run-session", "--", sys.executable, __file__], env=env)
    sys.exit(r.returncode)

print("\nOn the bus\n")
calls = []
m = mpris.Mpris(calls.append, lambda: calls.append("RAISE"))
ok("claims org.neuronet.App", m.start(), m.error)

APPDEST = ["--session", "--dest", mpris.APP_NAME, "--object-path", mpris.APP_PATH]


def app_call(method, *args):
    r = subprocess.run(["gdbus", "call", *APPDEST, "--method", method, *args],
                       capture_output=True, text=True, timeout=10)
    return (r.stdout + r.stderr).strip()


def js():
    time.sleep(0.3)
    out = list(calls)
    calls.clear()
    return out


names = subprocess.run(["busctl", "--user", "list", "--no-legend"], capture_output=True, text=True).stdout
ok("NeuroNet owns org.neuronet.App, so a second copy can see it's open", mpris.APP_NAME in names)
ok("  and no music player's name any more (the music is NeuroStream's)", "org.mpris.MediaPlayer2.neuronet" not in names)

print("\nQuick access\n")
app_call("org.neuronet.App.Quick", "notes", "true")
ok("a command before the page is ready waits", js() == [])
m.ready()
got = "".join(js())
ok("  and runs once the page says it's up", 'SS.quickMode("notes", true)' in got, got)
app_call("org.neuronet.App.Compact", "false")
got = "".join(js())
ok("Compact(false) turns the compact look off without moving", 'SS.quickMode("", false)' in got, got)
app_call("org.neuronet.App.Raise")
ok("Raise brings the window forward", js() == ["RAISE"])

print("\nBar widget requests (org.neuronet.App.Do)\n")
seen_page = []


def fake_page(code):
    """Stands in for the page: answers SS.boardDo as NeuroNet's would."""
    found = re.search(r'SS\.boardDo\("([^"]+)", "([^"]+)", (".*")\)$', code)
    if not found:
        calls.append(code)
        return
    token, action, payload = found.group(1), found.group(2), json.loads(found.group(3))
    seen_page.append((action, json.loads(payload)))
    body = json.loads(payload)
    answer = {"duplicate": True, "title": "Pancakes"} if body.get("title") == "Pancakes" else {"ok": True, "echo": body}
    threading.Timer(0.2, lambda: m.finish(token, json.dumps(answer))).start()


m._run_js = fake_page
r = app_call("org.neuronet.App.Do", "recipe.add", json.dumps({"title": "Toast"}))
ok("Do waits for the page and returns its answer",
   "ok" in r and "Toast" in r and seen_page and seen_page[-1][0] == "recipe.add", r)
out = subprocess.run([os.path.join(APP, "neuronet-call"), "recipe.add", json.dumps({"title": "Pancakes"})],
                     capture_output=True, text=True, timeout=30).stdout.strip()
ok("neuronet-call prints the answer as one line of JSON (the duplicate here)",
   json.loads(out) == {"duplicate": True, "title": "Pancakes"}, out)
ok("  with the details passed through intact", seen_page[-1][1] == {"title": "Pancakes"})
ok("a late answer for a request already answered is ignored", m.finish("d-unknown", "{}") is False)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
