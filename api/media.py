"""NeuroNet's backend: ebooks, the Code IDE and Stuff (the Shelf and Cinema went to NeuroStream, 19 Nov 2026).

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class MediaApi:
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
