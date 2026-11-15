"""NeuroNet's backend: Scribe > Collaboration -- Cam and Claude's shared desk (2026-10-15). The rules are collab.py.

Part of neuronet.py's Api, run in its namespace (load_api_parts), like the other api/ parts.
"""
# flake8: noqa


class CollabApi:
    def collab_list(self):
        try:
            return collab.listing()
        except OSError as e:
            return {"error": f"Couldn't read the collaboration desk: {e}"}

    def collab_get(self, ref):
        return collab.get(ref)

    def collab_new(self, typ, title="", project=""):
        try:
            d = collab.new(str(typ or ""), str(title or "")[:200], str(project or "")[:120], "cam")
            collab.mark_seen([d["ref"]])                     # (Cam's own: never new to him)
            return d
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def collab_save(self, doc):
        try:
            d = collab.save(doc)
            collab.mark_seen([d["ref"]])                     # (his own change: seen)
            return d
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    # what's new to Cam (I20): the dots and counts in the app; opening one (or "Mark all seen") clears it
    def collab_fresh(self):
        try:
            return collab.fresh()
        except OSError as e:
            return {"error": str(e)}

    def collab_seen(self, refs):
        try:
            return collab.mark_seen([str(r) for r in (refs if isinstance(refs, list) else [refs])][:500])
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    # pictures on an item (2026-10-21, PT49): pasted or picked; checked and kept by collab.py
    def collab_picture_add(self, ref, item, data_url):
        try:
            return collab.add_picture(str(ref or ""), str(item or ""), data_url)
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def collab_picture(self, name):
        try:
            return collab.picture(str(name or ""))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def collab_picture_remove(self, name):
        try:
            return collab.remove_picture(str(name or ""))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def collab_delete(self, ref):
        try:
            return collab.remove(str(ref or ""))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    # projects (2026-10-17): like the Notes app's vaults
    def collab_projects(self):
        try:
            return collab.projects()
        except OSError as e:
            return {"error": f"Couldn't read the projects: {e}"}

    def collab_project_new(self, name):
        try:
            return collab.new_project(str(name or ""))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def collab_project_rename(self, old, name):
        try:
            return collab.rename_project(str(old or ""), str(name or ""))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def collab_project_use(self, name):
        try:
            return collab.set_active_project(str(name or ""))
        except (ValueError, OSError) as e:
            return {"error": str(e)}
