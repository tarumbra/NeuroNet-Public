"""NeuroNet's backend: Kitchen, Home and Money (from KinCrux) and merging libraries.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class KitchenApi:
    # ------------------------------------------- kitchen, home and money
    def kitchen_recipe_from_link(self, url):
        """Kitchen → Add Recipe → From a web link: a public recipe page's
        schema.org recipe as a draft to check and save (recipe_link.py)."""
        import recipe_link
        try:
            final, page = recipe_link.fetch(url)
            return {"recipe": recipe_link.extract(page, final)}
        except ValueError as e:
            return {"error": str(e)}

    #
    # Cam: "i now want the two apps merged together into one". These read the
    # files KinCrux always used, exactly where they are -- camily.json for
    # contacts and the calendar, cookery.json for the Kitchen, and the money
    # file for Money. Nothing moved for the merge, so the data cannot be
    # stranded by it, and the old app still opens the same files.
    #
    # Namespaced kc_* so they cannot collide with this app's own photo and
    # preference calls, which already own the plain names.

    def kc_available(self):
        return {"ok": kitchen_backend is not None}

    def kc_get_data(self):
        """One document: the family half joined to the Kitchen half, which is
        how cookery.js has always been handed its data."""
        if kitchen_backend is None:
            return {"error": "The Kitchen half of the app didn't load."}
        doc = kitchen_backend.normalize_data(
            kitchen_backend.crux_store.read_json(kitchen_backend.data_file(), {}))
        doc.update(kitchen_backend.read_cookery())
        return doc

    def kc_save_data(self, data):
        """Writes the two halves back to their own files, as KinCrux did:
        the Kitchen keys to cookery.json, the rest to camily.json."""
        if kitchen_backend is None:
            return {"error": "The Kitchen half of the app didn't load."}
        try:
            kitchen_backend.write_cookery(data)
            family = kitchen_backend.normalize_data(data)
            kitchen_backend.crux_store.atomic_write_json(
                kitchen_backend.data_file(), family)
            return {"ok": True}
        except Exception as e:
            return {"error": f"Couldn't save that: {e}"}

    def kc_get_money(self):
        if kitchen_backend is None:
            return {"error": "The Money half of the app didn't load."}
        return kitchen_backend.normalize_money(
            kitchen_backend.crux_store.read_json(kitchen_backend.money_file(), {}))

    def kc_save_money(self, data, expect_stamp=None):
        if kitchen_backend is None:
            return {"error": "The Money half of the app didn't load."}
        return kitchen_backend.crux_store.save_guarded(
            kitchen_backend.money_file(), data, expect_stamp=expect_stamp,
            normalise=kitchen_backend.normalize_money, what="your budget")

    def kc_money_stamp(self):
        if kitchen_backend is None:
            return ""
        return kitchen_backend.crux_store.stamp_of(kitchen_backend.money_file())

    # -------------------------------------------- merging the two libraries
    #
    # Cam chose "Combine both into one library" when the two apps merged.
    #
    # The rules this follows, in order of importance:
    #   1. KinCrux's library is never touched. Files are COPIED, its document
    #      is never written. If this goes wrong, everything is still there.
    #   2. A name clash never overwrites. Two different photos called
    #      IMG_1234.jpg both survive; the incomer becomes IMG_1234 (2).jpg.
    #   3. Running it twice does not duplicate. Each imported photo remembers
    #      where it came from, and an identical file already here is skipped.
    #   4. It can be asked what it WOULD do, and answer without writing.

    def photos_merge_preview(self):
        return self._photos_merge(dry_run=True)

    def photos_merge_run(self):
        return self._photos_merge(dry_run=False)

    def _photos_merge(self, dry_run=True):
        if kitchen_backend is None:
            return {"error": "KinCrux's half of the app didn't load."}
        import hashlib

        def digest(path):
            h = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 16), b""):
                    h.update(chunk)
            return h.hexdigest()

        try:
            their_doc = kitchen_backend.normalize_data(
                kitchen_backend.crux_store.read_json(kitchen_backend.data_file(), {}))
            their_dir = kitchen_backend.photos_dir()
        except Exception as e:
            return {"error": f"Couldn't read KinCrux's library: {e}"}

        ours = normalize_data(read_json(data_file(), {}))
        our_dir = photos_dir()

        # What is already here, by content and by where it came from.
        here_by_hash = {}
        for p in ours.get("photos", []):
            path = os.path.join(our_dir, str(p.get("storedName") or ""))
            if os.path.isfile(path):
                try:
                    here_by_hash[digest(path)] = p.get("storedName")
                except OSError:
                    pass
        already = {str(p.get("fromKinCrux")) for p in ours.get("photos", [])
                   if p.get("fromKinCrux")}

        # Albums and folders are matched BY NAME: Cam's "Holiday" in one app
        # and "Holiday" in the other are the same album to her.
        album_by_name = {str(a.get("name", "")).strip().lower(): a["id"]
                         for a in ours.get("albums", []) if a.get("id")}
        folder_by_name = {str(f.get("name", "")).strip().lower(): f["id"]
                          for f in ours.get("folders", []) if f.get("id")}
        their_albums = {a["id"]: a for a in their_doc.get("albums", []) if a.get("id")}
        their_folders = {f["id"]: f for f in their_doc.get("folders", []) if f.get("id")}

        report = {"copied": 0, "renamed": [], "skipped_same": 0, "skipped_done": 0,
                  "missing": [], "albums_made": [], "folders_made": [], "tags": 0,
                  "dry_run": dry_run}
        new_photos, new_albums, new_folders = [], [], []
        taken = {f.lower() for f in os.listdir(our_dir)} if os.path.isdir(our_dir) else set()

        def album_id_for(their_id):
            a = their_albums.get(their_id)
            if not a:
                return None
            key = str(a.get("name", "")).strip().lower()
            if key in album_by_name:
                return album_by_name[key]
            made = {"id": "kc-" + str(a.get("id")), "name": a.get("name") or "Album"}
            album_by_name[key] = made["id"]
            new_albums.append(made)
            report["albums_made"].append(made["name"])
            return made["id"]

        def folder_id_for(their_id):
            f = their_folders.get(their_id)
            if not f:
                return None
            key = str(f.get("name", "")).strip().lower()
            if key in folder_by_name:
                return folder_by_name[key]
            made = {"id": "kc-" + str(f.get("id")), "name": f.get("name") or "Folder",
                    "parentId": None}
            folder_by_name[key] = made["id"]
            new_folders.append(made)
            report["folders_made"].append(made["name"])
            return made["id"]

        for p in their_doc.get("photos", []):
            stored = str(p.get("storedName") or "")
            src = os.path.join(their_dir, stored)
            if not stored or not os.path.isfile(src):
                report["missing"].append(stored or "(unnamed)")
                continue
            if stored in already:
                report["skipped_done"] += 1
                continue
            try:
                h = digest(src)
            except OSError as e:
                report["missing"].append(f"{stored} ({e})")
                continue
            if h in here_by_hash:
                # The same picture is already here, whatever it is called.
                report["skipped_same"] += 1
                continue

            name = stored
            if name.lower() in taken:
                stem, ext = os.path.splitext(stored)
                n = 2
                while f"{stem} ({n}){ext}".lower() in taken:
                    n += 1
                name = f"{stem} ({n}){ext}"
                report["renamed"].append({"was": stored, "now": name})
            taken.add(name.lower())
            here_by_hash[h] = name

            record = {
                "id": "kc-" + str(p.get("id") or name),
                "storedName": name,
                "originalName": p.get("originalName") or stored,
                "caption": p.get("caption") or "",
                "notes": p.get("notes") or "",
                "tags": list(p.get("tags") or []),
                "rating": p.get("rating") or 0,
                "takenDate": p.get("takenDate") or "",
                "created": p.get("created") or _now_stamp(),
                "inFrame": False,
                "albumIds": [x for x in (album_id_for(a) for a in (p.get("albumIds") or [])) if x],
                "folderId": folder_id_for(p.get("folderId")) if p.get("folderId") else None,
                # Where it came from, so a second run knows not to bring it again.
                "fromKinCrux": stored,
            }
            new_photos.append((src, name, record))
            report["copied"] += 1

        their_tags = [t for t in (their_doc.get("photoTagList") or [])
                      if t not in (ours.get("photoTagList") or [])]
        report["tags"] = len(their_tags)

        if dry_run:
            report["would_add_photos"] = report["copied"]
            return report

        # Files first: a record pointing at a file that isn't there is worse
        # than a file with no record.
        done = []
        try:
            for src, name, _rec in new_photos:
                shutil.copy2(src, os.path.join(our_dir, name))
                done.append(name)
        except OSError as e:
            for name in done:                      # undo our own copies only
                try:
                    os.remove(os.path.join(our_dir, name))
                except OSError:
                    pass
            return {"error": f"Couldn't copy the photos: {e}. Nothing was changed."}

        ours.setdefault("photos", []).extend(rec for _s, _n, rec in new_photos)
        ours.setdefault("albums", []).extend(new_albums)
        ours.setdefault("folders", []).extend(new_folders)
        ours.setdefault("photoTagList", []).extend(their_tags)
        saved = self.photo_save_data(ours)
        if isinstance(saved, dict) and saved.get("error"):
            return {"error": saved["error"]}
        return report
