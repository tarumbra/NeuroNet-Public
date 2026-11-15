"""NeuroNet's backend: export and import, the welcome, desktop widgets, moving the data folder.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class SystemApi:
    # -- Export and import (Settings → Export & import) -------------------------
    # Everything of Cam's in one .zip, to move to another machine: see
    # data_transfer.py for what goes in and what doesn't.
    def _transfer_areas(self, for_import=False):
        """Every place this machine keeps Cam's data, resolved the way the
        running app resolves it. A place inside another is left to that one,
        so nothing is exported twice -- which, now that family, kitchen and
        money live inside the data folder, makes an export one part plus the
        settings. An IMPORT keeps every part, so an export made before the
        move (with family/, recipes/, money/ parts of its own) still lands
        each one in its new home."""
        areas = [{"key": "neuronet", "label": "NeuroNet — photos, ebooks, notes, "
                  "training, puzzles, Stuff and more", "path": data_dir()}]
        kb = kitchen_backend
        if kb is not None:
            for key, label, fn in (("family", "Calendar, contacts and family photos", "data_dir"),
                                   ("recipes", "Recipes", "cookery_dir"),
                                   ("money", "Money", "money_dir")):
                try:
                    areas.append({"key": key, "label": label, "path": getattr(kb, fn)()})
                except Exception:
                    pass
        areas.append({"key": "settings", "label": "Settings", "path": prefs_file(), "file": True})
        if kb is not None:
            try:
                areas.append({"key": "kitchen-settings", "label": "Kitchen settings",
                              "path": kb.prefs_file(), "file": True})
            except Exception:
                pass
        if for_import:
            return areas
        out = []
        for a in areas:
            p = os.path.abspath(a["path"])
            covered = False
            for o in out + [x for x in areas if x is not a]:
                if o.get("file"):
                    continue
                q = os.path.abspath(o["path"])
                # the same folder as one already kept, or inside another
                if (p == q and o in out) or p.startswith(q + os.sep):
                    covered = True
                    break
            if not covered:
                out.append(a)
        return out

    _transfer = {"state": "idle"}

    def _transfer_run(self, kind, fn):
        import threading
        job = {"state": "running", "kind": kind, "done": 0, "total": 0, "fraction": 0.0}
        Api._transfer = job

        def progress(done, total, fraction):
            job.update(done=done, total=total, fraction=round(fraction, 4))

        def work():
            try:
                job["result"] = fn(progress)
                job["state"] = "error" if job["result"].get("error") else "done"
            except Exception as e:  # a full disk, a file that can't be read
                job["result"] = {"error": str(e)}
                job["state"] = "error"
        threading.Thread(target=work, name="neuronet-" + kind, daemon=True).start()
        return {"started": True}

    def data_transfer_status(self):
        return dict(Api._transfer)

    def data_export_summary(self):
        import data_transfer as dt
        import desktop_setup as ds
        try:
            ds.capture(data_dir())       # so the summary counts the desktop set-up too
        except OSError:
            pass
        return dt.summary(self._transfer_areas())

    def data_export_start(self, password=""):
        """Export to a file the person picks. With a password (NeuroNet System
        plan, Stage 3: the new-machine export, "password protected if
        possible"), locked -- a .nnx instead of a .zip. The desktop set-up
        (dock, board, frame, theme) is captured into the data folder first, so
        it goes along."""
        import data_transfer as dt
        import desktop_setup as ds
        import webview
        if Api._transfer.get("state") == "running":
            return {"error": "An export or import is already running."}
        password = str(password or "")
        ext = dt.ENC_EXT if password else ".zip"
        name = "NeuroNet export %s%s" % (datetime.date.today().isoformat(), ext)
        picked = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=name)
        if not picked:
            return {"cancelled": True}
        dest = picked if isinstance(picked, str) else picked[0]
        if not dest.lower().endswith(ext):
            dest += ext
        try:
            ds.capture(data_dir())
        except OSError as e:
            return {"error": "Couldn't gather the desktop set-up: %s" % e}
        areas = self._transfer_areas()
        if password:
            return self._transfer_run("export", lambda progress: dt.export_locked(areas, dest, password, progress))
        return self._transfer_run("export", lambda progress: dt.export(areas, dest, progress))

    def _import_targets(self, manifest):
        here = {a["key"]: a for a in self._transfer_areas(for_import=True)}
        return [{"key": a["key"], "label": a.get("label", a["key"]),
                 "to": here.get(a["key"], {}).get("path", "")}
                for a in manifest.get("areas", [])]

    def data_import_pick(self):
        """Pick an export. A locked one answers {"locked": true} -- the page
        then asks for its password and calls data_import_peek."""
        import data_transfer as dt
        import webview
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, file_types=("NeuroNet export (*.zip;*.nnx)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        src = picked if isinstance(picked, str) else picked[0]
        if dt.is_encrypted(src):
            return {"locked": True, "path": src}
        got = dt.read_manifest(src)
        if got.get("ok"):
            got["path"] = src
            got["targets"] = self._import_targets(got["manifest"])
        return got

    def data_import_peek(self, src, password):
        """What a locked export holds -- the password checked without
        unlocking the whole file."""
        import data_transfer as dt
        try:
            manifest = dt.peek_encrypted(str(src), str(password or ""))
        except dt.WrongPassword:
            return {"error": "That password doesn't open this export.", "wrongPassword": True}
        except (OSError, ValueError) as e:
            return {"error": "That export couldn't be read (%s)." % e}
        return {"ok": True, "path": str(src), "locked": True, "manifest": manifest,
                "targets": self._import_targets(manifest)}

    def data_import_start(self, src, password=""):
        import data_transfer as dt
        import desktop_setup as ds
        if Api._transfer.get("state") == "running":
            return {"error": "An export or import is already running."}
        src = str(src)
        areas = self._transfer_areas(for_import=True)
        backups = os.path.join(data_dir(), "import-backups")

        def work(progress):
            if dt.is_encrypted(src):
                res = dt.import_locked(src, str(password or ""), areas, backups,
                                       os.path.join(data_dir(), ".import-work"), progress)
            else:
                res = dt.import_zip(src, areas, backups, progress)
            if res.get("ok"):
                # the desktop set-up it brought, into place (once)
                try:
                    res["desktop"] = ds.apply(data_dir())
                except OSError as e:
                    res["desktop"] = []
                    res["desktopError"] = str(e)
                welcome_mark_done("imported")
            return res
        return self._transfer_run("import", work)

    # -- The first-boot welcome (NeuroNet System plan, Stage 3) ------------------
    # Code -> Web playground (code_web.py): HTML + CSS pages. Pages are named
    # by id only (never a path); the preview is the page's own sandboxed frame.
    def code_web_list(self):
        import code_web
        return code_web.listing(data_dir())

    def code_web_read(self, pid):
        import code_web
        return code_web.read(data_dir(), pid)

    def code_web_write(self, pid, doc):
        import code_web
        try:
            return code_web.write(data_dir(), pid or None, doc)
        except OSError as e:
            return {"error": "Couldn't save it: %s" % e}

    def code_web_delete(self, pid):
        import code_web
        return code_web.delete(data_dir(), pid)

    def code_web_export(self, pid):
        """The page as one .html file, saved where Cam chooses."""
        import code_web
        page = code_web.read(data_dir(), pid)
        if page.get("error"):
            return page
        import webview
        if not self._window:
            return {"error": "The save dialog isn't available right now."}
        stem = _safe_file_stem(page["name"]) or "page"
        picked = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=stem + ".html")
        if not picked:
            return {"cancelled": True}
        path = picked if isinstance(picked, str) else picked[0]
        if not path.lower().endswith((".html", ".htm")):
            path += ".html"
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(code_web.as_html(page))
        except OSError as e:
            return {"error": "Couldn't save it: %s" % e}
        return {"ok": True, "path": path}

    # Settings -> Appearance -> Glowing window borders (window_glow.py): the
    # NeuroNet theme's lit-up border in every Omarchy theme.
    def window_glow_get(self):
        import window_glow
        return window_glow.listing()

    def window_glow_set(self, on):
        import window_glow
        return window_glow.set_on(bool(on))

    # Settings -> Desktop widgets -> Screensaver (screensaver.py): NeuroNet's
    # name in Omarchy's screensaver, or Omarchy's own, kept.
    def screensaver_get(self):
        import screensaver
        return {"using": screensaver.current()}

    def screensaver_set(self, which):
        import screensaver
        return screensaver.use(str(which))

    def screensaver_preview(self):
        """Start the screensaver now, to see it (any key or the mouse ends it)."""
        try:
            subprocess.Popen(["omarchy-launch-screensaver", "force"], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True}
        except OSError:
            return {"error": "Omarchy's screensaver isn't on this computer."}

    # -- Settings -> Data folder: moving the data to another drive ----------------
    # The work and the reasons are data_move.py's. Runs in the background like
    # an export; the page asks how far along it is.
    _move = {"state": "idle"}
    _move_cancel = False

    def data_folder_info(self):
        """Where the data is, how big, and what drive it's on."""
        import data_move
        root = data_dir()
        info = data_move.survey(root)
        try:
            free = shutil.disk_usage(root).free
        except OSError:
            free = 0
        return {"path": root, "files": info["files"], "bytes": info["bytes"],
                "free": free, "fs": data_move.fs_type(root), "missing": _missing_data,
                "configured": os.path.isfile(paths_file())}

    def data_move_pick(self):
        """Pick the drive (a folder on it); says what the move would do."""
        import webview
        start = "/run/media/" + os.environ.get("USER", "") if os.path.isdir(
            "/run/media/" + os.environ.get("USER", "")) else os.path.expanduser("~")
        picked = self._window.create_file_dialog(webview.FileDialog.FOLDER, directory=start)
        if not picked:
            return {"cancelled": True}
        return self.data_move_check(picked[0] if isinstance(picked, (list, tuple)) else picked)

    def data_move_check(self, chosen):
        import data_move
        return data_move.check(data_dir(), str(chosen))

    def data_move_start(self, chosen):
        import data_move
        if Api._move.get("state") == "running" or Api._transfer.get("state") == "running":
            return {"error": "Something is already being copied -- wait for it to finish."}
        src = data_dir()
        job = {"state": "running", "phase": "checking", "fraction": 0.0, "done": 0, "total": 0}
        Api._move, Api._move_cancel = job, False
        setup = shutil.which("neuronet-setup") or os.path.join(app_dir(), "system", "bin", "neuronet-setup")

        def progress(done, total, fraction):
            job.update(done=done, total=total, fraction=round(fraction, 4))

        def work():
            global _resolved_root
            try:
                r = data_move.move(src, str(chosen), paths_file(), app_dir(), progress,
                                   cancelled=lambda: Api._move_cancel,
                                   setup=setup if os.access(setup, os.X_OK) else None,
                                   phase=lambda p: job.update(phase=p))
                if r.get("ok"):
                    _resolved_root = r["target"]     # until the restart, save there
                    _log_line("data moved: %s -> %s (old copy: %s)" % (src, r["target"], r.get("old")))
                job["result"] = r
                job["state"] = "done" if r.get("ok") else "error"
            except Exception as e:
                job["result"] = {"error": str(e)}
                job["state"] = "error"
        import threading
        threading.Thread(target=work, name="neuronet-move", daemon=True).start()
        return {"started": True}

    def data_move_status(self):
        return dict(Api._move)

    def data_move_cancel(self):
        Api._move_cancel = True
        return {"ok": True}

    def app_restart(self):
        """Close NeuroNet and open it again, once this one has gone -- after
        the data has moved, so everything starts from the new folder."""
        cmd = ('while kill -0 %d 2>/dev/null; do sleep 0.3; done; sleep 0.5; exec "$0" show'
               % os.getpid())
        try:
            subprocess.Popen(["sh", "-c", cmd, quick_script()], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError as e:
            return {"error": str(e)}
        # Closed from a thread of its own, after this call has answered:
        # destroy() from inside a call the page is still waiting on hangs
        # the Qt window (seen 2026-09-30). If the window hasn't gone in five
        # seconds, NeuroNet ends anyway -- everything is saved by now.
        window = self._window

        def close():
            import time
            time.sleep(0.4)
            try:
                window.destroy()
            except Exception:
                pass
            time.sleep(5)
            os._exit(0)
        threading.Thread(target=close, name="neuronet-restart", daemon=True).start()
        return {"ok": True}

    def welcome_state(self):
        """Should the welcome show? On a computer where NeuroNet has no data
        yet, and the welcome hasn't been answered."""
        return {"show": welcome_wanted()}

    def welcome_done(self, how="fresh"):
        """The welcome answered: "fresh" (start with nothing) or "imported"."""
        welcome_mark_done(str(how or "fresh"))
        return {"ok": True}
