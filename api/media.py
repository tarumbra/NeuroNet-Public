"""NeuroNet's backend: the Shelf, ebooks, the Code IDE and Stuff.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class MediaApi:
    # -- The Shelf (Stuff → Shelf) ---------------------------------------------
    # Covers and the films behind Media items: see media_shelf.py.
    def media_films(self):
        """Every film in NeuroNet's Movies folder, and where that folder is."""
        import media_shelf as ms
        root = ms.movies_dir(app_dir())
        return {"folder": root, "films": ms.list_films(root), "players": ms.players()}

    def media_play(self, rel):
        import media_shelf as ms
        root = ms.movies_dir(app_dir(), create=False)
        path = ms.film_path(root, rel)
        if not path:
            return {"error": "That film isn't in the Movies folder any more."}
        return ms.play(path)

    def media_open_movies_folder(self):
        import media_shelf as ms
        root = ms.movies_dir(app_dir())
        opener = "xdg-open" if sys.platform.startswith("linux") else "open"
        try:
            if os.name == "nt":
                os.startfile(root)
            else:
                subprocess.Popen([opener, root], start_new_session=True,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True, "folder": root}
        except OSError as e:
            return {"error": "Couldn't open %s (%s)." % (root, e)}

    # -- Cinema (M&T → Cinema) ---------------------------------------------------
    # Shows by season, films, continue watching, watched marks, playlists, from
    # the same Movies folder the shelf plays: see cinema.py (14 Nov 2026, V30).
    def cinema_library(self):
        import cinema
        import media_shelf as ms
        root = ms.movies_dir(app_dir())
        films = ms.list_films(root)
        lib = cinema.library(films)
        # Media items linked to a video anywhere on the computer are films too
        try:
            items = (self.effects_load() or {}).get("items") or []
        except Exception:                                  # noqa: BLE001
            items = []
        linked = cinema.linked_films(data_dir(), items)
        lib["films"] = sorted(lib["films"] + linked, key=lambda f: (ms.norm(f["title"]), f["year"]))
        films = films + linked
        st = cinema.load(data_dir())
        return {"folder": root, "shows": lib["shows"], "films": lib["films"],
                "watched": st["watched"], "playlists": st["playlists"],
                "progress": cinema.progress(data_dir(), root, films),
                "players": ms.players(), "watchedAt": cinema.WATCHED_AT}

    def cinema_play(self, rels):
        import cinema
        import media_shelf as ms
        root = ms.movies_dir(app_dir(), create=False)
        rels = rels if isinstance(rels, list) else [rels]
        paths = [cinema.resolve(data_dir(), root, r) for r in rels[:200]]
        if not paths or not all(paths):
            return {"error": "That isn't in the Movies folder any more."}
        return cinema.play(data_dir(), paths)

    def cinema_mark(self, rel, watched):
        import cinema
        import media_shelf as ms
        if not cinema.resolve(data_dir(), ms.movies_dir(app_dir(), create=False), rel):
            return {"error": "That video isn't there any more."}
        st = cinema.mark(data_dir(), rel, bool(watched),
                         datetime.datetime.now().isoformat(timespec="seconds"))
        return {"ok": True, "watched": st["watched"]}

    # -- the in-app player (14 Nov 2026): the film converted live, see cinema.py
    def _cinema_film(self, rel):
        import cinema
        import media_shelf as ms
        return cinema.resolve(data_dir(), ms.movies_dir(app_dir(), create=False), rel)

    # -- linked videos: a Media item's own video, wherever it is (14 Nov 2026)
    def media_link_video(self, item_id):
        """Cam: "a play button that is a link to the videos location on the
        computer". The system's file picker chooses it; only this writes links."""
        import cinema
        import webview
        if self._window is None:
            return {"error": "Not available."}
        picked = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=(
            "Videos (*.mp4;*.mkv;*.avi;*.m4v;*.mov;*.webm;*.mpg;*.mpeg;*.wmv;*.ts;*.m2ts;*.vob)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        try:
            path = cinema.link(data_dir(), item_id, picked[0] if isinstance(picked, (list, tuple)) else picked)
        except ValueError as e:
            return {"error": str(e)}
        return {"ok": True, "name": os.path.basename(path), "folder": os.path.dirname(path)}

    def media_unlink_video(self, item_id):
        import cinema
        try:
            cinema.unlink(data_dir(), item_id)
        except ValueError as e:
            return {"error": str(e)}
        return {"ok": True}

    def media_links(self):
        """{item id: {name, folder, ok}} for every linked video (ok: still there)."""
        import cinema
        return {k: {"name": os.path.basename(v), "folder": os.path.dirname(v), "ok": cinema.is_video(v)}
                for k, v in cinema.load_links(data_dir()).items()}

    def cinema_open(self, rel):
        """What the page's player needs: the stream, the length, the captions,
        and where Cam stopped (the newer of this player and mpv)."""
        import cinema
        path = self._cinema_film(rel)
        if not path:
            return {"error": "That isn't in the Movies folder any more."}
        if not shutil.which("ffmpeg"):
            return {"error": "Playing inside NeuroNet needs ffmpeg. (mpv still plays it.)"}
        url = cinema_stream_url(rel)
        if not url:
            return {"error": "NeuroNet's media server couldn't start."}
        subs = [{"id": s["id"], "label": s["label"]} for s in cinema.subtitles(data_dir(), path, rel)]
        return {"stream": url, "duration": cinema.duration(path), "subtitles": subs,
                "resume": cinema.position(data_dir(), path, rel), "gpu": cinema.gpu_ok()}

    def cinema_subtitle(self, rel, sid):
        import cinema
        path = self._cinema_film(rel)
        return {"vtt": cinema.subtitle_vtt(data_dir(), path, rel, sid)} if path else {"error": "Not found."}

    def cinema_subtitle_upload(self, rel):
        """Cam: "the ability to upload subtitles for the movie"."""
        import cinema
        import webview
        path = self._cinema_film(rel)
        if not path or self._window is None:
            return {"error": "Not available."}
        picked = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False,
                                                 file_types=("Subtitles (*.srt;*.vtt;*.ass;*.ssa)",))
        if not picked:
            return {"cancelled": True}
        try:
            name = cinema.add_subtitle(data_dir(), rel, picked[0] if isinstance(picked, (list, tuple)) else picked)
        except ValueError as e:
            return {"error": str(e)}
        subs = [{"id": s["id"], "label": s["label"]} for s in cinema.subtitles(data_dir(), path, rel)]
        return {"ok": True, "name": name, "subtitles": subs}

    def cinema_position(self, rel, at):
        import cinema
        if not self._cinema_film(rel):
            return {"error": "Not found."}
        cinema.save_position(data_dir(), rel, at, datetime.datetime.now().isoformat(timespec="seconds"))
        return {"ok": True}

    def cinema_stop(self):
        import cinema
        cinema.stop_stream()
        return {"ok": True}

    def cinema_playlists(self, lists):
        import cinema
        st = cinema.save_playlists(data_dir(), lists)
        return {"ok": True, "playlists": st["playlists"]}

    def media_covers(self, ids):
        import media_shelf as ms
        return ms.covers(data_dir(), ids)

    def media_cover_set(self, item_id, url):
        import media_shelf as ms
        return ms.set_cover_data_url(data_dir(), item_id, url)

    def media_cover_pick(self, item_id):
        import media_shelf as ms
        import webview
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            file_types=("Pictures (*.jpg;*.jpeg;*.png;*.webp;*.gif;*.bmp)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        return ms.set_cover_file(data_dir(), item_id,
                                 picked[0] if isinstance(picked, (list, tuple)) else picked)

    def media_cover_from_film(self, item_id, rel):
        import media_shelf as ms
        path = ms.film_path(ms.movies_dir(app_dir(), create=False), rel)
        if not path:
            return {"error": "That film isn't in the Movies folder any more."}
        return ms.cover_from_film(data_dir(), item_id, path)

    # Covers from Photos (2026-10-02). Cam: "Need to have cover allocation for
    # media items handled in the add media menu not the shelf. Plus the
    # handling of images should be with in built photos app." A cover is a
    # photo in the library; the shelf keeps its own small copy to draw fast.
    def media_cover_from_photo(self, item_id, stored_name):
        import media_shelf as ms
        name = os.path.basename(str(stored_name or ""))
        src = os.path.join(photos_dir(), name)
        if not name or not os.path.isfile(src):
            return {"error": "That photo isn't in the library any more."}
        return ms.set_cover_file(data_dir(), item_id, src)

    def media_cover_from_album(self, item_id, art):
        import media_shelf as ms
        name = os.path.basename(str(art or ""))
        src = os.path.join(music_images_dir(), name)
        if not name or not os.path.isfile(src):
            return {"error": "That album has no cover."}
        return ms.set_cover_file(data_dir(), item_id, src)

    def media_film_still(self, rel):
        """A full-size still of the film, as a file for Photos to take in."""
        import media_shelf as ms
        import tempfile
        path = ms.film_path(ms.movies_dir(app_dir(), create=False), rel)
        if not path:
            return {"error": "That film isn't in the Movies folder any more."}
        return ms.film_still(path, tempfile.mkdtemp(prefix="neuronet-still-"))

    def media_cover_file(self, item_id):
        """Where an item's shelf cover is (covers from before 2026-10-02 move
        into Photos from it), or ""."""
        import media_shelf as ms
        try:
            p = ms.cover_path(data_dir(), item_id)
        except ValueError:
            return ""
        return p if os.path.isfile(p) else ""

    def media_cover_clear(self, item_id):
        import media_shelf as ms
        return ms.clear_cover(data_dir(), item_id)

    # -- Scan (Media → Scan, 15 Nov 2026) ----------------------------------------
    # A barcode into Media: typed (a USB scanner types it), read from photos,
    # or from the Barcodes folder in Picture References. See barcodes.py.
    def _scan_cache(self):
        return os.path.join(data_dir(), "cache", "scan-covers")

    # A cover pasted (Ctrl+V) or dropped into Media's Add / Edit window: the
    # clipboard read here (wl-paste), and a picture's address fetched here.
    def media_clipboard_picture(self):
        import barcodes
        return barcodes.clipboard_picture(self._scan_cache())

    def media_picture_from_url(self, url):
        import barcodes
        return barcodes.picture_from_url(url, self._scan_cache())

    def media_scan_lookup(self, code):
        import barcodes
        return barcodes.lookup(code, self._scan_cache())

    def _scan_read(self, paths):
        import barcodes
        out = []
        for p in paths:
            got = barcodes.read_picture(p)
            out.append({"path": p, "name": os.path.basename(p), "codes": got.get("codes", []),
                        "error": got.get("error", "")})
        return out

    def media_scan_pictures(self):
        """Photos of barcodes, chosen in a file dialog -> [{path, name, codes, error}]."""
        import webview
        picked = self._window.create_file_dialog(
            webview.FileDialog.OPEN, allow_multiple=True,
            file_types=("Pictures (*.jpg;*.jpeg;*.png;*.webp;*.heic;*.gif;*.bmp)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        return {"pictures": self._scan_read([picked] if isinstance(picked, str) else list(picked))}

    def media_scan_folder(self, read=True):
        """The Barcodes folder: {folder, count, pictures} (read=False: only how many)."""
        import snips
        d = snips.barcodes_dir()
        waiting = snips.media_art_waiting(d)
        return {"folder": d, "count": len(waiting), "pictures": self._scan_read(waiting) if read else []}

    def media_scan_done(self, path):
        """A photo from the Barcodes folder is finished with: into its Archive."""
        import snips
        d = snips.barcodes_dir()
        p = os.path.realpath(str(path or ""))
        if os.path.dirname(p) != os.path.realpath(d) or not os.path.isfile(p):
            return {"error": "That isn't waiting in the Barcodes folder."}
        return {"ok": True, "path": snips.media_art_archive(p, d)}

    def media_scan_open_folder(self):
        import snips
        d = snips.barcodes_dir()
        try:
            subprocess.Popen(["xdg-open", d], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True, "folder": d}
        except OSError as e:
            return {"error": "Couldn't open %s (%s)." % (d, e)}

    # -- Ebooks (Notes → Ebooks) -----------------------------------------------
    # The shelf, the books and their bookmarks and highlights: see ebooks.py.
    def _ebooks(self):
        import ebooks
        return ebooks.Library(os.path.join(data_dir(), "ebooks"))

    def ebooks_list(self):
        return self._ebooks().list()

    def ebooks_pick(self):
        """A file dialog for EPUB, PDF and text books; picked files are copied
        into the library."""
        import webview
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("Ebooks (*.epub;*.pdf;*.txt)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        return self._ebooks().import_paths([picked] if isinstance(picked, str) else list(picked))

    def ebooks_import_paths(self, paths):
        return self._ebooks().import_paths(paths)

    def ebooks_update(self, book_id, patch):
        import ebooks
        try:
            return self._ebooks().update(book_id, patch)
        except ebooks.LibraryError as e:
            return {"error": str(e)}
        except OSError as e:
            return {"error": "Couldn't save that: %s" % e}

    def ebooks_delete(self, book_id):
        import ebooks
        try:
            return self._ebooks().remove(book_id)
        except (ebooks.LibraryError, OSError) as e:
            return {"error": str(e)}

    def ebooks_chapter(self, book_id, index):
        import ebooks
        try:
            return self._ebooks().chapter(book_id, index)
        except ebooks.LibraryError as e:
            return {"error": str(e)}

    def ebooks_pdf(self, book_id):
        import ebooks
        try:
            return self._ebooks().pdf_data(book_id)
        except ebooks.LibraryError as e:
            return {"error": str(e)}

    # -- Code -> IDE (Algorithm) ------------------------------------------------
    # Algorithm's own Api (code_ide.py) answers every code_<name> call -- the
    # IDE's bridge, ui/code/store.js, adds the prefix -- so its back end came
    # across whole. The methods are made below the class (CODE_IDE_CALLS).
    def _code(self):
        import code_ide
        code_ide.ROOT = os.path.join(data_dir(), "code")
        global _code_api
        if _code_api is None:
            _code_api = code_ide.Api()
        return _code_api

    # -- Stuff ----------------------------------------------------------------
    # Cam: "lets create a new main section called Stuff, this will act as the
    # section where i can make inventories, databases of all our media."
    # Media is the Personal Effects collection, in personal_effects.json as it
    # always was -- nothing moved, nothing to migrate. Inventories are new and
    # live beside it in stuff.json: [{id, name, items, types, created}].

    def stuff_file(self):
        return os.path.join(data_dir(), "stuff.json")

    def stuff_load(self):
        path = self.stuff_file()
        if not os.path.isfile(path):
            return {"inventories": []}
        try:
            with open(path, "r", encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            return {"inventories": [], "error":
                    "Couldn't read your inventories (%s). The file has been "
                    "left exactly as it is." % e}
        invs = doc.get("inventories") if isinstance(doc, dict) else None
        if not isinstance(invs, list):
            return {"inventories": [], "error":
                    "The inventories file isn't in the expected shape. It has "
                    "been left exactly as it is."}
        for inv in invs:
            if isinstance(inv, dict):
                inv.setdefault("items", [])
                inv.setdefault("types", [])
        return {"inventories": [i for i in invs if isinstance(i, dict) and i.get("id")]}

    def stuff_save(self, doc):
        """Whole, through a temporary file and a rename -- see effects_save."""
        invs = (doc or {}).get("inventories") if isinstance(doc, dict) else None
        if not isinstance(invs, list):
            return {"error": "Nothing to save."}
        path = self.stuff_file()
        tmp = path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"inventories": invs}, f, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            return {"ok": True}
        except OSError as e:
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except OSError:
                pass
            return {"error": "Couldn't save your inventories: %s" % e}

    def stuff_export(self, fmt, payload):
        """A Stuff list as Excel or Word, on the letterhead every printout
        shares: NeuroNet left, the list's name centred, the collection mark
        right.

        `payload`: {title, subtitle, logo, logoName, columns: [{key, label}],
        sections: [{name, items: [{key: value}]}]}. It arrives ALREADY
        grouped and alphabetical -- the interface sorts once, and the screen,
        the printout and both exports all use that one sort."""
        import print_header as ph
        payload = payload if isinstance(payload, dict) else {}
        sections = payload.get("sections") or []
        if not sections or not any(sec.get("items") for sec in sections):
            return {"error": "There is nothing to export."}
        columns = [c for c in (payload.get("columns") or []) if c.get("key")]
        if not columns:
            columns = [{"key": "title", "label": "Title"}]
        title = str(payload.get("title") or "Stuff")
        subtitle = str(payload.get("subtitle") or "")
        logo = payload.get("logo") or "collection.png"
        logo_name = str(payload.get("logoName") or "collection")
        base = "".join(ch for ch in title if ch not in '\\/:*?"<>|').strip() or "Stuff"
        fmt = str(fmt or "").lower()
        cell = lambda it, k: str((it or {}).get(k) or "")

        if fmt == "xlsx":
            try:
                import openpyxl
                from openpyxl.styles import Alignment, Font, PatternFill
            except ImportError:
                return {"error": "Writing .xlsx needs the openpyxl library, "
                                 "which isn't installed on this machine."}
            try:
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = re.sub(r"[\\/*?:\[\]]", " ", title)[:31] or "Stuff"
                ncols = len(columns) + 1
                row = ph.xlsx_letterhead(ws, title, subtitle, logo, logo_name, ncols)
                head_fill = PatternFill("solid", fgColor="E6F0E7")
                bold = Font(bold=True)
                ink = Font(bold=True, color="2E6B38", size=12)
                for i, lab in enumerate(["Type"] + [c.get("label", "") for c in columns], 1):
                    c = ws.cell(row, i, lab); c.font = bold; c.fill = head_fill
                ws.freeze_panes = ws.cell(row + 1, 1)
                row += 1
                for sec in sections:
                    for it in sec.get("items") or []:
                        ws.cell(row, 1, sec.get("name", ""))
                        for i, col in enumerate(columns, 2):
                            ws.cell(row, i, cell(it, col["key"]))
                        row += 1
                ws.auto_filter.ref = "A%d:%s%d" % (5, openpyxl.utils.get_column_letter(ncols), row - 1)
                # Printed from Excel, one page wide -- the letterhead's right-hand
                # mark and the last column stay on the page with the rest.
                for sheet in [ws]:
                    sheet.page_setup.orientation = "landscape" if ncols > 4 else "portrait"
                    sheet.page_setup.fitToWidth = 1
                    sheet.page_setup.fitToHeight = 0
                    sheet.sheet_properties.pageSetUpPr.fitToPage = True
                widths = [18] + [46 if c["key"] == "title" else 34 if c["key"] == "notes" else 16
                                 for c in columns]
                for i, w in enumerate(widths, 1):
                    ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
                # A tab per section too, so one list can go on its own.
                for sec in sections:
                    tab = re.sub(r"[\\/*?:\[\]]", " ", str(sec.get("name") or "Section"))[:31] or "Section"
                    while tab in wb.sheetnames:
                        tab = tab[:28] + " 2"
                    sh = wb.create_sheet(tab)
                    r = ph.xlsx_letterhead(sh, "%s — %s" % (title, sec.get("name", "")),
                                           "%d item%s" % (len(sec.get("items") or []),
                                                         "" if len(sec.get("items") or []) == 1 else "s"),
                                           logo, logo_name, max(3, len(columns)))
                    for i, col in enumerate(columns, 1):
                        c = sh.cell(r, i, col.get("label", "")); c.font = bold; c.fill = head_fill
                    for it in sec.get("items") or []:
                        r += 1
                        for i, col in enumerate(columns, 1):
                            sh.cell(r, i, cell(it, col["key"]))
                    for i, w in enumerate(widths[1:], 1):
                        sh.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
                    sh.page_setup.fitToWidth = 1
                    sh.page_setup.fitToHeight = 0
                    sh.sheet_properties.pageSetUpPr.fitToPage = True
                import io
                buf = io.BytesIO()
                wb.save(buf)
                return _to_desktop(base + ".xlsx", buf.getvalue(), binary=True)
            except Exception as e:
                return {"error": "Couldn't build the spreadsheet: %s" % e}

        if fmt == "docx":
            try:
                import docx
                from docx.shared import Pt, RGBColor
            except ImportError:
                return {"error": "Writing .docx needs the python-docx library, "
                                 "which isn't installed on this machine."}
            try:
                doc = docx.Document()
                ph.docx_letterhead(doc, title, subtitle, logo, logo_name)
                ink = RGBColor(0x2E, 0x6B, 0x38)
                grey = RGBColor(0x6A, 0x65, 0x60)
                rest = [c for c in columns if c["key"] != "title"]
                for sec in sections:
                    items = sec.get("items") or []
                    h = doc.add_paragraph()
                    r = h.add_run("%s  (%d)" % (sec.get("name", ""), len(items)))
                    r.bold = True; r.font.size = Pt(13); r.font.color.rgb = ink
                    # Numbered by hand, 1 again in every section: Word's own
                    # numbered list runs on from one section into the next.
                    for num, it in enumerate(items, 1):
                        p = doc.add_paragraph()
                        p.paragraph_format.left_indent = Pt(22)
                        p.paragraph_format.first_line_indent = Pt(-16)
                        p.paragraph_format.space_after = Pt(1)
                        n = p.add_run("%d.  " % num)
                        n.bold = True; n.font.color.rgb = RGBColor(0x5F, 0xA6, 0x65)
                        p.add_run(cell(it, "title"))
                        extra = [cell(it, c["key"]) for c in rest if cell(it, c["key"])]
                        if extra:
                            x = p.add_run("  —  " + " · ".join(extra))
                            x.font.color.rgb = grey; x.font.size = Pt(9.5)
                import io
                buf = io.BytesIO()
                doc.save(buf)
                return _to_desktop(base + ".docx", buf.getvalue(), binary=True)
            except Exception as e:
                return {"error": "Couldn't build the document: %s" % e}
        return {"error": "Stuff can't be exported as %s." % fmt}

    def effects_formats(self):
        """What this machine can write. HTML always."""
        out = {"html": True, "xlsx": False, "docx": False}
        try:
            import openpyxl  # noqa: F401
            out["xlsx"] = True
        except ImportError:
            pass
        try:
            import docx  # noqa: F401
            out["docx"] = True
        except ImportError:
            pass
        return out

    def effects_export(self, name, payload, fmt="html"):
        """The collection onto the desktop.

        WHAT ARRIVES IS ALREADY SORTED AND GROUPED. The interface does that,
        once, and the same grouping draws the list on screen, the print
        document and both exports -- so an export can never disagree with
        what Cam is looking at. Sorting again here would be a second
        opinion, and the two would drift the first time one changed.

        `payload` is {"sections": [{"name": "DVD", "items":
        [{"title", "year", "notes"}, ...]}, ...]} for the spreadsheet, and
        `html` for the document, which is the SAME html the print button
        sends -- print and .docx are the one document by construction.
        """
        base = "".join(c for c in str(name or "Personal Effects")
                       if c not in '\\/:*?"<>|').strip() or "Personal Effects"
        payload = payload or {}
        fmt = (fmt or "html").lower()

        if fmt == "xlsx":
            try:
                import openpyxl
                from openpyxl.styles import Font
            except ImportError:
                return {"error": "Writing .xlsx needs the openpyxl library, "
                                 "which isn't installed on this machine."}
            sections = payload.get("sections") or []
            if not sections:
                return {"error": "There is nothing to export."}
            try:
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = "Personal Effects"
                bold = Font(bold=True)
                ws.append(["Type", "Title", "Year", "Notes"])
                for c in ws[1]:
                    c.font = bold
                for sec in sections:
                    ws.append([])
                    head = ws.max_row + 1
                    ws.append([sec.get("name", "")])
                    ws.cell(row=head, column=1).font = bold
                    for it in sec.get("items") or []:
                        ws.append(["", it.get("title", ""),
                                   it.get("year", ""), it.get("notes", "")])
                for col, width in (("A", 22), ("B", 46), ("C", 8), ("D", 40)):
                    ws.column_dimensions[col].width = width
                # A sheet per section as well, so one list can be printed or
                # sent on without the rest of the collection going with it.
                for sec in sections:
                    tab = re.sub(r"[\\/*?:\[\]]", " ",
                                 str(sec.get("name") or "Section"))[:31] or "Section"
                    if tab in wb.sheetnames:
                        tab = (tab[:28] + " 2")
                    sh = wb.create_sheet(tab)
                    sh.append(["Title", "Year", "Notes"])
                    for c in sh[1]:
                        c.font = bold
                    for it in sec.get("items") or []:
                        sh.append([it.get("title", ""), it.get("year", ""),
                                   it.get("notes", "")])
                    for col, width in (("A", 46), ("B", 8), ("C", 40)):
                        sh.column_dimensions[col].width = width
                import io
                buf = io.BytesIO()
                wb.save(buf)
                return _to_desktop(base + ".xlsx", buf.getvalue(), binary=True)
            except Exception as e:
                return {"error": "Couldn't build the spreadsheet: %s" % e}

        html = str(payload.get("html") or "")
        if not html:
            return {"error": "There is nothing to export."}
        if fmt == "docx":
            try:
                import docx  # noqa: F401
            except ImportError:
                return {"error": "Writing .docx needs the python-docx "
                                 "library, which isn't installed on this "
                                 "machine. HTML works everywhere."}
            try:
                blob = html_to_docx(html)
            except Exception as e:
                return {"error": "Couldn't build the document: %s" % e}
            return _to_desktop(base + ".docx", blob, binary=True)
        return _to_desktop(base + ".html", html)

    def notebooks_formats(self):
        """What this machine can actually write a book out as -- asked
        rather than assumed, so a button that could only fail is never
        offered. The same pattern cells_formats and training_formats
        already follow."""
        out = {"html": True}
        try:
            import docx  # noqa: F401
            out["docx"] = True
        except ImportError:
            out["docx"] = False
        return out

    def notebooks_export(self, name, html, fmt="html", letterhead=None):
        """A finished book, onto the desktop.

        The interface builds the book as ONE piece of HTML -- it is the
        side that knows how to render a note, a sheet and a guide -- and
        this writes it out. HTML always: it is exactly what was on
        screen, it opens in a browser and in Word, and it needs nothing
        installed. .docx when python-docx is here, converted from that
        same HTML so the two can never drift apart.
        """
        base = "".join(c for c in str(name or "Book")
                       if c not in '\\/:*?"<>|').strip() or "Book"
        if fmt == "docx":
            try:
                import docx  # noqa: F401
            except ImportError:
                return {"error": "Writing .docx needs the python-docx "
                                 "library, which isn't installed on this "
                                 "machine. HTML works everywhere."}
            try:
                blob = html_to_docx(str(html or ""), letterhead=letterhead)
            except Exception as e:
                return {"error": f"Couldn't build the document: {e}"}
            return _to_desktop(base + ".docx", blob, binary=True)
        return _to_desktop(base + ".html", str(html or ""))

    def cells_formats(self):
        """Which spreadsheet files this machine can read and write."""
        try:
            import openpyxl  # noqa: F401
            return {"csv": True, "xlsx": True}
        except ImportError:
            return {"csv": True, "xlsx": False}

    def cells_import(self):
        """Rows from a file Cam picks: .csv, .tsv or .xlsx.

        Numbers and formulas come across as the TEXT they are, because that
        is what a cell holds here -- "=B2*5" from a spreadsheet stays a
        formula, and this grid works it out with its own engine.
        """
        if not self._window:
            return {"error": "Importing needs the desktop app."}
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False,
            file_types=("Spreadsheets (*.csv;*.tsv;*.xlsx)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        path = picked[0] if isinstance(picked, (list, tuple)) else picked
        return read_sheet_file(path)

    def cells_export(self, name, rows, fmt):
        """A sheet out to the desktop as .csv or .xlsx.

        VALUES, as shown on screen -- the front end works them out with the
        same engine that draws them, so what lands in the file is what Cam
        sees, not a formula pointing at cells another program may not have.
        """
        rows = rows or []
        if not rows:
            return {"error": "There is nothing to export."}
        fmt = (fmt or "csv").lower()
        dest_dir = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.isdir(dest_dir):
            dest_dir = os.path.expanduser("~")
        base = re.sub(r"[^A-Za-z0-9 _-]", " ", str(name or "Sheet")).strip() or "Sheet"
        dest = os.path.join(dest_dir, f"{base}.{fmt}")
        n = 2
        while os.path.exists(dest):        # never over an earlier export
            dest = os.path.join(dest_dir, f"{base} ({n}).{fmt}")
            n += 1
        try:
            if fmt == "csv":
                import csv
                with open(dest, "w", newline="", encoding="utf-8") as f:
                    csv.writer(f).writerows(rows)
            elif fmt == "xlsx":
                try:
                    import openpyxl
                except ImportError:
                    return {"error": "Writing .xlsx needs the openpyxl library, "
                                     "which isn't installed on this machine."}
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = base[:31] or "Sheet"
                for row in rows:
                    ws.append(list(row))
                wb.save(dest)
            else:
                return {"error": "Export as .csv or .xlsx."}
            return {"ok": True, "path": dest}
        except Exception as e:
            return {"error": f"Couldn't save that file: {e}"}

    def boards_formats(self):
        """What this machine can actually write. Training does the same:
        asking beforehand beats offering an export that fails."""
        try:
            import pptx  # noqa: F401
            return {"pptx": True}
        except ImportError:
            return {"pptx": False}

    def boards_export_pptx(self, filename, slides):
        """One slide per board page, each the page's own picture.

        Cam uses boards to design PowerPoints, so the point is a deck that
        opens in PowerPoint with the pages already laid out -- not a folder
        of images to place by hand.

        The pictures are made by the app itself (each page drawn to a PNG),
        so what lands in the deck is exactly what is on the board.
        """
        try:
            from pptx import Presentation
            from pptx.util import Emu
            from PIL import Image          # imported here, as everywhere else
        except ImportError:
            return {"error": "PowerPoint export needs the python-pptx library, "
                             "which isn't installed on this machine."}
        if not slides:
            return {"error": "Nothing was chosen to export."}
        import base64
        try:
            prs = Presentation()
            prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)  # 16:9
            blank = prs.slide_layouts[6]
            for slide in slides:
                data_url = (slide or {}).get("dataUrl") or ""
                _, _, payload = data_url.partition(",")
                if not payload:
                    continue
                raw = base64.b64decode(payload)
                img = io.BytesIO(raw)
                with Image.open(io.BytesIO(raw)) as probe:
                    iw, ih = probe.size
                # Fitted whole, centred, never stretched: a board squashed to
                # 16:9 would misrepresent what Cam drew.
                scale = min(prs.slide_width / iw, prs.slide_height / ih)
                w, h = int(iw * scale), int(ih * scale)
                s = prs.slides.add_slide(blank)
                s.shapes.add_picture(img, int((prs.slide_width - w) / 2),
                                     int((prs.slide_height - h) / 2), w, h)
            if not len(prs.slides):
                return {"error": "None of those pages had a picture to use."}
            dest_dir = os.path.join(os.path.expanduser("~"), "Desktop")
            if not os.path.isdir(dest_dir):
                dest_dir = os.path.expanduser("~")
            base = os.path.basename(str(filename or "Boards")) or "Boards"
            if not base.lower().endswith(".pptx"):
                base += ".pptx"
            stem, ext = os.path.splitext(base)
            dest = os.path.join(dest_dir, base)
            n = 2
            while os.path.exists(dest):          # never over an earlier deck
                dest = os.path.join(dest_dir, f"{stem} ({n}){ext}")
                n += 1
            prs.save(dest)
            return {"ok": True, "path": dest, "slides": len(prs.slides)}
        except Exception as e:
            return {"error": f"Couldn't build that deck: {e}"}
