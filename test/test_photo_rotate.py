"""Rotate Left / Right (15 Nov 2026): photo_rotate.py on scratch pictures, the
neuronet-rotate command, and the wiring in Photos, the file manager extension
and the installers. Never Cam's photos: everything is in a scratch folder.

Run: python3 test/test_photo_rotate.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import photo_rotate  # noqa: E402
from PIL import Image  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def marked(path, size=(64, 32), **save):
    """A red picture with a blue square in its top-left corner."""
    im = Image.new("RGB", size, (255, 0, 0))
    im.paste((0, 0, 255), (0, 0, 8, 8))
    im.save(path, **save)


def blue_at(path, xy):
    with Image.open(path) as im:
        r, g, b = im.convert("RGB").getpixel(xy)
    return b > 200 and r < 60


tmp = tempfile.mkdtemp(prefix="nn-rotate-")
try:
    for ext in (".jpg", ".png", ".webp"):
        p = os.path.join(tmp, "pic" + ext)
        marked(p, quality=95) if ext != ".png" else marked(p)
        r = photo_rotate.rotate(p, "right")
        ok(ext + " turns right", r.get("ok") and Image.open(p).size == (32, 64)
           and blue_at(p, (28, 3)), r)
        r = photo_rotate.rotate(p, "left")
        ok(ext + " turns back left", r.get("ok") and Image.open(p).size == (64, 32)
           and blue_at(p, (3, 3)), r)

    odd = os.path.join(tmp, "odd.jpg")
    marked(odd, size=(63, 31), quality=95)
    ok("a JPEG jpegtran can't turn exactly still turns (Pillow)",
       photo_rotate.rotate(odd, "left").get("ok") and Image.open(odd).size == (31, 63))

    tagged = os.path.join(tmp, "tagged.jpg")
    ex = Image.Exif()
    ex[0x0112] = 6                       # "turn me 90 clockwise to view"
    marked(tagged, quality=95, exif=ex.tobytes())
    r = photo_rotate.rotate(tagged, "right")
    with Image.open(tagged) as im:
        ok("a sideways-tagged JPEG ends upright, tag reset to 1",
           r.get("ok") and im.size == (64, 32) and im.getexif().get(0x0112) == 1, (r, im.size))

    ok("no scratch files left beside the pictures",
       sorted(os.listdir(tmp)) == ["odd.jpg", "pic.jpg", "pic.png", "pic.webp", "tagged.jpg"],
       os.listdir(tmp))

    txt = os.path.join(tmp, "notes.txt")
    open(txt, "w").write("hi")
    ok("not a picture: an error, file untouched",
       photo_rotate.rotate(txt, "left").get("error") and open(txt).read() == "hi")
    ok("missing file: an error", photo_rotate.rotate(os.path.join(tmp, "gone.jpg"), "left").get("error"))
    ok("bad direction: an error", photo_rotate.rotate(odd, "up").get("error"))

    gif = os.path.join(tmp, "moving.gif")
    frames = [Image.new("RGB", (10, 20), c) for c in ("red", "blue")]
    frames[0].save(gif, save_all=True, append_images=frames[1:])
    before = open(gif, "rb").read()
    ok("a moving GIF is left alone", photo_rotate.rotate(gif, "left").get("error")
       and open(gif, "rb").read() == before)
    os.remove(gif)
    os.remove(txt)

    cmd = os.path.join(APP, "neuronet-rotate")
    env = dict(os.environ, PATH=tmp + os.pathsep + os.environ.get("PATH", ""))
    open(os.path.join(tmp, "notify-send"), "w").write("#!/bin/sh\nexit 0\n")   # never Cam's notifications
    os.chmod(os.path.join(tmp, "notify-send"), 0o755)
    r = subprocess.run([sys.executable, cmd, "right", os.path.join(tmp, "pic.png"), os.path.join(tmp, "pic.jpg")],
                       env=env, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    ok("neuronet-rotate right turns every file it's given",
       r.returncode == 0 and Image.open(os.path.join(tmp, "pic.png")).size == (32, 64)
       and Image.open(os.path.join(tmp, "pic.jpg")).size == (32, 64), r.stderr)
    r = subprocess.run([sys.executable, cmd, "sideways", "x.jpg"], env=env, capture_output=True, text=True)
    ok("neuronet-rotate with a bad direction says how to use it", r.returncode == 2 and "left" in r.stderr)

    # the wiring
    ext = open(os.path.join(APP, "system", "nautilus", "neuronet-rotate.py")).read()
    ok("file manager extension offers Rotate Left and Rotate Right through neuronet-rotate",
       '"Rotate Left"' in ext and '"Rotate Right"' in ext and "neuronet-rotate" in ext)
    inst = open(os.path.join(APP, "system", "install.sh")).read()
    ok("install.sh puts it in nautilus-python/extensions (and takes it out on uninstall)",
       '"$SYS"/nautilus/*.py' in inst and "extensions/neuronet-rotate.py" in inst)
    setup = open(os.path.join(APP, "system", "bin", "neuronet-setup")).read()
    ok("neuronet-setup installs the neuronet-rotate command", "neuronet-rotate" in setup)
    api = open(os.path.join(APP, "api", "photos.py")).read()
    ok("Photos' backend has photo_rotate, using photo_rotate.py",
       "def photo_rotate(self" in api and "photo_rotate.rotate(" in api)
    js = open(os.path.join(APP, "ui", "app.js")).read()
    ok("the photo grid's right-click opens Rotate left / right",
       'galleryEl.addEventListener("contextmenu"' in js and "photoMenu(" in js
       and 'data-rot="left"' in js and 'data-rot="right"' in js)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
