"""NeuroNet's player may start sound without a click in the page.

Cam, after the desktop board's Random album: "now it even shows up in the
player on the wallpaper but produces no sound". Chromium only lets audio
start after a click inside the page; a play asked for from outside (the
desktop board, the bar's music widget, the media keys) loaded the album and
was then refused at audio.play(). allow_qt_autoplay() (neuronet.py) turns
that rule off for NeuroNet's pages.

This is the REAL engine: pywebview's own page class, offscreen, asked to
start a short silent sound with no click -- refused without the fix, played
with it. Each run is its own process (QtWebEngine starts once per process).
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)

CHILD = r'''
import base64, io, os, struct, sys, wave
sys.path.insert(0, %(app)r)
os.environ["QT_QPA_PLATFORM"] = "offscreen"
os.environ["QTWEBENGINE_DISABLE_SANDBOX"] = "1"
from PyQt6.QtCore import Qt, QCoreApplication, QTimer
QCoreApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts)
from PyQt6.QtWidgets import QApplication
app = QApplication(sys.argv)
from PyQt6.QtWebEngineCore import QWebEngineProfile
from PyQt6.QtWebEngineWidgets import QWebEngineView
import neuronet
if %(fix)r:
    neuronet.allow_qt_autoplay()
from webview.platforms import qt as wq

buf = io.BytesIO()
w = wave.open(buf, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
w.writeframes(struct.pack("<h", 0) * 4000); w.close()
src = "data:audio/wav;base64," + base64.b64encode(buf.getvalue()).decode()

profile = QWebEngineProfile("nn-autoplay-test")
view = QWebEngineView()
import types
page = wq.BrowserView.WebPage(types.SimpleNamespace(webview=view, transparent=False), profile=profile)
view.setPage(page)
view.setHtml("""<audio id=a src='%%s'></audio><script>
  document.getElementById('a').play()
    .then(() => { document.title = 'PLAYED' })
    .catch((e) => { document.title = 'REFUSED ' + e.name })
</script>""" %% src)
ticks = [0]
def poll():
    ticks[0] += 1
    t = page.title()
    if t.startswith("PLAYED") or t.startswith("REFUSED") or ticks[0] > 100:
        print("RESULT", t, flush=True)
        os._exit(0)
timer = QTimer(); timer.timeout.connect(poll); timer.start(100)
app.exec()
'''

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def run(fix):
    r = subprocess.run([sys.executable, "-c", CHILD % {"app": APP, "fix": fix}],
                       capture_output=True, text=True, timeout=120)
    line = next((l for l in r.stdout.splitlines() if l.startswith("RESULT")), "")
    return line[len("RESULT "):], r.stderr[-400:]


print("\nPlaying without a click in the page\n")
got, err = run(False)
ok("without the fix, Chromium refuses a play nobody clicked for (the bug)",
   got.startswith("REFUSED"), got or err)
got, err = run(True)
ok("with allow_qt_autoplay(), NeuroNet's page plays it", got == "PLAYED", got or err)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
