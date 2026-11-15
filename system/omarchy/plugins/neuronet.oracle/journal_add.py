#!/usr/bin/env python3
"""Save a pull from the NeuroNet Tarot bar tool into NeuroNet's Journal.

Reads one JSON object on stdin -- {app, kind, deckName, card: {name, image,
reversed, meaning}, text} -- and adds it with NeuroNet's own journal.py
(add_reading), exactly as a pull saved inside NeuroNet is: the card face
is copied into the journal, so the entry keeps it whatever happens to the
deck later. journal.py reads and writes journal.json per call, so this is
safe with NeuroNet open or closed. Prints {"ok": true} or {"error": ...}.
Text arrives on stdin, never on the command line.
"""
import json
import os
import sys


def where():
    """This computer's NeuroNet, from ~/.config/neuronet/paths.json (written
    by neuronet-setup -- Stage 1, 2026-09-29). -> (app, data)"""
    try:
        with open(os.path.expanduser("~/.config/neuronet/paths.json")) as f:
            conf = json.load(f)
    except (OSError, ValueError):
        conf = {}
    app = conf.get("app") or ""
    return app, conf.get("data") or (os.path.join(app, "neuronet_data") if app else "")


def main():
    req = json.load(sys.stdin)
    app, data = where()
    app = req.get("app") or app
    if not app:
        print(json.dumps({"error": "Can't find NeuroNet -- run neuronet-setup."}))
        return
    sys.path.insert(0, app)
    import journal
    journal.DATA_DIR_PROVIDER = lambda: data
    c = req.get("card") or {}
    reading = {
        "kind": req.get("kind") or "tarot",
        "deckName": req.get("deckName") or "",
        "spreadName": "Daily card",
        "cards": [{
            "name": c.get("name") or "",
            "image": c.get("image") or None,
            "reversed": bool(c.get("reversed")),
            "positionLabel": "",
            "meaning": c.get("meaning") or "",
        }],
    }
    res = journal.add_reading(reading, text=req.get("text") or "",
                              cards_images_dir=os.path.join(data, "cards", "images"))
    print(json.dumps({"ok": True} if res.get("ok") else {"error": res.get("error") or "Couldn't save it."}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:                     # the bar shows this line
        print(json.dumps({"error": str(e)}))
