"""NeuroNet's backend: personal effects (M&T inventories).

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class EffectsApi:
    # ---- PERSONAL EFFECTS ---------------------------------------------
    #
    # Cam: "a new sub section under the home main section ... called
    # Personal Effects. This should be a data base where i can add new
    # item."
    #
    # ONE FILE, not one per item. A DVD is a title and a type -- a few
    # dozen bytes -- and a collection of a few thousand is still smaller
    # than one photograph. Boards and sheets get a file each because any
    # one of them can be large and is opened on its own; this is a list,
    # always read whole, and a folder of four thousand tiny files would
    # be slower and far easier to half-lose.

    def export_formats(self):
        """What this machine can write out. HTML always."""
        out = {"html": True, "docx": False, "pdf": False}
        try:
            import docx  # noqa: F401
            out["docx"] = True
        except ImportError:
            pass
        for mod in ("reportlab", "weasyprint"):
            try:
                __import__(mod)
                out["pdf"] = True
                break
            except ImportError:
                pass
        return out

    def export_document(self, name, html, fmt="html"):
        """Any module's finished HTML, onto the desktop.

        Added for the Kitchen's book export, which was one of five calls
        the cookery merge left pointing at nothing. Deliberately generic:
        a name, some HTML and a format is the whole of what every export
        in the app needs, and there were already two private copies of
        this (notebooks_export and effects_export). Those are left alone
        rather than rewired in the middle of fixing a bug -- changing two
        working exports while repairing a third is how you end up with
        three broken ones -- but this is the one new code should use.
        """
        base = "".join(c for c in str(name or "Document")
                       if c not in '\\/:*?"<>|').strip() or "Document"
        html = str(html or "")
        if not html:
            return {"error": "There is nothing to export."}
        fmt = (fmt or "html").lower()
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

    def print_header(self, title, opts=None):
        """The shared letterhead, for a module that builds its page in JS.

        Cam: "If the application can handle all printouts like this it will
        help keep consistency (like a styled page header)."

        Built in Python and handed across the bridge rather than written a
        second time in JavaScript. Two copies of one letterhead is two
        things that must agree forever, and they stop agreeing the first
        time someone nudges a colour on one side -- which is the problem
        Cam is asking to be rid of, not a new place to reintroduce it.
        """
        import print_header as ph
        opts = opts or {}
        try:
            return ph.header_html(
                title,
                subtitle=opts.get("subtitle") or "",
                right_logo=opts.get("logo") or None,
                right_name=opts.get("name") or "",
                meta=opts.get("meta") or "")
        except Exception:
            # A page without a letterhead still prints. One that fails to
            # build does not, and the thing Cam actually wanted was the list.
            return ""

    def print_house_css(self):
        """The house style every printout shares (print_header.HOUSE_CSS), for a
        module that builds its page in JS -- written once, in Python, like the
        letterhead (Cam, 2026-10-05: "I would like all printouts from Neuronet to
        be handled in this way")."""
        import print_header as ph
        return ph.HOUSE_CSS

    def effects_file(self):
        return os.path.join(data_dir(), "personal_effects.json")

    def effects_load(self):
        """The whole database. Missing or unreadable is an EMPTY one, never
        an error: a first run has no file, and that is not a fault."""
        path = self.effects_file()
        if not os.path.isfile(path):
            doc = {"items": [], "types": []}
            self._albums_onto_shelf(doc, path)
            return doc
        try:
            with open(path, "r", encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            # A file that cannot be read is NOT replaced with a blank one.
            # Saving over it is how a collection gets lost to a stray byte.
            return {"items": [], "types": [], "error":
                    "Couldn't read your Personal Effects file (%s). It has "
                    "been left exactly as it is." % e}
        if not isinstance(doc, dict):
            return {"items": [], "types": [], "error":
                    "The Personal Effects file isn't in the expected shape. "
                    "It has been left exactly as it is."}
        doc.setdefault("items", [])
        doc.setdefault("types", [])
        if not doc.get("albumsOnShelf"):
            self._albums_onto_shelf(doc, path)
        if doc.get("mediaVersion", 1) < 2:
            self._media_v2(doc, path)
        if doc.get("mediaVersion", 1) >= 2 and not doc.get("moviesAdopted"):
            self._adopt_movies(doc, path)
        return doc

    def _adopt_movies(self, doc, path):
        """Once (14 Nov 2026): the Movies folder's films into Media, tagged
        Digital and linked (media_shelf.adopt_movies), so Cinema's own page can
        go and every film plays from its Play."""
        import media_shelf as ms
        import cinema
        data = os.path.dirname(path)        # where the Media file is (a test's scratch folder in tests)
        try:
            root = self._media_movies_root()
            films = ms.list_films(root) if root and os.path.isdir(root) else []
            backup = path + ".before-movies-adopted"
            if os.path.isfile(path) and not os.path.exists(backup):
                shutil.copy2(path, backup)
            got = ms.adopt_movies(doc, films, root,
                                  link=lambda i, p: cinema.link(data, i, p),
                                  cover=lambda i, p: ms.cover_from_film(data, i, p),
                                  new_id=lambda: "e" + uuid.uuid4().hex[:12],
                                  now=datetime.datetime.now().isoformat(timespec="seconds"))
            saved = self.effects_save(doc)
            if saved.get("error"):
                doc.pop("moviesAdopted", None)
                return
            _log_line("Movies folder into Media: %(added)d added, %(joined)d already there (tagged Digital, linked)" % got)
        except Exception as e:
            doc.pop("moviesAdopted", None)
            _log_line("Movies into Media failed: %s" % e)

    def _media_movies_root(self):
        """The Movies folder the one-off adoption reads (tests point it away
        from Cam's real films)."""
        import media_shelf as ms
        return ms.movies_dir(app_dir(), create=False)

    def _media_v2(self, doc, path):
        """Once (14 Nov 2026): Media by type with format tags, double-ups
        merged (media_shelf.media_v2). The file as it was is kept beside it."""
        import media_shelf as ms
        import cinema
        data = os.path.dirname(path)
        try:
            backup = path + ".before-media-v2"
            if os.path.isfile(path) and not os.path.exists(backup):
                shutil.copy2(path, backup)
            got = ms.media_v2(doc, data, cinema.load_links(data))
            saved = self.effects_save(doc)
            if saved.get("error"):
                return
            if got["links"] != cinema.load_links(data):
                cinema._write_links(data, got["links"])
            _log_line("Media v2: %(converted)d items given a type and format, %(merged)d double-ups merged" % got)
        except Exception as e:
            doc.pop("mediaVersion", None)
            _log_line("Media v2 failed: %s" % e)

    def _albums_onto_shelf(self, doc, path):
        """Once (2026-10-02): every album in Music onto the shelf as a CD, with
        its cover and songs (media_shelf.albums_onto_shelf). Done here, as the
        list is first read, so no page holds an older copy to save over it.
        The file as it was is kept beside it first."""
        import media_shelf as ms
        # Reading must make nothing: chords_dir() creates the Music folder (and
        # data_dir() can make a data folder), so look beside the Media file
        # first -- with no Music there (a new computer) there's nothing to add.
        if not os.path.isdir(os.path.join(os.path.dirname(path), "chords")):
            return
        chords = read_json(chords_file(), {})
        if not (chords.get("albums") if isinstance(chords, dict) else None):
            return
        try:
            backup = path + ".before-albums-onto-shelf"
            if os.path.isfile(path) and not os.path.exists(backup):
                shutil.copy2(path, backup)
            now = datetime.datetime.now().isoformat(timespec="seconds")
            got = ms.albums_onto_shelf(doc, chords, data_dir(), music_images_dir(), now,
                                       lambda: "e" + uuid.uuid4().hex[:12])
            saved = self.effects_save(doc)
            if saved.get("error"):
                doc.pop("albumsOnShelf", None)
                return
            _log_line("Music's albums onto the shelf: %(new)d new CDs, %(linked)d linked" % got)
        except Exception as e:
            doc.pop("albumsOnShelf", None)
            _log_line("albums onto the shelf failed: %s" % e)

    def effects_save(self, doc):
        """Written whole, through a temporary file and a rename.

        A half-written collection is worse than an old one: the app would
        open on a file that stops mid-item and read as though most of it
        had gone. A rename on one disk is atomic, so the file on disk is
        always one complete version or the other.
        """
        if not isinstance(doc, dict):
            return {"error": "Nothing to save."}
        path = self.effects_file()
        # Keys the page doesn't send (albumsOnShelf, the once-only flag) are
        # kept from the file as it is; only items and types come from the page.
        keep = {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                old = json.load(f)
            if isinstance(old, dict):
                keep = {k: v for k, v in old.items() if k not in ("items", "types")}
        except (OSError, ValueError):
            pass
        keep.update({k: v for k, v in doc.items() if k not in ("items", "types")})
        doc = dict(keep, items=doc.get("items") or [], types=doc.get("types") or [])
        tmp = path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            return {"ok": True}
        except OSError as e:
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except OSError:
                pass
            return {"error": "Couldn't save Personal Effects: %s" % e}
