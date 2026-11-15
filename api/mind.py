"""NeuroNet's backend: puzzles, Divination's cards, the pet and the journal.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class MindApi:
    # -- cranium ------------------------------------------------------
    def cranium_get_data(self):
        return normalize_cranium(read_json(cranium_file(), {}))

    def cranium_save_data(self, data):
        try:
            atomic_write_json(cranium_file(), normalize_cranium(data))
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't save: {e}"}

    def cranium_get_prefs(self):
        prefs = read_json(cranium_prefs_file(), {})
        return prefs if isinstance(prefs, dict) else {}

    def cranium_set_prefs(self, prefs):
        try:
            current = self.cranium_get_prefs()
            current.update(prefs if isinstance(prefs, dict) else {})
            atomic_write_json(cranium_prefs_file(), current)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't save preferences: {e}"}

    # -- cards (Celestial) --------------------------------------------
    def cards_read_json(self, name):
        """Only ever celestial.json. The name argument is Celestial's
        own contract, kept so its store code did not have to change."""
        if name != "celestial.json":
            return None
        return read_json(cards_file(), {})

    def cards_write_json(self, name, data):
        if name != "celestial.json":
            return {"error": "Unknown file."}
        try:
            atomic_write_json(cards_file(), data)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't save: {e}"}

    def cards_image_url(self, name):
        base = os.path.basename(str(name or ""))
        if not base or base != name:
            return None
        path = os.path.join(cards_images_dir(), base)
        if not os.path.isfile(path):
            return None
        got = _encode_file(path)
        return got.get("dataUrl") if isinstance(got, dict) else None

    def cards_thumb_url(self, name, max_edge=400):
        base = os.path.basename(str(name or ""))
        if not base or base != name:
            return None
        src = os.path.join(cards_images_dir(), base)
        if not os.path.isfile(src):
            return None
        stem, ext = os.path.splitext(base)
        dest = os.path.join(cards_thumbs_dir(), stem + ".thumb.jpg")
        try:
            if (not os.path.isfile(dest)
                    or os.path.getmtime(dest) < os.path.getmtime(src)):
                _make_thumbnail(src, dest)
        except Exception:
            dest = src              # Pillow missing: full size beats nothing
        got = _picture("cards-thumbs" if dest != src else "cards-images", dest)
        return got.get("dataUrl") if isinstance(got, dict) else None

    def cards_export_guidebook_pdf(self, kind, deck_id, card_ids=None, cover=True):
        """A deck's guidebook -- every card, or `card_ids` -- saved as a PDF
        where Cam chooses, then opened so it can be printed from there.

        Cam: "Printing guidebook from a tarot deck gets stuck on preparing,
        change to export to PDF then i can just print that PDF." The page is
        built and rendered here (guidebook_pdf.py) from the files on disk;
        only the deck's id and the chosen cards come across the bridge."""
        import guidebook_pdf as gp
        if kind not in gp.KIND_LABEL:
            return {"error": "Unknown kind of deck."}
        doc = read_json(cards_file(), {})
        deck = next((d for d in doc.get(kind + "Decks") or []
                     if isinstance(d, dict) and d.get("id") == deck_id), None)
        if not deck:
            return {"error": "That deck isn't there any more."}
        wanted = set(card_ids or [])
        cards = [c for c in deck.get("cards") or []
                 if not wanted or c.get("id") in wanted]
        if not cards:
            return {"error": "No cards chosen."}

        import webview
        if not self._window:
            return {"error": "The save dialog isn't available right now."}
        stem = _safe_file_stem("%s guidebook" % (deck.get("name") or "Deck")) or "Guidebook"
        if len(cards) == 1:
            stem = _safe_file_stem("%s - %s" % (deck.get("name"), cards[0].get("name"))) or stem
        picked = self._window.create_file_dialog(webview.SAVE_DIALOG,
                                                 save_filename=stem + ".pdf")
        if not picked:
            return {"cancelled": True}
        path = picked if isinstance(picked, str) else picked[0]
        if not path.lower().endswith(".pdf"):
            path += ".pdf"

        html_text = gp.build_html(deck, cards, kind, cover=bool(cover),
                                  image_path=card_print_path)
        res = gp.html_to_pdf(html_text, path)
        if res.get("error"):
            return res
        self._count("export:guidebook-pdf")
        gp.open_file(path)
        return {"ok": True, "path": path, "pages": len(cards) + (2 if cover and len(cards) > 1 else 0)}

    # -- Pixel Pet -------------------------------------------------------
    # (NeuroPets' pet_load / pet_save moved to neuropets.py on 2026-10-03: the game is
    # its own app now, and the only thing that saves the pet. pet.py still finds its
    # folder through this file's data_dir -- see pet.DATA_DIR_PROVIDER below.)

    # -- journal (Mindfulness -> Journal) --------------------------------
    # Cam: "a place i can write anything ... with the ability to add
    # photos", Divination's pulls saved there "with the card images", and
    # "fully migrate the journal to live in mindfullness, change the name
    # from thought journal to just be journal". The store is journal.py.
    def journal_list(self):
        """Every entry, newest first. Divination's old readings and the old
        Thought Journal are brought in the first time this is asked."""
        try:
            celestial = read_json(cards_file(), {})
            moved = journal.migrate_readings(celestial, cards_images_dir())
            if moved:
                _log_line("moved %d Divination readings into the journal" % moved)
            thoughts = journal.migrate_thoughts(celestial)
            if thoughts:
                _log_line("moved %d Thought Journal entries into the journal" % thoughts)
        except Exception as e:
            _log_line("journal: couldn't bring in the old entries: %s" % e)
        return journal.list_entries()

    def journal_save(self, entry):
        try:
            return journal.save_entry(entry)
        except OSError as e:
            return {"error": f"Couldn't save the entry: {e}"}

    def journal_delete(self, entry_id):
        try:
            return journal.delete_entry(entry_id)
        except OSError as e:
            return {"error": f"Couldn't delete the entry: {e}"}

    def journal_add_reading(self, reading, text="", title=""):
        """A Divination pull (a spread, or the dashboard's one card) as a
        journal entry, with copies of its card faces."""
        try:
            return journal.add_reading(reading, text, title, cards_images_dir())
        except OSError as e:
            return {"error": f"Couldn't save the reading: {e}"}

    def journal_image_url(self, name, thumb=False, as_data=False):
        """For the page: an address on the local server (2026-10-06). A
        printout asks for the data (as_data), so the page it makes stands on
        its own."""
        if as_data:
            return journal.image_url(name, bool(thumb))
        path = journal.image_path(name, bool(thumb))
        if not path:
            return None
        return _picture("journal-thumbs" if os.path.dirname(path) == journal.thumbs_dir() else "journal-images",
                        path).get("dataUrl")

    def journal_add_library_photo(self, stored_name):
        """A photo from the Photos library, copied into the journal."""
        src = os.path.join(photos_dir(), os.path.basename(str(stored_name or "")))
        if not os.path.isfile(src):
            return {"error": "That photo isn't in the library any more."}
        name = journal.copy_image(src, os.path.splitext(os.path.basename(src))[0])
        return {"name": name} if name else {"error": "Couldn't copy that photo."}

    def journal_pick_photos(self):
        """Photos from the computer, copied into the journal."""
        import webview
        if not self._window:
            return {"error": "The file dialog isn't available right now."}
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("Images (*.jpg;*.jpeg;*.png;*.gif;*.webp;*.bmp)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, str):
            picked = [picked]
        names, skipped = [], []
        for path in picked:
            name = journal.copy_image(path, os.path.splitext(os.path.basename(path))[0])
            (names if name else skipped).append(name or os.path.basename(path))
        return {"names": names, "skipped": skipped}

    def cards_assign_photo(self, stored_name, target_name):
        """Copies a LIBRARY photo into the cards folder under a name of
        the card's own.

        A copy, not a move and not a reference. The library photo stays
        exactly where it is: it may be in an album, on another card, or
        simply a photo Cam wants to keep. Deleting a deck must never
        reach back into the photo library and remove the original.
        """
        src = os.path.join(photos_dir(), os.path.basename(str(stored_name or "")))
        if not os.path.isfile(src):
            return {"error": "That photo isn't in the library any more."}
        stem = _safe_file_stem(target_name) or "card"
        ext = os.path.splitext(src)[1] or ".jpg"
        final, n = stem + ext, 2
        while os.path.exists(os.path.join(cards_images_dir(), final)):
            final = "%s-%d%s" % (stem, n, ext)
            n += 1
        try:
            shutil.copy2(src, os.path.join(cards_images_dir(), final))
        except OSError as e:
            return {"error": f"Couldn't copy that photo: {e}"}
        return {"name": final}
