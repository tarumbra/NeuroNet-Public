"""NeuroNet's backend: printing shared by every section, and app stats.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class PrintingApi:
    # -- printing, shared by every module ------------------------------
    def open_print_document(self, html_body, kind=None):
        """Any module may print arbitrary HTML through this.

        It has to be a METHOD. pywebview exposes only methods on the Api
        instance, so a module-level function of the same name is simply
        not reachable from the interface -- which in KinCrux meant
        Money's print button did nothing at all, silently, for weeks.

        `kind` ("recipe", "puzzle-book", ...) is what App stats counts
        prints by. Optional, so a caller that does not say still prints.
        """
        res = open_print_document(html_body)
        if kind and not (isinstance(res, dict) and res.get("error")):
            self._count("print:" + str(kind))
        return res

    # -- App stats -------------------------------------------------------
    # Cam: "an application stats panel that breaks down what is in the app
    # and how much ... this will help me collect data on most used
    # features." See app_stats.py for what is counted and from when.
    def _count(self, key):
        """Never lets counting break the thing being counted."""
        try:
            import app_stats
            app_stats.count(usage_file(), key)
        except Exception:
            pass

    def guide_save_pdf(self, html, name="Neuro Guide.pdf"):
        """The Neuro Guide (or a page of it) as a PDF, saved where the person
        picks. Made by Chromium's own print-to-PDF, headless -- Omarchy's
        browser, so it's on every NeuroNet computer. (Stage 4, 2026-09-29:
        the manual's printable edition.)"""
        import shutil as _sh
        import tempfile
        import webview
        chrome = next((c for c in ("chromium", "google-chrome-stable", "brave") if _sh.which(c)), None)
        if not chrome:
            return {"error": "Making a PDF needs Chromium (Omarchy's browser) -- it isn't installed."}
        docs = os.path.join(os.path.expanduser("~"), "Documents")
        picked = self._window.create_file_dialog(
            webview.SAVE_DIALOG, directory=docs if os.path.isdir(docs) else "", save_filename=str(name))
        if not picked:
            return {"cancelled": True}
        dest = picked if isinstance(picked, str) else picked[0]
        if not dest.lower().endswith(".pdf"):
            dest += ".pdf"
        return guide_pdf(str(html), dest, chrome)

    def usage_launch(self):
        import app_stats
        try:
            app_stats.launched(usage_file())
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't record the launch: {e}"}

    def usage_record(self, delta):
        """A minute or so of time from the app: in it, per section, music."""
        import app_stats
        try:
            app_stats.record(usage_file(), delta)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't record usage: {e}"}

    def usage_reset(self):
        """Settings -> App stats -> Reset: the usage record starts again from
        now; the old one is kept beside it (app_stats.reset)."""
        import app_stats
        try:
            return {"ok": True, "kept": app_stats.reset(usage_file())}
        except OSError as e:
            return {"error": f"Couldn't reset the stats: {e}"}

    def usage_count(self, key):
        """For events only the interface sees, like a dashboard puzzle solved."""
        self._count(key)
        return {"ok": True}

    def app_stats(self):
        import app_stats
        return app_stats.gather(self, usage_file())

    def app_health(self):
        """Settings -> App stats: NeuroNet's memory now and over the day (app_health.py)."""
        import app_health
        try:
            return app_health.snapshot()
        except Exception as e:
            return {"error": str(e)}

    def stats_formats(self):
        out = {"xlsx": False, "docx": False}
        for fmt, mod in (("xlsx", "openpyxl"), ("docx", "docx")):
            try:
                __import__(mod)
                out[fmt] = True
            except ImportError:
                pass
        return out

    def stats_export(self, fmt, model):
        """The panel as a spreadsheet or a Word document, onto the desktop."""
        import app_stats
        fmt = str(fmt or "").lower()
        if not app_stats._model_ok(model):
            return {"error": "There were no stats to export."}
        builders = {"xlsx": (app_stats.build_xlsx, "openpyxl"),
                    "docx": (app_stats.build_docx, "python-docx")}
        if fmt not in builders:
            return {"error": f"Stats can't be exported as {fmt}."}
        build, lib = builders[fmt]
        try:
            blob = build(model)
        except ImportError:
            return {"error": f"That export needs the {lib} library, which "
                             "isn't installed on this machine."}
        except Exception as e:
            return {"error": f"Couldn't build the export: {e}"}
        stamp = datetime.date.today().isoformat()
        res = _to_desktop(f"NeuroNet stats {stamp}.{fmt}", blob, binary=True)
        if not (isinstance(res, dict) and res.get("error")):
            self._count("export:stats-" + fmt)
        return res
