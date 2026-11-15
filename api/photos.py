"""NeuroNet's backend: the photo library, its files, prefs and Omarchy's theme.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class PhotosApi:
    # -- library ------------------------------------------------------
    def library_info(self):
        """Where the library is, and whether it looks like a real one."""
        root = data_dir()
        has_json = os.path.isfile(data_file())
        photo_count = 0
        if os.path.isdir(os.path.join(root, "photos")):
            try:
                photo_count = len([n for n in os.listdir(os.path.join(root, "photos"))
                                   if not n.startswith(".")])
            except OSError:
                pass
        return {"root": root, "found": has_json, "photoFiles": photo_count,
                "missing": _missing_data}

    def choose_library(self):
        import webview
        picked = self._window.create_file_dialog(webview.FileDialog.FOLDER)
        if not picked:
            return {"cancelled": True}
        path = picked[0] if isinstance(picked, (list, tuple)) else picked
        if not os.path.isdir(path):
            return {"error": "That folder doesn't exist."}
        # paths.json comes before library_path.txt (data_dir, step 0), so on a
        # computer set up by neuronet-setup the choice has to go there, or
        # it would be quietly ignored at the next start.
        if os.path.isfile(paths_file()):
            import data_move
            data_move.point_paths(paths_file(), app_dir(), os.path.realpath(path))
        if not set_library_root(path):
            return {"error": "That folder doesn't exist."}
        return {"ok": True, "root": path}

    def photo_get_data(self):
        return normalize_data(read_json(data_file(), {}))

    def photo_save_data(self, data):
        """Writes the keys the library owns, leaving anything else alone.

        A blind overwrite would delete a key a future build adds and
        this one does not know about. Merging costs one extra read and
        removes that whole class of surprise.
        """
        try:
            clean = normalize_data(data)
            current = read_json(data_file(), {})
            if not isinstance(current, dict):
                current = {}
            for key in OWNED_KEYS:
                current[key] = clean[key]
            atomic_write_json(data_file(), current)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't save: {e}"}

    # -- Omarchy's theme ------------------------------------------------
    def omarchy_theme(self):
        """NeuroNet's colours worked out from the Omarchy theme in use --
        the "Follow Omarchy" theme (omarchy_theme.py)."""
        import omarchy_theme
        return omarchy_theme.current()

    # -- prefs --------------------------------------------------------
    def get_prefs(self):
        prefs = read_json(prefs_file(), {})
        return prefs if isinstance(prefs, dict) else {}

    def set_prefs(self, prefs):
        try:
            current = self.get_prefs()
            current.update(prefs if isinstance(prefs, dict) else {})
            atomic_write_json(prefs_file(), current)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't save preferences: {e}"}

    # -- photo files --------------------------------------------------
    def photo_pick(self):
        import webview
        picked = self._window.create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=True,
            file_types=("Images (*.jpg;*.jpeg;*.png;*.gif;*.webp)",
                        "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, str):
            picked = [picked]
        return {"paths": list(picked)}

    def photo_rename(self, stored_name, new_name):
        """Renames the file on disk, not just the caption.

        Cam: "when renaming a photo within KinCrux i want it to change
        the photo name in the stored location."

        THREE FILES MOVE. A photo has a thumbnail and a frame image
        whose names are derived from its own:

            photos/x.jpg  photos_thumbs/x.thumb.jpg  photos_frames/x.frame.jpg

        Move only the first and the thumbnail stops resolving -- the
        library fills with blank tiles that regenerate one at a time,
        which reads as the photos having gone.

        THE REFERENCES ARE THE CALLER'S JOB. An album cover, a tarot
        card face and a sliding-puzzle photo all point at a photo by
        this name. The interface holds the photo list and every module's
        document, so it updates them and saves once -- which is why this
        returns the new name rather than reaching into several files
        from down here.
        """
        try:
            src = os.path.join(photos_dir(), os.path.basename(str(stored_name or "")))
            if not stored_name or not os.path.isfile(src):
                return {"error": "That photo isn't in the library any more."}

            ext = os.path.splitext(stored_name)[1] or ".jpg"
            stem = _safe_file_stem(new_name)
            if not stem:
                return {"error": "That name can't be used for a file."}

            final = _unused_photo_name(stem, ext, keep=stored_name)
            if final == stored_name:
                return {"storedName": stored_name, "originalName": stored_name}

            os.replace(src, os.path.join(photos_dir(), final))

            # the thumbnail and the frame follow, or the tile goes blank
            for folder, namer in ((thumbs_dir(), _thumb_name),
                                  (frames_dir(), _frame_name)):
                old = os.path.join(folder, namer(stored_name))
                if os.path.isfile(old):
                    try:
                        os.replace(old, os.path.join(folder, namer(final)))
                    except OSError:
                        # a missing thumbnail regenerates; a half-moved
                        # one would not, so drop it rather than leave it
                        try:
                            os.remove(old)
                        except OSError:
                            pass

            return {"storedName": final, "originalName": final}
        except OSError as e:
            return {"error": f"Couldn't rename that photo: {e}"}

    # -- photo files named like the photos (2026-10-02) ----------------------
    # Cam: "when naming a photo or if it has been named within Neuronet
    # application please make the name in the file explorer match now. It is
    # difficult to find the photo i am looking for when browsing the files on
    # the PC." photo_rename moves the files; the page updates what it holds
    # (the photo index, the Kitchen's photos and recipes) and these do the rest.
    _PHOTO_REF_FILES = ("personal_effects.json",)

    def _photo_ref_paths(self):
        d = data_dir()
        out = [os.path.join(d, f) for f in self._PHOTO_REF_FILES]
        out += sorted(glob.glob(os.path.join(d, "notes", "boards", "*.json")))
        out += sorted(glob.glob(os.path.join(d, "notes", "scrapbooks", "*.json")))
        out += sorted(glob.glob(os.path.join(d, "notes", "covers", "*.json")))       # notebook covers (1.0.10)
        return [p for p in out if os.path.isfile(p)]

    def photo_refs_rename(self, mapping):
        """Old stored name -> new, in the files no page holds open (Media's
        covers, the boards): every string that IS an old name. -> {changed}"""
        mapping = {str(k): str(v) for k, v in (mapping or {}).items() if k and v and k != v}
        if not mapping:
            return {"changed": 0}
        changed = [0]

        def walk(o):
            if isinstance(o, dict):
                return {k: walk(v) for k, v in o.items()}
            if isinstance(o, list):
                return [walk(v) for v in o]
            if isinstance(o, str) and o in mapping:
                changed[0] += 1
                return mapping[o]
            return o
        for path in self._photo_ref_paths():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
            except (OSError, ValueError):
                continue
            before = changed[0]
            doc = walk(doc)
            if changed[0] != before:
                atomic_write_json(path, doc)
        return {"changed": changed[0]}

    def photo_names_backup(self, mapping=None):
        """Before the files are renamed: the photo index and every file that
        names photos, copied to neuronet_data/backups/photo-names-<time>/, and
        (called again with it) the old -> new list beside them, to undo by."""
        d = data_dir()
        folder = getattr(self, "_photo_names_folder", "")
        if not folder:
            folder = os.path.join(d, "backups", "photo-names-" + time.strftime("%Y%m%d-%H%M%S"))
            os.makedirs(folder, exist_ok=True)
            for rel in ("neuronet.json", "family/camily.json", "kitchen/cookery.json") + self._PHOTO_REF_FILES:
                src = os.path.join(d, rel)
                if os.path.isfile(src):
                    dest = os.path.join(folder, rel)
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    shutil.copy2(src, dest)
            for sub in ("boards", "scrapbooks", "covers"):
                src = os.path.join(d, "notes", sub)
                if os.path.isdir(src):
                    shutil.copytree(src, os.path.join(folder, "notes", sub), dirs_exist_ok=True,
                                    ignore=shutil.ignore_patterns("stickers"))
            self._photo_names_folder = folder
        if mapping:
            atomic_write_json(os.path.join(folder, "renamed.json"), mapping)
        return {"ok": True, "folder": folder}

    def photo_store(self, path):
        try:
            if not os.path.isfile(path):
                return {"error": "That file doesn't exist anymore."}
            ext = os.path.splitext(path)[1].lower()
            if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"):
                return {"error": "That doesn't look like an image file."}
            stored_name = uuid.uuid4().hex + ext
            dest = os.path.join(photos_dir(), stored_name)
            shutil.copy2(path, dest)
            try:
                _make_thumbnail(dest, os.path.join(
                    thumbs_dir(), _thumb_name(stored_name)))
            except Exception:
                pass
            return {"storedName": stored_name,
                    "originalName": os.path.basename(path),
                    "takenDate": read_taken_date(dest)}
        except OSError as e:
            return {"error": f"Couldn't store that photo: {e}"}

    def photo_store_data_url(self, data_url):
        try:
            import base64
            header, _, payload = data_url.partition(",")
            ext = ".png" if "png" in header else ".jpg"
            stored_name = uuid.uuid4().hex + ext
            dest = os.path.join(photos_dir(), stored_name)
            with open(dest, "wb") as f:
                f.write(base64.b64decode(payload))
            try:
                _make_thumbnail(dest, os.path.join(
                    thumbs_dir(), _thumb_name(stored_name)))
            except Exception:
                pass
            return {"storedName": stored_name, "originalName": stored_name}
        except (OSError, ValueError) as e:
            return {"error": f"Couldn't store that image: {e}"}

    def photo_full(self, stored_name):
        return _encode_file(os.path.join(photos_dir(), stored_name))

    def photo_thumb(self, stored_name):
        thumb = os.path.join(thumbs_dir(), _thumb_name(stored_name))
        if not os.path.isfile(thumb):
            source = os.path.join(photos_dir(), stored_name)
            if not os.path.isfile(source):
                return {"error": "That photo is missing."}
            try:
                _make_thumbnail(source, thumb)
            except Exception:
                return self.get_photo_data(stored_name)
        return _picture("photo-thumbs", thumb)

    def photo_frame(self, stored_name):
        frame = os.path.join(frames_dir(), _frame_name(stored_name))
        if not os.path.isfile(frame):
            source = os.path.join(photos_dir(), stored_name)
            if not os.path.isfile(source):
                return {"error": "That photo is missing."}
            try:
                _make_frame_copy(source, frame)
            except Exception:
                return self.get_photo_data(stored_name)
        return _picture("photo-frames", frame)

    def photo_delete(self, stored_name):
        for folder, name in ((photos_dir(), stored_name),
                             (thumbs_dir(), _thumb_name(stored_name)),
                             (frames_dir(), _frame_name(stored_name))):
            path = os.path.join(folder, name)
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except OSError:
                pass
        return {"ok": True}

    # ------------------------------------------------------------- snips
    # Cam (15 Nov 2026): "a snip feature that lives within NeuroNet so i can
    # stop using the screen shot tool". The capture is neuronet-snip (Omarchy's
    # own omasnap); snips.py keeps the names and ~/Documents/NeuroNet Picture References/NeuroNet Snips.

    def snip_take(self, mode="smart"):
        """The top bar's Snip button: neuronet-snip runs on its own (it hands
        the picture back through neuronet-call snip.add, ask=true)."""
        mode = mode if mode in ("smart", "region", "windows", "fullscreen", "scroll") else "smart"
        tool = os.path.join(os.path.dirname(os.path.abspath(__file__)), "neuronet-snip")
        if not os.path.isfile(tool):
            tool = os.path.join(app_dir(), "neuronet-snip")
        try:
            subprocess.Popen([tool, mode, "--from-app"], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
        except OSError as e:
            return {"error": f"Couldn't start the snip: {e}"}
        return {"ok": True}

    def snip_rename(self, n, definition=""):
        """Save as: "YYMMDD - Snip N - (Definition)" in NeuroNet Picture References/NeuroNet Snips."""
        import snips
        try:
            e = snips.rename(int(n), str(definition or ""))
        except (OSError, ValueError) as err:
            return {"error": f"Couldn't rename the snip: {err}"}
        if not e:
            return {"error": "That snip isn't in NeuroNet Picture References/NeuroNet Snips any more."}
        return {"ok": True, "n": e["n"], "name": e["name"][:-4], "definition": e["definition"],
                "path": e["path"], "archived": e["archived"]}

    def snip_info(self, n):
        import snips
        e = snips.find(int(n))
        if not e:
            return {"error": "That snip isn't in NeuroNet Picture References/NeuroNet Snips any more."}
        return {"ok": True, "n": e["n"], "day": e["day"], "name": e["name"][:-4],
                "definition": e["definition"], "archived": e["archived"], "folder": snips.snips_dir()}

    def photo_export(self, stored_name, original_name):
        src = os.path.join(photos_dir(), stored_name)
        if not os.path.isfile(src):
            return {"error": "That photo is missing from the library."}
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.isdir(desktop):
            desktop = os.path.expanduser("~")
        base = os.path.basename(original_name or stored_name)
        stem, ext = os.path.splitext(base)
        dest = os.path.join(desktop, base)
        n = 2
        while os.path.exists(dest):
            dest = os.path.join(desktop, f"{stem} ({n}){ext}")
            n += 1
        try:
            shutil.copy2(src, dest)
            return {"ok": True, "path": dest}
        except OSError as e:
            return {"error": f"Couldn't export: {e}"}

    def photo_export_many(self, items):
        """Exports a selection into a dated folder on the desktop, so a
        big export doesn't scatter fifty loose files across it."""
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.isdir(desktop):
            desktop = os.path.expanduser("~")
        import datetime
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H%M")
        folder = os.path.join(desktop, f"KinCrux export {stamp}")
        try:
            os.makedirs(folder, exist_ok=True)
        except OSError as e:
            return {"error": f"Couldn't make the export folder: {e}"}
        done, failed = 0, 0
        for item in (items or []):
            src = os.path.join(photos_dir(), item.get("storedName", ""))
            if not os.path.isfile(src):
                failed += 1
                continue
            base = os.path.basename(item.get("originalName") or item["storedName"])
            stem, ext = os.path.splitext(base)
            dest = os.path.join(folder, base)
            n = 2
            while os.path.exists(dest):
                dest = os.path.join(folder, f"{stem} ({n}){ext}")
                n += 1
            try:
                shutil.copy2(src, dest)
                done += 1
            except OSError:
                failed += 1
        return {"ok": True, "exported": done, "failed": failed, "folder": folder}

    def export_text_file(self, filename, text):
        """Writes a text file to the desktop — contacts exports, and
        anything else that's a document rather than a photo.

        Cam: "Have a way to export all contacts so i can export them
        into a text file and share."

        Same desktop-and-don't-clobber behaviour as export_photo above,
        so an export never silently overwrites last week's one. UTF-8
        explicitly rather than the platform default: a contact called
        Renée or an address with a — in it must survive the trip, and on
        Windows the default encoding would mangle both.

        newline="" leaves the text exactly as the app built it, so the
        CSV export keeps its own \r\n line endings instead of having
        them doubled on Windows.
        """
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.isdir(desktop):
            desktop = os.path.expanduser("~")
        base = os.path.basename(str(filename or "export.txt"))
        # a filename is built by the UI, but it still passes through
        # basename above and this filter before touching the disk —
        # a contact's name can end up in it, and names contain slashes
        # and colons more often than you'd think
        base = "".join(c for c in base if c not in '\\/:*?"<>|').strip()
        if not base:
            base = "export.txt"
        stem, ext = os.path.splitext(base)
        dest = os.path.join(desktop, base)
        n = 2
        while os.path.exists(dest):
            dest = os.path.join(desktop, f"{stem} ({n}){ext}")
            n += 1
        try:
            with open(dest, "w", encoding="utf-8", newline="") as fh:
                fh.write(str(text or ""))
            return {"ok": True, "path": dest}
        except OSError as e:
            return {"error": f"Couldn't write the file: {e}"}

    def read_taken_dates(self, stored_names):
        out = {}
        for name in (stored_names or []):
            path = os.path.join(photos_dir(), name)
            if os.path.isfile(path):
                out[name] = read_taken_date(path)
        return {"dates": out}

    def photo_details(self, stored_name):
        """Size on disk and pixel dimensions — the things a details
        panel should show and can't get from the json alone."""
        path = os.path.join(photos_dir(), stored_name)
        if not os.path.isfile(path):
            return {"error": "That photo is missing."}
        info = {"bytes": os.path.getsize(path)}
        try:
            from PIL import Image
            with Image.open(path) as img:
                info["width"], info["height"] = img.size
        except Exception:
            pass
        return info
