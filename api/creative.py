"""NeuroNet's backend: boards, scrapbooks, Paper and assets, pixel art, Cells and books.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class CreativeApi:
    # -- notes --------------------------------------------------------
    # Copied from KinCrux's block, which is generated from NotesApi's real
    # signatures rather than hand-typed, so the two cannot drift. Every
    # name carries "notes": Amnesia's get_prefs, set_prefs and ping would
    # collide with NeuroNet's own and mean different files.
    # ------------------------------------------------------------ boards
    #
    # Cam: "i want to add a boards feature, that mimics the one from the old
    # Cam's Collective app ... The boards feature will be a seperate sub
    # section under the notes main section."
    #
    # A board is one JSON file in neuronet_data/notes/boards/ -- beside the
    # vault, not inside it, so a folder of drawing data does not clutter the
    # vault when Cam opens it in Obsidian. One file per board keeps a board's
    # history independent: a broken write can only ever cost that board.

    def boards_list(self):
        """Every board, newest first, with just enough to draw the list."""
        out = []
        folder = boards_dir()
        try:
            names = os.listdir(folder)
        except OSError:
            return out
        for name in names:
            if not name.endswith(".json"):
                continue
            path = os.path.join(folder, name)
            try:
                with open(path, encoding="utf-8") as f:
                    board = json.load(f)
            except (OSError, ValueError):
                # A board that cannot be read is still LISTED, so it can be
                # seen and dealt with rather than quietly disappearing.
                out.append({"id": name[:-5], "name": name[:-5],
                            "error": "This board could not be read.",
                            "updated": ""})
                continue
            pages = board.get("pages") or [{}]
            out.append({
                "id": name[:-5],
                "name": board.get("name") or "Untitled board",
                "w": board.get("w") or 1600, "h": board.get("h") or 1000,
                "items": sum(len(p.get("items") or []) for p in pages),
                "pages": len(pages),
                "updated": board.get("updated") or "",
                "published": bool(board.get("published")),
            })
        out.sort(key=lambda b: b.get("updated") or "", reverse=True)
        return out

    def boards_read(self, board_id):
        path = _board_path(board_id)
        if not path:
            return {"error": "That board name isn't allowed."}
        try:
            with open(path, encoding="utf-8") as f:
                return {"board": json.load(f)}
        except FileNotFoundError:
            return {"error": "That board is gone."}
        except (OSError, ValueError) as e:
            # Never replace what could not be read.
            return {"error": f"This board could not be read: {e}"}

    def boards_write(self, board_id, board):
        path = _board_path(board_id)
        if not path:
            return {"error": "That board name isn't allowed."}
        if not isinstance(board, dict):
            return {"error": "That is not a board."}
        board["updated"] = _now_stamp()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            # Written beside, then moved into place: a board is never left
            # half-written if the app stops mid-save.
            tmp = path + ".part"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(board, f, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            return {"ok": True, "updated": board["updated"]}
        except OSError as e:
            return {"error": f"Couldn't save that board: {e}"}

    def boards_delete(self, board_id):
        path = _board_path(board_id)
        if not path:
            return {"error": "That board name isn't allowed."}
        try:
            os.remove(path)
            return {"ok": True}
        except FileNotFoundError:
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't delete that board: {e}"}

    # --------------------------------------------------------- scrapbooks
    #
    # Cam (2026-10-02): "Scrapbook, which should have the same toolbar as
    # boards, but also contain a collapseable scrapbook materials ... The
    # paper will be selectable from different colours and will allow each
    # page to have a different type of paper ... it will have a cover".
    #
    # A scrapbook is a board with a cover and a paper per page, so it is
    # kept exactly the way a board is: one JSON file each, in
    # neuronet_data/notes/scrapbooks/, written beside and moved into place.
    # The sticker book is scrapbooks/stickers/: <id>.png plus stickers.json.

    def scrapbooks_list(self):
        """Every scrapbook, newest first, with its cover for the shelf."""
        out = []
        folder = scrapbooks_dir()
        try:
            names = os.listdir(folder)
        except OSError:
            return out
        for name in names:
            if not name.endswith(".json"):
                continue
            try:
                with open(os.path.join(folder, name), encoding="utf-8") as f:
                    book = json.load(f)
                if not isinstance(book, dict):
                    raise ValueError("not a scrapbook")
            except (OSError, ValueError):
                # listed, so it can be seen -- never quietly dropped
                out.append({"id": name[:-5], "name": name[:-5],
                            "error": "This scrapbook could not be read.", "updated": ""})
                continue
            pages = book.get("pages") or [{}]
            out.append({
                "id": name[:-5],
                "name": book.get("name") or "Scrapbook",
                "w": book.get("w") or 1500, "h": book.get("h") or 1500,
                "pages": len(pages),
                "items": sum(len(p.get("items") or []) for p in pages),
                "cover": book.get("cover") or {},
                "updated": book.get("updated") or "",
            })
        out.sort(key=lambda b: b.get("updated") or "", reverse=True)
        return out

    def scrapbooks_read(self, book_id):
        path = _scrapbook_path(book_id)
        if not path:
            return {"error": "That scrapbook name isn't allowed."}
        try:
            with open(path, encoding="utf-8") as f:
                return {"book": json.load(f)}
        except FileNotFoundError:
            return {"error": "That scrapbook is gone."}
        except (OSError, ValueError) as e:
            return {"error": f"This scrapbook could not be read: {e}"}

    def scrapbooks_write(self, book_id, book):
        path = _scrapbook_path(book_id)
        if not path:
            return {"error": "That scrapbook name isn't allowed."}
        if not isinstance(book, dict):
            return {"error": "That is not a scrapbook."}
        book["updated"] = _now_stamp()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tmp = path + ".part"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(book, f, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            return {"ok": True, "updated": book["updated"]}
        except OSError as e:
            return {"error": f"Couldn't save that scrapbook: {e}"}

    def scrapbooks_delete(self, book_id):
        path = _scrapbook_path(book_id)
        if not path:
            return {"error": "That scrapbook name isn't allowed."}
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except OSError as e:
            return {"error": f"Couldn't delete that scrapbook: {e}"}
        return {"ok": True}

    def _stickers_dir(self):
        d = os.path.join(scrapbooks_dir(), "stickers")
        os.makedirs(d, exist_ok=True)
        return d

    def _stickers_index(self):
        try:
            with open(os.path.join(self._stickers_dir(), "stickers.json"), encoding="utf-8") as f:
                doc = json.load(f)
            return [s for s in doc.get("stickers", []) if isinstance(s, dict) and s.get("id")]
        except (OSError, ValueError, AttributeError):
            return []

    def scrapbook_stickers(self):
        """The sticker book: every sticker made from a photo, newest first,
        each as a data URL ready to put on a page."""
        import base64
        out = []
        for s in self._stickers_index():
            path = os.path.join(self._stickers_dir(), s["id"] + ".png")
            try:
                with open(path, "rb") as f:
                    data = f.read()
            except OSError:
                continue                       # a file gone: not offered
            w, h = _png_size(data)
            out.append({"id": s["id"], "name": s.get("name") or "Sticker", "made": s.get("made", ""),
                        "w": w, "h": h,
                        "dataUrl": "data:image/png;base64," + base64.b64encode(data).decode("ascii")})
        return {"stickers": out}

    def scrapbook_sticker_add(self, name, data_url):
        """A sticker (a PNG data URL, from the sticker maker) into the book."""
        import base64
        m = re.match(r"^data:image/png;base64,(.+)$", str(data_url or ""), re.S)
        if not m:
            return {"error": "A sticker has to be a PNG picture."}
        try:
            data = base64.b64decode(m.group(1), validate=True)
        except ValueError:
            return {"error": "That sticker's picture is damaged."}
        if _png_size(data) == (0, 0):
            return {"error": "That sticker's picture is damaged."}
        if len(data) > 8 * 1024 * 1024:
            return {"error": "That sticker is too big (8 MB at most)."}
        sid = "s" + uuid.uuid4().hex[:10]
        folder = self._stickers_dir()
        try:
            tmp = os.path.join(folder, sid + ".png.part")
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, os.path.join(folder, sid + ".png"))
            index = [{"id": sid, "name": str(name or "Sticker").strip()[:80] or "Sticker",
                      "made": _now_stamp()}] + self._stickers_index()
            atomic_write_json(os.path.join(folder, "stickers.json"), {"stickers": index})
        except OSError as e:
            return {"error": f"Couldn't save the sticker: {e}"}
        return {"ok": True, "id": sid}

    def scrapbook_sticker_delete(self, sticker_id):
        """Out of the sticker book. Stickers already on pages are copies and stay."""
        sid = str(sticker_id or "")
        if not re.fullmatch(r"s[0-9a-f]{10}", sid):
            return {"error": "That isn't a sticker."}
        folder = self._stickers_dir()
        index = [s for s in self._stickers_index() if s["id"] != sid]
        try:
            atomic_write_json(os.path.join(folder, "stickers.json"), {"stickers": index})
            os.remove(os.path.join(folder, sid + ".png"))
        except FileNotFoundError:
            pass
        except OSError as e:
            return {"error": f"Couldn't remove the sticker: {e}"}
        return {"ok": True}

    # ------------------------------------------------ paper creator + assets
    #
    # Cam (2026-10-03): "create me a paper creator. This is a simple tool
    # which will print my selected paper at my selected size. Also it will
    # have a cover creator ... A5 - A4 or custom size (i create pocket
    # notebooks)" and "a new feature called assets ... upload new assets into
    # their respective categories or create them". The rules are in
    # paper_assets.py; these are the doors to it.

    def paper_designs(self):
        import paper_assets
        return paper_assets.read_designs(os.path.join(notes_dir(), "paper", "designs.json"))

    def paper_designs_save(self, designs):
        import paper_assets
        return paper_assets.write_designs(os.path.join(notes_dir(), "paper", "designs.json"), designs)

    def covers_list(self):
        import paper_assets
        return paper_assets.list_covers(covers_dir())

    def covers_read(self, cover_id):
        path = _doc_path(covers_dir(), cover_id)
        if not path:
            return {"error": "That cover name isn't allowed."}
        try:
            with open(path, encoding="utf-8") as f:
                return {"book": json.load(f)}
        except FileNotFoundError:
            return {"error": "That cover is gone."}
        except (OSError, ValueError) as e:
            return {"error": f"This cover could not be read: {e}"}

    def covers_write(self, cover_id, book):
        path = _doc_path(covers_dir(), cover_id)
        if not path:
            return {"error": "That cover name isn't allowed."}
        if not isinstance(book, dict):
            return {"error": "That is not a cover."}
        book["updated"] = _now_stamp()
        try:
            atomic_write_json(path, book)
            return {"ok": True, "updated": book["updated"]}
        except OSError as e:
            return {"error": f"Couldn't save that cover: {e}"}

    def covers_delete(self, cover_id):
        path = _doc_path(covers_dir(), cover_id)
        if not path:
            return {"error": "That cover name isn't allowed."}
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except OSError as e:
            return {"error": f"Couldn't delete that cover: {e}"}
        return {"ok": True}

    def _assets(self):
        import paper_assets
        return paper_assets.Assets(assets_dir())

    def assets_list(self):
        return self._assets().list()

    def asset_data(self, asset_id):
        return self._assets().data(asset_id)

    def asset_thumb_url(self, asset_id):
        """A tile's picture by address (or, for an SVG, its data as before)."""
        path = self._assets().thumb_path(asset_id)
        if path:
            got = _picture("asset-thumbs", path)
            if got and got.get("dataUrl"):
                return {"dataUrl": got["dataUrl"]}
        return None

    def asset_add(self, cat, name, data_url, design=None, size=None, stage="done"):
        return self._assets().add(cat, name, data_url, design, size, stage)

    # ------------------------------------------------------------- pixel art
    # Cam (2026-10-04): "Create a pixel art creator in the creative section
    # ... colour palettes (default and ability to create or import palettes.
    # Also the ability to export to asesprite or png". The page writes the
    # files (ui/pixel/pixelcore.js); these keep palettes and save files.

    def pixel_palettes(self):
        import paper_assets
        return paper_assets.read_palettes(os.path.join(assets_dir(), "palettes.json"))

    def pixel_palettes_save(self, palettes):
        import paper_assets
        return paper_assets.write_palettes(os.path.join(assets_dir(), "palettes.json"), palettes)

    def pixel_save_file(self, filename, b64):
        """Export from Pixel art (and Vector): Cam chooses where."""
        return self.creative_save_file(filename, b64)

    def vector_open_svg(self):
        """Vector's Import SVG: the file's text (Inkscape's own files too)."""
        import webview
        if not self._window:
            return {"error": "No window to open a file dialog in."}
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=("SVG drawings (*.svg)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        path = picked[0] if isinstance(picked, (list, tuple)) else picked
        try:
            if os.path.getsize(path) > 30 * 1024 * 1024:
                return {"error": "That SVG is too big (30 MB at most)."}
            with open(path, encoding="utf-8", errors="replace") as f:
                return {"name": os.path.splitext(os.path.basename(path))[0], "text": f.read()}
        except OSError as e:
            return {"error": "Couldn't read that file: %s" % e}

    def creative_save_file(self, filename, b64):
        """Export: Cam chooses where; the page made the bytes."""
        import paper_assets
        import webview
        if not self._window:
            return {"error": "No window to open a save dialog in."}
        name = os.path.basename(str(filename or "sprite.png")) or "sprite.png"
        picked = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=name)
        if not picked:
            return {"cancelled": True}
        path = picked[0] if isinstance(picked, (list, tuple)) else picked
        return paper_assets.write_b64_file(path, b64)

    def pixel_open_palette_file(self):
        """Import a palette: the file's text (or a picture's data URL)."""
        import webview
        if not self._window:
            return {"error": "No window to open a file dialog in."}
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False,
            file_types=("Palettes (*.gpl;*.hex;*.pal;*.txt;*.png;*.gif;*.jpg)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        path = picked[0] if isinstance(picked, (list, tuple)) else picked
        try:
            if os.path.getsize(path) > 8 * 1024 * 1024:
                return {"error": "That file is too big for a palette."}
            ext = os.path.splitext(path)[1].lower()
            name = os.path.splitext(os.path.basename(path))[0]
            if ext in (".png", ".gif", ".jpg", ".jpeg"):
                import base64
                kind = {".png": "png", ".gif": "gif"}.get(ext, "jpeg")
                with open(path, "rb") as f:
                    return {"name": name, "image": "data:image/%s;base64,%s" % (kind, base64.b64encode(f.read()).decode())}
            with open(path, encoding="utf-8", errors="replace") as f:
                return {"name": name, "text": f.read()}
        except OSError as e:
            return {"error": "Couldn't read that file: %s" % e}

    def asset_update(self, asset_id, changes):
        return self._assets().update(asset_id, changes)

    def asset_design(self, asset_id):
        return self._assets().design(asset_id)

    def asset_delete(self, asset_id):
        return self._assets().delete(asset_id)

    def assets_import_files(self, cat):
        """Cam: "At a later date i will purchase some digitally" -- a whole
        pack at once: choose any number of picture files, each is copied in."""
        import paper_assets
        if cat not in paper_assets.CATEGORY_KEYS:
            return {"error": "That isn't one of the asset categories."}
        import webview
        if not self._window:
            return {"error": "No window to open a file dialog in."}
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("Pictures (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.svg)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        return self._assets().add_files(cat, list(picked))

    # ------------------------------------------------------------- cells
    #
    # Cam: "I want to add another sub section in Notes called Cells. This will
    # be the grid based system found in the vault on the tool bar. However it
    # will be a complete standalone notes page with tool bar that has
    # excell/librecalc style features."
    #
    # The SAME grid: a sheet holds exactly the model a ```grid block holds, so
    # the formulas, formats, sorting and charts are the ones already built and
    # tested -- not a second spreadsheet that drifts from the first. A sheet
    # is simply that model in a file of its own, beside the boards.

    def cells_list(self):
        out = []
        try:
            names = os.listdir(cells_dir())
        except OSError:
            return out
        for name in names:
            if not name.endswith(".json"):
                continue
            try:
                with open(os.path.join(cells_dir(), name), encoding="utf-8") as f:
                    sheet = json.load(f)
            except (OSError, ValueError):
                out.append({"id": name[:-5], "name": name[:-5],
                            "error": "This sheet could not be read.", "updated": ""})
                continue
            grid = sheet.get("grid") or {}
            rows = grid.get("rows") or []
            out.append({
                "id": name[:-5],
                "name": sheet.get("name") or name[:-5],
                "rows": len(rows),
                "cols": max([len(r) for r in rows] or [0]),
                "filled": sum(1 for r in rows for c in r if str(c or "").strip()),
                "updated": sheet.get("updated") or "",
            })
        out.sort(key=lambda x: x.get("updated") or "", reverse=True)
        return out

    def cells_read(self, sheet_id):
        path = _cells_path(sheet_id)
        if not path:
            return {"error": "That sheet name isn't allowed."}
        try:
            with open(path, encoding="utf-8") as f:
                return {"sheet": json.load(f)}
        except FileNotFoundError:
            return {"error": "That sheet is gone."}
        except (OSError, ValueError) as e:
            return {"error": f"This sheet could not be read: {e}"}

    def cells_write(self, sheet_id, sheet):
        path = _cells_path(sheet_id)
        if not path:
            return {"error": "That sheet name isn't allowed."}
        if not isinstance(sheet, dict):
            return {"error": "That is not a sheet."}
        sheet["updated"] = _now_stamp()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tmp = path + ".part"          # written beside, then moved in
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(sheet, f, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            return {"ok": True, "updated": sheet["updated"]}
        except OSError as e:
            return {"error": f"Couldn't save that sheet: {e}"}

    def cells_delete(self, sheet_id):
        path = _cells_path(sheet_id)
        if not path:
            return {"error": "That sheet name isn't allowed."}
        try:
            os.remove(path)
            return {"ok": True}
        except FileNotFoundError:
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't delete that sheet: {e}"}

    # ------------------------------------------------------------------
    # BOOKS -- Cam: "a book feature for the Notes subsection where I can
    # add any type of note from a subsection to it and then export or
    # print. The feature is already present in Training."
    #
    # Stored exactly like a board or a sheet: one JSON file per book, in
    # the vault's own folder, written beside and moved into place so a
    # book is never left half-saved.
    #
    # A book holds REFERENCES, never copies. Edit a note and every book
    # containing it prints the new version -- which is what a manual you
    # reprint each term wants, and is the same trade Training's books
    # make. The cost is that a reference can go stale, so a book says so
    # rather than quietly printing something else.
    # ------------------------------------------------------------------
    def notebooks_list(self):
        """Every book, newest first, with just enough to draw the list."""
        out = []
        try:
            names = os.listdir(notebooks_dir())
        except OSError:
            return out
        for name in names:
            if not name.endswith(".json"):
                continue
            try:
                with open(os.path.join(notebooks_dir(), name), encoding="utf-8") as f:
                    book = json.load(f)
            except (OSError, ValueError):
                # Never replaced with a blank one, and never hidden either.
                out.append({"id": name[:-5], "name": name[:-5],
                            "error": "This book could not be read.", "updated": ""})
                continue
            out.append({
                "id": name[:-5],
                "name": book.get("name") or name[:-5],
                "subtitle": book.get("subtitle") or "",
                "count": len(book.get("entries") or []),
                "updated": book.get("updated") or "",
            })
        out.sort(key=lambda x: x.get("updated") or "", reverse=True)
        return out

    def notebooks_read(self, book_id):
        path = _notebook_path(book_id)
        if not path:
            return {"error": "That book name isn't allowed."}
        try:
            with open(path, encoding="utf-8") as f:
                return {"book": json.load(f)}
        except FileNotFoundError:
            return {"error": "That book is gone."}
        except (OSError, ValueError) as e:
            return {"error": f"This book could not be read: {e}"}

    def notebooks_write(self, book_id, book):
        path = _notebook_path(book_id)
        if not path:
            return {"error": "That book name isn't allowed."}
        if not isinstance(book, dict):
            return {"error": "That is not a book."}
        book["updated"] = _now_stamp()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tmp = path + ".part"          # written beside, then moved in
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(book, f, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            return {"ok": True, "updated": book["updated"]}
        except OSError as e:
            return {"error": f"Couldn't save that book: {e}"}

    def notebooks_delete(self, book_id):
        path = _notebook_path(book_id)
        if not path:
            return {"error": "That book name isn't allowed."}
        try:
            os.remove(path)
            return {"ok": True}
        except FileNotFoundError:
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't delete that book: {e}"}
