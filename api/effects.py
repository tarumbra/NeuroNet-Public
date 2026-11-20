"""NeuroNet's backend: exports and the printouts' letterhead (Media, the old Personal Effects, went to NeuroStream's My Media, 19 Nov 2026).

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
