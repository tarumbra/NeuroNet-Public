"""Pictures by address (2026-10-05, the audit's first fix).

Thumbnails and frames used to cross the pywebview bridge as base64 text and
sit in the page as strings (SS.Art keeps up to 1,200). Measured with 874 photo
thumbnails and 217 album covers on screen: the page's JavaScript memory went
from 35 MB to 9 MB, the renderer from 893 MB to 821 MB. Now the display-only
calls return an address on NeuroNet's own token-protected media server; the
data-returning calls (full photos, for boards, scrapbooks and prints) are
unchanged.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")      # never Cam's data
import sys  # noqa: E402
import tempfile  # noqa: E402

TMP = tempfile.mkdtemp(prefix="nn-pics-")
os.environ["NEURONET_PATHS"] = os.path.join(TMP, "paths.json")            # this test's own folder
import json  # noqa: E402
import urllib.error  # noqa: E402
import urllib.request  # noqa: E402

DATA = os.path.join(TMP, "data")
os.makedirs(DATA)
with open(os.environ["NEURONET_PATHS"], "w") as f:
    json.dump({"data": DATA}, f)

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import neuronet as nn  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


print("\nPictures by address\n")
ok("the data folder is the test's own", nn.data_dir() == DATA, nn.data_dir())
try:
    from PIL import Image
except ImportError:
    Image = None

if Image is None:
    print("  skip  (Pillow isn't installed)")
else:
    os.makedirs(nn.photos_dir(), exist_ok=True)
    Image.new("RGB", (900, 600), (40, 120, 60)).save(os.path.join(nn.photos_dir(), "lake.jpg"))
    api = nn.Api()
    got = api.photo_thumb("lake.jpg")
    url = (got or {}).get("dataUrl", "")
    ok("a photo's thumbnail comes back as an address, not as text",
       url.startswith("http://127.0.0.1:") and "/media/" in url and "/photo-thumbs/" in url and "?v=" in url, url[:80])
    ok("  the frame copy too", (api.photo_frame("lake.jpg") or {}).get("dataUrl", "").startswith("http://127.0.0.1:"))
    ok("  the full photo is still the picture's data (boards, scrapbooks and prints embed it)",
       str((api.photo_full("lake.jpg") or {}).get("dataUrl", "")).startswith("data:image/"))
    with urllib.request.urlopen(url, timeout=5) as r:
        body, ctype, cache = r.read(), r.headers.get("Content-Type"), r.headers.get("Cache-Control", "")
    ok("the server sends the picture, kept by the engine (its address names its version)",
       body[:2] == b"\xff\xd8" and ctype == "image/jpeg" and "immutable" in cache, (ctype, cache))

    def status(u):
        try:
            with urllib.request.urlopen(u, timeout=5) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code

    base = url.split("?")[0]
    token = base.split("/")[4]
    ok("  a wrong token is refused", status(base.replace(token, "x" * len(token))) == 403)
    ok("  so is a path out of the folder, and a folder that isn't served",
       status(base.rsplit("/", 1)[0] + "/..%2Fneuronet.json") == 404
       and status(base.replace("/photo-thumbs/", "/notes/")) == 404)
    open(os.path.join(nn.thumbs_dir(), "song.mp3"), "wb").write(b"ID3")
    ok("  and a picture folder serves only pictures", status(base.rsplit("/", 1)[0] + "/song.mp3") == 404)
    # 2026-10-06: Assets' tiles and the journal's pictures go by address too
    import base64, io, journal as jn  # noqa: E401
    buf = io.BytesIO()
    Image.new("RGBA", (800, 400), (200, 30, 30, 128)).save(buf, "PNG")
    added = api.asset_add("stickers", "Red", "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())
    aid = (added or {}).get("id") or ((added or {}).get("asset") or {}).get("id")
    t = api.asset_thumb_url(aid) if aid else None
    turl = (t or {}).get("dataUrl", "")
    ok("an asset's tile is a small picture by address, made once", turl.startswith("http://127.0.0.1:") and "/asset-thumbs/" in turl, (added, t))
    if turl:
        with urllib.request.urlopen(turl, timeout=5) as r:
            im = Image.open(io.BytesIO(r.read()))
        ok("  a PNG, still see-through, no bigger than 200 px", im.format == "PNG" and max(im.size) <= 200 and im.mode == "RGBA", (im.format, im.size, im.mode))
    ok("  inserting one into a scrapbook or drawing still gets the picture's data",
       str((api.asset_data(aid) or {}).get("dataUrl", "")).startswith("data:image/png") if aid else False)
    os.makedirs(jn.images_dir(), exist_ok=True)
    Image.new("RGB", (1600, 1000), (10, 90, 160)).save(os.path.join(jn.images_dir(), "beach.jpg"))
    ju = api.journal_image_url("beach.jpg", True) or ""
    ok("a journal picture is by address (its small copy for the list)", ju.startswith("http://127.0.0.1:") and "/journal-thumbs/" in ju, ju[:90])
    ok("  the full one too", (api.journal_image_url("beach.jpg", False) or "").startswith("http://127.0.0.1:"))
    ok("  and a printout gets the data, so it stands on its own",
       str(api.journal_image_url("beach.jpg", False, True) or "").startswith("data:image/jpeg"))
    ok("  a name with a path in it gets nothing", api.journal_image_url("../neuronet.json", False) is None)

    audio = nn.media_url_for("meditation", "x.mp3")
    ok("audio is still served as before, never cached", audio and "/media/" in audio)

src = __import__("backend_src").backend_source(APP)
ok("card thumbnails go by address too (music's went with it to NeuroStream)", '_picture("cards-thumbs"' in src)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
