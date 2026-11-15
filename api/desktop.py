"""NeuroNet's backend: fleeting notes (and the Notes calls).

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class DesktopApi:
    # ------------------------------------------------------- fleeting notes
    #
    # Cam: "quick note, a little text widget where I can write a quick thought
    # and it gets saved under a new sub section in Notes called Fleeting ...
    # simply title fleeting note #. ... If I have 5 notes in fleeting then
    # delete number 1 the other notes then rename. The numbers act as a que."
    #
    # They are ORDINARY NOTES in a folder of the vault, not a separate store:
    # Cam reviews them, copies from them into a Vault note, and may well open
    # the vault in another editor. Nothing here is special except the naming.

    FLEETING_DIR = "Fleeting"

    def _fleeting_folder(self):
        # vault_dir is a module function, not a method on the Api object.
        return os.path.join(notes_backend.vault_dir(), self.FLEETING_DIR)

    def fleeting_list(self):
        """Every fleeting note, in queue order, newest number last."""
        folder = self._fleeting_folder()
        out = []
        try:
            names = os.listdir(folder)
        except OSError:
            return out
        for name in names:
            if not name.endswith(".md"):
                continue
            m = re.match(r"(?i)^fleeting note (\d+)\.md$", name)
            if not m:
                # A note Cam named himself and left in this folder is not part
                # of the queue: it is left alone and shown in Notes like any
                # other note, rather than listed here as number 0.
                continue
            path = os.path.join(folder, name)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
            except OSError:
                text = ""
            out.append({
                "n": int(m.group(1)),
                "name": name[:-3],
                "path": f"{self.FLEETING_DIR}/{name}",
                "text": text,
                "written": os.path.getmtime(path) if os.path.exists(path) else 0,
            })
        out.sort(key=lambda x: x["n"])
        return out

    def sticky_add(self, text):
        """A new sticky note on the desktop (2026-10-05), from the dashboard's
        Quick note. The desktop widgets keep their notes in
        ~/.config/omarchy/neuronet-sticky.json and watch it, so it appears there."""
        text = str(text or "").strip()
        if not text:
            return {"error": "Write something first."}
        path = os.path.join(os.path.expanduser("~"), ".config", "omarchy", "neuronet-sticky.json")
        try:
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError):
            doc = {}
        notes = [n for n in (doc.get("notes") or []) if isinstance(n, dict)]
        k = len(notes) % 8
        notes.append({"id": "s%x%03d" % (int(time.time() * 1000), len(notes)), "text": text[:5000],
                      "x": 520 + k * 26, "y": 300 + k * 26, "w": 260, "h": 220, "pinned": False,
                      "design": "", "ink": "", "textScale": 1})
        doc["notes"] = notes
        doc.setdefault("design", "theme")
        try:
            atomic_write_json(path, doc)
        except OSError as e:
            return {"error": "Couldn't make the sticky note: %s" % e}
        return {"ok": True, "count": len(notes)}

    def fleeting_add(self, text):
        """A new note at the end of the queue."""
        folder = self._fleeting_folder()
        try:
            os.makedirs(folder, exist_ok=True)
        except OSError as e:
            return {"error": f"Couldn't make the Fleeting folder: {e}"}
        used = {n["n"] for n in self.fleeting_list()}
        nxt = 1
        while nxt in used:
            nxt += 1
        name = f"Fleeting note {nxt}.md"
        try:
            with open(os.path.join(folder, name), "w", encoding="utf-8") as f:
                f.write(str(text or ""))
        except OSError as e:
            return {"error": f"Couldn't save that note: {e}"}
        return {"ok": True, "n": nxt, "path": f"{self.FLEETING_DIR}/{name}"}

    # (the desktop Drop zone's drop_route went with the desktop widgets, 3 Nov 2026)

    def fleeting_export_pdf(self):
        """Every Fleeting note in one PDF, saved where Cam chooses and then
        opened (fleeting_pdf.py). Cam: "export all the fleeting notes into a
        pdf. Then i can provide this to you"."""
        import fleeting_pdf
        import guidebook_pdf as gp
        import print_header as ph
        notes = self.fleeting_list()
        if not notes:
            return {"error": "There are no fleeting notes to export."}
        import webview
        if not self._window:
            return {"error": "The save dialog isn't available right now."}
        stem = "Fleeting notes %s" % datetime.date.today().isoformat()
        picked = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=stem + ".pdf")
        if not picked:
            return {"cancelled": True}
        path = picked if isinstance(picked, str) else picked[0]
        if not path.lower().endswith(".pdf"):
            path += ".pdf"
        try:
            header = ph.header_html("Fleeting notes", right_logo="notes.png", right_name="Scribe")
        except Exception:
            header = ""
        res = gp.html_to_pdf(fleeting_pdf.build_html(notes, header), path)
        if res.get("error"):
            return res
        self._count("export:fleeting-pdf")
        gp.open_file(path)
        return {"ok": True, "path": path, "notes": len(notes)}

    def fleeting_delete(self, n):
        """Remove one and close the gap, so the numbers stay a queue.

        The survivors are renamed in ASCENDING order, which needs no
        temporary names: a note at position i always has a number >= i, so
        the name it is moving to has either just been vacated by the note
        before it or was never taken. (An earlier version renamed through
        temporary names to be safe. It could not be shown to behave any
        differently, so it went -- complexity that cannot fail is still
        complexity that has to be read.)
        """
        folder = self._fleeting_folder()
        try:
            n = int(n)
        except (TypeError, ValueError):
            return {"error": "That isn't a note number."}
        notes = self.fleeting_list()
        target = next((x for x in notes if x["n"] == n), None)
        if not target:
            return {"error": "That note is already gone."}
        try:
            os.remove(os.path.join(folder, target["name"] + ".md"))
        except OSError as e:
            return {"error": f"Couldn't delete that note: {e}"}

        rest = sorted([x for x in self.fleeting_list()], key=lambda x: x["n"])
        moved = 0
        for i, note in enumerate(rest, start=1):
            if note["n"] == i:
                continue
            src = os.path.join(folder, note["name"] + ".md")
            dst = os.path.join(folder, f"Fleeting note {i}.md")
            if os.path.exists(dst):
                # Should be impossible given the order above; refusing beats
                # os.rename quietly writing one note over another.
                return {"error": f"Deleted it, but {os.path.basename(dst)} was "
                                 f"in the way, so the rest kept their numbers."}
            try:
                os.rename(src, dst)
                moved += 1
            except OSError as e:
                return {"error": f"Deleted it, but renumbering stopped: {e}"}
        return {"ok": True, "renumbered": moved}

    def notes_available(self):
        return {"ok": _notes is not None}

    def notes_ping(self):
        return _notes.ping()

    def notes_list_tree(self):
        return _notes.list_tree()

    # separate vaults (2026-10-12): like Money's cash books
    def notes_list_vaults(self):
        return _notes.list_vaults()

    def notes_switch_vault(self, vid):
        return _notes.switch_vault(vid)

    def notes_new_vault(self, name):
        return _notes.new_vault(name)

    def notes_rename_vault(self, vid, name):
        return _notes.rename_vault(vid, name)

    def notes_delete_vault(self, vid):
        return _notes.delete_vault(vid)

    def notes_vault_folders(self, vid):
        return _notes.vault_folders(vid)

    def notes_move_to_vault(self, path, vid, dest_folder=""):
        return _notes.move_to_vault(path, vid, dest_folder)

    def notes_read_all_notes(self, limit=1500):
        return _notes.read_all_notes(limit)

    def notes_read_note(self, path):
        return _notes.read_note(path)

    def notes_write_note(self, path, text):
        return _notes.write_note(path, text)

    def notes_create_note(self, parent_path, name):
        return _notes.create_note(parent_path, name)

    def notes_read_canvas(self, path):
        return _notes.read_canvas(path)

    def notes_write_canvas(self, path, json_text):
        return _notes.write_canvas(path, json_text)

    def notes_create_canvas(self, parent_path, name):
        return _notes.create_canvas(parent_path, name)

    def notes_create_folder(self, parent_path, name):
        return _notes.create_folder(parent_path, name)

    def notes_rename_item(self, path, new_name):
        return _notes.rename_item(path, new_name)

    def notes_move_item(self, path, new_parent_path):
        return _notes.move_item(path, new_parent_path)

    def notes_delete_item(self, path):
        return _notes.delete_item(path)

    def notes_duplicate_item(self, path):
        return _notes.duplicate_item(path)

    def notes_ship_list(self):
        return _notes.ship_list()

    def notes_set_ship(self, path, on):
        return _notes.set_ship(path, bool(on))

    # ticks and flags, the archive (2026-11-02)
    def notes_marks_list(self):
        return _notes.marks_list()

    def notes_set_mark(self, path, mark):
        return _notes.set_mark(path, str(mark or ""))

    def notes_archive_item(self, path):
        return _notes.archive_item(path)

    def notes_archive_list(self):
        return _notes.archive_list()

    def notes_archive_read(self, vid, path):
        return _notes.archive_read(vid, path)

    def notes_archive_restore(self, vid, path):
        return _notes.archive_restore(vid, path)

    def notes_archive_delete(self, vid, path):
        return _notes.archive_delete(vid, path)

    def notes_show_in_file_manager(self, path):
        return _notes.show_in_file_manager(path)

    def notes_open_in_default_app(self, path):
        return _notes.open_in_default_app(path)

    def notes_save_image(self, name, data_url):
        return _notes.save_image(name, data_url)

    def notes_image_url(self, name):
        return _notes.image_url(name)

    def notes_pdf_data(self, path):
        return _notes.pdf_data(path)

    def notes_pick_pdf(self):
        return _notes.pick_pdf()

    def notes_import_pdfs(self, paths, dest_folder_path=''):
        return _notes.import_pdfs(paths, dest_folder_path)

    def notes_list_attachments(self):
        return _notes.list_attachments()

    def notes_pick_image(self):
        return _notes.pick_image()

    def notes_attach_images(self, paths):
        return _notes.attach_images(paths)

    def notes_open_external(self, url):
        return _notes.open_external(url)

    def notes_get_prefs(self):
        return _notes.get_prefs()

    def notes_set_prefs(self, prefs):
        return _notes.set_prefs(prefs)

    def notes_pick_import(self):
        return _notes.pick_import()

    def notes_pick_import_folder(self):
        return _notes.pick_import_folder()

    def notes_import_files(self, paths, dest_folder_path=''):
        return _notes.import_files(paths, dest_folder_path)
