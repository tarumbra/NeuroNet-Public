"""Turn a picture a quarter turn, in its own file (15 November 2026).

Cam: "a right click option for when i right click photos in the file manager
for rotate left and right so i dont need to open the photo to do it ... on
omarchy as well not just neuronet". One copy, used by both: NeuroNet's Photos
(api/photos.py, photo_rotate) and Omarchy's file manager (the Nautilus
extension system/nautilus/neuronet-rotate.py, through the neuronet-rotate
command).

The pixels themselves are turned and the EXIF "orientation" is set back to
upright, so every viewer (and NeuroNet's thumbnails, which ignore that tag)
shows the same thing. An ordinary JPEG goes through jpegtran: lossless, the
EXIF and colour profile kept. Anything else (PNG, WebP, a JPEG that was
already tagged as sideways, one whose size jpegtran can't turn perfectly)
goes through Pillow, at high quality. Animated GIFs/WebPs are left alone.
"""
import os
import shutil
import subprocess
import tempfile

EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tif", ".tiff")
JPEG = (".jpg", ".jpeg")


def _jpegtran(path, degrees):
    """True if jpegtran turned it losslessly (only when it can do so exactly)."""
    tool = shutil.which("jpegtran")
    if not tool:
        return False
    fd, tmp = tempfile.mkstemp(suffix=".jpg", dir=os.path.dirname(path) or ".")
    os.close(fd)
    try:
        r = subprocess.run([tool, "-copy", "all", "-perfect", "-rotate", str(degrees),
                            "-outfile", tmp, path],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        if r.returncode != 0 or os.path.getsize(tmp) == 0:
            return False
        shutil.copymode(path, tmp)
        os.replace(tmp, path)
        tmp = None
        return True
    except (OSError, subprocess.SubprocessError):
        return False
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def rotate(path, direction):
    """Turn `path` a quarter turn: direction "left" (anticlockwise) or "right".

    Returns {"ok": True} or {"error": "..."}; the file is replaced in one step
    (written beside it, then renamed over it), so a failure leaves it as it was.
    """
    if direction not in ("left", "right"):
        return {"error": "Rotate left or right."}
    if not os.path.isfile(path):
        return {"error": "That picture isn't there any more."}
    ext = os.path.splitext(path)[1].lower()
    if ext not in EXTENSIONS:
        return {"error": "That doesn't look like a picture."}
    try:
        from PIL import Image, ImageOps
    except ImportError:
        Image = None

    orientation = 1
    if Image is not None:
        try:
            with Image.open(path) as im:
                if getattr(im, "n_frames", 1) > 1:
                    return {"error": "Moving pictures can't be turned here."}
                orientation = im.getexif().get(0x0112, 1) or 1
        except Exception:
            return {"error": "That picture couldn't be read."}

    degrees = 90 if direction == "right" else 270      # jpegtran turns clockwise
    if ext in JPEG and orientation == 1 and _jpegtran(path, degrees):
        return {"ok": True}
    if Image is None:
        return {"error": "Pillow isn't installed, so only plain JPEGs can be turned."}

    try:
        with Image.open(path) as im:
            fmt = im.format
            info = dict(im.info)
            exif = im.getexif()
            upright = ImageOps.exif_transpose(im)
            turned = upright.transpose(Image.Transpose.ROTATE_270 if direction == "right"
                                       else Image.Transpose.ROTATE_90)
        if exif:
            exif[0x0112] = 1
        opts = {}
        if exif:
            opts["exif"] = exif.tobytes()
        if info.get("icc_profile"):
            opts["icc_profile"] = info["icc_profile"]
        if fmt == "JPEG":
            opts.update(quality=95, subsampling=0)
            if turned.mode not in ("RGB", "L", "CMYK"):
                turned = turned.convert("RGB")
        elif fmt == "WEBP":
            opts.update(lossless=bool(info.get("lossless")), quality=95)
        fd, tmp = tempfile.mkstemp(suffix=ext, dir=os.path.dirname(path) or ".")
        os.close(fd)
        try:
            turned.save(tmp, fmt, **opts)
            shutil.copymode(path, tmp)
            os.replace(tmp, path)
            tmp = None
        finally:
            if tmp and os.path.exists(tmp):
                os.remove(tmp)
        return {"ok": True}
    except Exception as e:
        return {"error": "That picture couldn't be turned (%s)." % e}
