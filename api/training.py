"""NeuroNet's backend: Training, its printing and exports.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class TrainingApi:
    # -- training -----------------------------------------------------
    # Moved here from KinCrux. The UI calls only these, through
    # ui/training/storage.js -- never get_data or save_data.

    def training_load(self):
        return normalize_training(crux_store.read_json(training_file(), {}))

    def training_save(self, data, expect_stamp=None):
        """Guarded. Standalone Coach Cam no longer shares this file -- it
        keeps its own library -- but two NeuroNet windows can still be
        open at once, and an unguarded write is last-writer-wins: whoever
        saves second erases the other's work without a word."""
        return crux_store.save_guarded(
            training_file(), data, expect_stamp=expect_stamp,
            normalise=normalize_training, what="your coaching document")

    def training_stamp(self):
        return crux_store.stamp_of(training_file())

    def training_neurotrain(self):
        """Is NeuroTrain (the planner Sessions and Programs moved to, Q19 q1,
        10 Nov 2026) on this computer? Where the neurotrain launcher looks."""
        d = os.environ.get("NEUROTRAIN_DIR") or os.path.expanduser("~/Work/NeuroTrain")
        ok = os.access(os.path.join(d, "node_modules", ".bin", "electron"), os.X_OK) \
            and os.access(os.path.join(d, "tools", "neurotrain"), os.X_OK)
        return {"installed": bool(ok)}

    def training_open_neurotrain(self, page=""):
        """Opens NeuroTrain (or brings it here) -- only where it's installed:
        elsewhere the launcher opens this Training section instead. page
        "calculators" opens it on its Calculators (Q20 q1, 13 Nov 2026)."""
        if not self.training_neurotrain()["installed"]:
            return {"error": "NeuroTrain isn't on this computer."}
        args = [page] if page in ("calculators",) else []
        try:
            subprocess.Popen([os.path.join(os.path.dirname(quick_script()), "neurotrain")] + args, start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True}
        except OSError as e:
            return {"error": str(e)}

    def training_get_prefs(self):
        return crux_store.read_json(training_prefs_file(), {})

    def training_set_prefs(self, patch):
        """Merges rather than replaces: prefs written by an older build carry
        keys this one knows nothing about, and overwriting the file
        wholesale would drop them."""
        current = crux_store.read_json(training_prefs_file(), {})
        if not isinstance(current, dict):
            current = {}
        if isinstance(patch, dict):
            current.update(patch)
        crux_store.atomic_write_json(training_prefs_file(), current)
        return {"ok": True}

    # -- training: printing and exports -------------------------------
    # Through training_documents.py -- Coach Cam's own engine, carried
    # across with the module rather than reimplemented, so a session
    # printed here matches one printed from Coach Cam.
    _TRAINING_DOCS = {}

    def _training_kinds(self):
        if not self._TRAINING_DOCS:
            import training_documents as d
            self._TRAINING_DOCS.update({
                "session": (d.build_session_docx, d.build_session_xlsx,
                            d.build_session_pdf, d._session_html),
                "circuit": (d.build_circuit_docx, d.build_circuit_xlsx,
                            d.build_circuit_pdf, d._circuit_html),
                "guide": (d.build_guide_docx, d.build_guide_xlsx,
                          None, d._guide_html),
                "questionnaire": (d.build_questionnaire_docx,
                                  d.build_questionnaire_xlsx,
                                  None, d._questionnaire_html),
                "athlete": (d.build_athlete_docx, d.build_athlete_xlsx,
                            None, d._athlete_html),
                "program": (d.build_program_docx, d.build_program_xlsx,
                            None, d._program_html),
                "lessonplan": (d.build_lessonplan_docx,
                               d.build_lessonplan_xlsx,
                               None, d._lessonplan_html),
                "calendar": (None, None, None, d._calendar_html),
                "mas_sheet": (d.build_mas_sheet_docx, d.build_mas_sheet_xlsx,
                              None, d._mas_sheet_html),
                "book": (d.build_book_docx, d.build_book_xlsx,
                         None, d._book_html),
                # the training log (2026-10-05): print, and Excel to type weights in
                "log": (None, d.build_log_xlsx, None, d._log_html),
            })
        return self._TRAINING_DOCS

    def training_print_document(self, kind, record):
        """Opens one record as Coach Cam's formatted sheet. Sessions and
        circuits get the full sheet -- letterhead, adaptation log, write-on
        notes; everything else gets the letterhead and the content."""
        import traceback
        import training_documents as d
        entry = self._training_kinds().get(kind)
        if not entry:
            return "Nothing knows how to print a %s." % kind
        try:
            body = entry[3](record)
            title = (record or {}).get("name") or kind.title()
            wants_sheet = kind in ("session", "circuit")
            page = d.print_page(title, body, record if wants_sheet else None, kind=kind)
            d.open_print_document(page)
            self._count("print:training-%s" % kind)
            return True
        except Exception:
            traceback.print_exc()
            return "That document could not be opened for printing."

    def training_document_html(self, kind, record):
        """The page training_print_document would open, returned instead --
        for NeuroNet's reader (the desktop Bookshelf, 2026-10-02)."""
        import traceback
        import training_documents as d
        entry = self._training_kinds().get(kind)
        if not entry:
            return {"error": "Nothing knows how to show a %s." % kind}
        try:
            title = (record or {}).get("name") or kind.title()
            wants_sheet = kind in ("session", "circuit")
            return {"html": d.print_page(title, entry[3](record), record if wants_sheet else None, kind=kind),
                    "title": title}
        except Exception:
            traceback.print_exc()
            return {"error": "That document couldn't be made."}

    def training_export_document(self, kind, fmt, record, suggested_name):
        """Word, Excel or PDF, saved where Cam chooses. Each library is
        imported at the point of use, so a missing one is reported as a
        sentence rather than a traceback."""
        import traceback
        entry = self._training_kinds().get(kind)
        if not entry:
            return "Nothing knows how to export a %s." % kind
        docx_fn, xlsx_fn, pdf_fn, _ = entry
        builder = {"docx": docx_fn, "xlsx": xlsx_fn, "pdf": pdf_fn}.get(fmt)
        if builder is None:
            return "%s does not export as %s." % (kind.title(), fmt.upper())

        import webview
        picked = self._window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename="%s.%s" % (suggested_name, fmt))
        if not picked:
            return False
        path = picked if isinstance(picked, str) else picked[0]

        try:
            if fmt == "pdf":
                builder(path, record)
            else:
                builder(record).save(path)
            self._count("export:training-%s" % kind)
            return True
        except ImportError:
            return {
                "docx": "Word export needs python-docx: pip install python-docx",
                "xlsx": "Excel export needs openpyxl: pip install openpyxl",
                "pdf": "PDF export needs reportlab: pip install reportlab",
            }[fmt]
        except Exception:
            traceback.print_exc()
            return "That document could not be written."

    def training_formats(self):
        """Which export formats this machine can actually produce -- asked
        rather than assumed, so the UI can hide a button that would only
        fail."""
        out = {}
        for name, module in (("docx", "docx"), ("xlsx", "openpyxl"),
                             ("pdf", "reportlab")):
            try:
                __import__(module)
                out[name] = True
            except ImportError:
                out[name] = False
        return out
