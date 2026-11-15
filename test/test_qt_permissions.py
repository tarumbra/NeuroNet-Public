"""The qt renderer must not abort the app on a permission request.

Crash, 2026-09-26 (and eight times on 2026-08-28): NeuroNet vanished with
SIGABRT. pywebview 6.2.1's onFeaturePermissionRequested passes bare ints to
setFeaturePermission; PyQt6 6.11 rejects them with a TypeError, and PyQt turns
an exception inside a Qt callback into qFatal(). Pressing Copy -- a clipboard
request -- was enough.

This stands a fake webview.platforms.qt in for the real one, with a
setFeaturePermission as strict about its types as PyQt6 is, so it runs
without Qt or a display.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import enum, os, sys, types

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nThe qt renderer's permission requests\n")


class Feature(enum.Enum):
    Notifications = 0; Geolocation = 1; MediaAudioCapture = 2
    MediaVideoCapture = 3; MediaAudioVideoCapture = 4; ClipboardReadWrite = 8


class PermissionPolicy(enum.Enum):
    PermissionUnknown = 0; PermissionGrantedByUser = 1; PermissionDeniedByUser = 2


class QWebPage:
    Feature = Feature
    PermissionPolicy = PermissionPolicy


class Url:
    def __init__(self, scheme, host=""):
        self._s, self._h = scheme, host
    def scheme(self): return self._s
    def host(self): return self._h


answers = []


class WebPage:
    def setFeaturePermission(self, url, feature, policy):
        # PyQt6 6.11's own check: an int here is what crashed the app.
        if not isinstance(policy, PermissionPolicy):
            raise TypeError("argument 3 has unexpected type '%s'" % type(policy).__name__)
        answers.append((url.scheme(), url.host(), feature, policy))

    def onFeaturePermissionRequested(self, url, feature):   # pywebview 6.2.1's
        self.setFeaturePermission(url, feature, 2 if feature is not Feature.MediaAudioCapture else 1)


fake = types.ModuleType("webview.platforms.qt")
fake.QWebPage = QWebPage
fake.is_webengine = True
fake.BrowserView = types.SimpleNamespace(WebPage=WebPage)
pkg = types.ModuleType("webview"); plat = types.ModuleType("webview.platforms")
pkg.platforms = plat; plat.qt = fake
sys.modules.update({"webview": pkg, "webview.platforms": plat, "webview.platforms.qt": fake})

sys.path.insert(0, APP)
import neuronet  # noqa: E402

try:
    WebPage().onFeaturePermissionRequested(Url("file"), Feature.ClipboardReadWrite)
    reproduced = False
except TypeError:
    reproduced = True
ok("the stand-in reproduces the crash with pywebview's own handler", reproduced)

neuronet.fix_qt_permissions()
ok("NeuroNet replaces the handler", WebPage.onFeaturePermissionRequested.__module__ == "neuronet")


def ask(url, feature):
    answers.clear()
    WebPage().onFeaturePermissionRequested(url, feature)
    return answers[-1][3] if answers else None


G, D = PermissionPolicy.PermissionGrantedByUser, PermissionPolicy.PermissionDeniedByUser
try:
    got = ask(Url("file"), Feature.ClipboardReadWrite)
    ok("a clipboard request no longer raises", True)
except TypeError as e:
    got = None
    ok("a clipboard request no longer raises", False, e)
ok("  and NeuroNet's own page gets the clipboard, so Copy copies", got is G, got)
ok("  as does pywebview's loopback server",
   ask(Url("http", "127.0.0.1"), Feature.ClipboardReadWrite) is G)
ok("a page from anywhere else does not", ask(Url("https", "example.com"), Feature.ClipboardReadWrite) is D)
ok("camera and microphone are allowed, as pywebview allowed them",
   ask(Url("https", "example.com"), Feature.MediaAudioVideoCapture) is G)
ok("everything else is refused, as pywebview refused it",
   ask(Url("file"), Feature.Geolocation) is D and ask(Url("file"), Feature.Notifications) is D)


class Broken(WebPage):
    def setFeaturePermission(self, *a):
        raise RuntimeError("anything at all")


try:
    Broken().onFeaturePermissionRequested(Url("file"), Feature.Notifications)
    contained = True
except Exception:
    contained = False
ok("nothing can escape the handler -- an escape is what aborts the app", contained)

src = __import__("backend_src").backend_source(APP)
ok("it is installed before the qt renderer starts",
   src.find('if gui == "qt":\n        fix_qt_permissions()') != -1
   and src.find("fix_qt_permissions()\n") < src.find("webview.start(gui=gui)"))

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
