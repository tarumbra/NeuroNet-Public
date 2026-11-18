#!/usr/bin/env python3
"""NeuroArcana -- the tarot card battle game, in its own window, on every NeuroNet computer.

The game is its own project (~/Work/NeuroArcana, an Electron app); NeuroNet carries a copy of its page so it plays
everywhere NeuroNet does (Cam, 1 Nov 2026). A pywebview window on ui/neuroarcana.html; the page's one bridge,
AAStore.call(name, args), comes here (Api.call) instead of to Electron. The saves are the same files either way
(arcana_store.py). On Super+Alt+Y.

    neuroarcana [--gui qt]
"""
import os
import sys

import lite               # Lite mode: lighter on a small computer or on battery
import neuronet as nn      # the app folders and the Qt hardening
import arcana_store as store
import arcana_lan

LAN = arcana_lan.Lan()       # play on the home network (Cam, 1 Nov 2026): trading and duels

APP_NAME = "NeuroArcana"


def page_dir():
    return nn.ui_dir()


def art_dir():
    d = os.path.join(page_dir(), "arcana-art")
    return d if os.path.isdir(d) else os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "arcana-art")


class Api:
    """What the page may ask for -- the Electron shell's list (shell/main.js CALLS). Anything else is refused."""

    def call(self, name, args=None):
        args = args if isinstance(args, list) else []
        a = (args + [None, None])[:2]
        try:
            if name == "hello":
                return {"version": "neuronet"}
            if name == "load":
                return store.load()
            if name == "save":
                return store.save(a[0])
            if name == "catalogue":
                return store.catalogue(art_dir())
            if name == "profiles":
                return store.profiles()
            if name == "profile_use":
                return store.profile_use(str(a[0] or ""))
            if name == "profile_new":
                return store.profile_new(a[0])
            if name == "profile_edit":
                return store.profile_edit(str(a[0] or ""), a[1])
            if name == "profile_delete":
                return store.profile_delete(str(a[0] or ""))
            if name == "profile_load":
                pid = str(a[0] or "")
                return store.load(pid) if any(p["id"] == pid for p in store.profiles()["list"]) else {"error": "There's no such save."}
            if name == "ach_get":
                return store.ach_get()
            if name == "ach_add":
                return store.ach_add(str(a[0] or ""), a[1])
            if name == "codex_get":
                return store.codex_get()
            if name == "codex_set":
                return store.codex_set(a[0])
            if name == "codex_reset":
                return store.codex_reset()
            if name == "lan_status":
                return LAN.status()
            if name == "lan_me":
                return LAN.set_me(a[0])
            if name == "lan_host":
                return LAN.host(bool(a[0]))
            if name == "lan_scan":
                return LAN.scan(a[0][:8] if isinstance(a[0], list) else [])
            if name == "lan_join":
                return LAN.join(str(a[0] or ""))
            if name == "lan_leave":
                return LAN.leave(False)
            if name == "lan_send":
                return LAN.send(a[0])
            if name == "lan_inbox":
                return LAN.inbox_since(a[0])
            if name == "music":
                return {"songs": []}
            if name in ("music_folder", "zoom"):
                return {"ok": True}
            return {"error": "The game can't ask for that."}
        except Exception as e:      # never take the window down
            return {"error": str(e)}


def main():
    argv = sys.argv[1:]
    gui = None
    for i, arg in enumerate(argv):
        if arg == "--gui" and i + 1 < len(argv):
            gui = argv[i + 1]
        elif arg.startswith("--gui="):
            gui = arg.split("=", 1)[1]
    nn.prefer_integrated_gpu()
    lite.apply_flags()         # Lite mode (lite.py): reduced motion asked for before Qt WebEngine starts
    try:
        import webview
    except ImportError:
        nn.fatal("NeuroArcana needs pywebview.\n\n    pip install pywebview\n")
    index = os.path.join(page_dir(), "neuroarcana.html")
    if not os.path.isfile(index):
        nn.fatal(f"NeuroArcana can't find its game. Expected:\n  {index}")
    window = webview.create_window(APP_NAME, index, js_api=Api(), width=1360, height=880, min_size=(360, 520), background_color="#0b0820")
    lite.attach(window)        # and its stylesheet put in as the page loads
    if gui == "qt":
        nn.fix_qt_permissions()
        nn.lock_qt_navigation(page_dir())
        try:
            from PyQt6.QtGui import QGuiApplication
            QGuiApplication.setDesktopFileName(os.environ.get("NEURONET_APP_ID") or "NeuroArcana")
        except Exception:
            pass
    try:
        from gi.repository import GLib
        GLib.set_prgname(os.environ.get("NEURONET_APP_ID") or "NeuroArcana")
    except Exception:
        pass
    try:
        webview.start(gui=gui) if gui else webview.start()
    finally:
        LAN.stop()


if __name__ == "__main__":
    main()
