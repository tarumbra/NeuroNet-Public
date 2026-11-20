"""NeuroNet's backend: the quick popup's own calls, and meditation.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.

The music (Chords) left NeuroNet on 19 Nov 2026 for NeuroStream (V31, Cam: "remove them from Neuronet
completely"). Its files stay where they were (<data>/chords/music); NeuroStream plays them from there.
"""
# flake8: noqa


class MusicApi:
    def app_bus_ready(self):
        """The page is up (app.js): commands that came over the bus before it was (neuronet-quick, a bar
        widget) run now. Before the music left, the music player's first report did this."""
        if _mpris is not None:
            _mpris.ready()
        return None

    def quick_full(self):
        """The "Full NeuroNet" button of the quick popup: back to a normal
        window, the whole app (neuronet-quick does the moving). `show`, not
        `full`: from the popup it must never toggle NeuroNet away."""
        return _run_quick("show")

    def board_done(self, token, result):
        """The page's answer to a desktop widget's request (mpris.py, Do)."""
        if _mpris is not None:
            _mpris.finish(token, result)
        return None

    def quick_hide(self):
        """Put the quick popup away."""
        return _run_quick("hide")

    # -- meditation ----------------------------------------------------
    def meditation_list(self):
        return list_meditation_files()

    def meditation_import(self):
        """Cam picks files; they are COPIED on disk, never read into the
        page. The native dialog hands back real paths, so a 400 MB video
        never touches the JS bridge."""
        import webview
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("Audio and video (*.mp3;*.wav;*.flac;*.ogg;*.opus;"
                        "*.m4a;*.aac;*.wma;*.aiff;*.mp4;*.webm;*.mov;"
                        "*.m4v;*.ogv;*.mkv)", "All files (*.*)"))
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, str):
            picked = [picked]

        added, skipped = [], []
        for src in picked:
            name = os.path.basename(str(src))
            if not str(src).lower().endswith(MEDIA_EXTS):
                skipped.append({"name": name,
                                "why": "not an audio or video file this app "
                                       "recognises"})
                continue
            final = dedupe_media_name(name)
            try:
                shutil.copy2(src, os.path.join(meditation_dir(), final))
            except OSError as e:
                skipped.append({"name": name, "why": str(e)})
                continue
            entry = {"file": final,
                     "kind": "video" if is_video_file(final) else "audio"}
            entry.update(probe_media_meta(final))
            added.append(entry)
        return {"added": added, "skipped": skipped}

    def meditation_media_url(self, name):
        """A real streaming URL for an <audio> or <video> element.

        http:// from the loopback server when one could be started, so
        the browser gets byte ranges and can seek. A file:// URI as the
        fallback, so playback still TRIES rather than refusing outright
        -- it works for some formats even under WebKitGTK.
        """
        path = safe_media_path("meditation", str(name))
        if not path:
            return {"error": "That file isn't in the meditation folder."}
        if ensure_media_server():
            url = media_url_for("meditation", name)
            if url:
                return {"url": url, "streamed": True,
                        "kind": "video" if is_video_file(name) else "audio"}
        from pathlib import Path
        return {"url": Path(path).resolve().as_uri(), "streamed": False,
                "kind": "video" if is_video_file(name) else "audio"}

    def meditation_probe_meta(self, name):
        return probe_media_meta(str(name))

    def meditation_remove(self, name, delete_file=False):
        """Removes it from the list, and from disk only if asked.

        The default is to forget it rather than delete it. These are
        Cam's own recordings -- possibly his only copy -- and a list
        that tidies itself must not be able to destroy them.
        """
        if not delete_file:
            return {"ok": True}
        path = safe_media_path("meditation", str(name))
        if not path:
            return {"error": "That file isn't in the meditation folder."}
        try:
            os.remove(path)
        except OSError as e:
            return {"error": f"Couldn't delete that file: {e}"}
        return {"ok": True}
