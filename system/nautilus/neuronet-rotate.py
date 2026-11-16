"""Rotate Left / Rotate Right on pictures in the file manager (15 November 2026).

Cam: "a right click option for when i right click photos in the file manager
for rotate left and right so i dont need to open the photo to do it". A
nautilus-python extension (installed by system/install.sh into
~/.local/share/nautilus-python/extensions/); the turning is done by the
neuronet-rotate command, the same code as NeuroNet's Photos. Works on one
picture or a whole selection; anything not a picture in it is skipped.
"""
import os
import shutil

from gi import require_version

require_version("Nautilus", "4.1")

from gi.repository import GObject, Gio, Nautilus  # noqa: E402

EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tif", ".tiff"}


def _command():
    return shutil.which("neuronet-rotate") or (
        os.path.expanduser("~/.local/bin/neuronet-rotate")
        if os.path.exists(os.path.expanduser("~/.local/bin/neuronet-rotate")) else None)


class NeuroNetRotate(GObject.GObject, Nautilus.MenuProvider):
    def _paths(self, files):
        out = []
        for f in files:
            if f.is_directory():
                continue
            loc = f.get_location()
            path = loc.get_path() if loc else None
            if not path:
                continue          # not a local file (a phone, a network share)
            mime = f.get_mime_type() or ""
            ext = os.path.splitext(path)[1].lower()
            if ext in EXTENSIONS and (mime.startswith("image/") or not mime):
                out.append(path)
        return out

    def _run(self, _item, direction, paths):
        cmd = _command()
        if cmd:
            Gio.Subprocess.new([cmd, direction, *paths], Gio.SubprocessFlags.NONE)

    def get_file_items(self, files):
        paths = self._paths(files)
        if not paths or not _command():
            return []
        items = []
        for direction, label, icon in (("left", "Rotate Left", "object-rotate-left"),
                                       ("right", "Rotate Right", "object-rotate-right")):
            item = Nautilus.MenuItem(name="NeuroNetRotate::" + direction,
                                     label=label, icon=icon)
            item.connect("activate", self._run, direction, paths)
            items.append(item)
        return items
