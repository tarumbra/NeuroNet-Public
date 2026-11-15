"""NeuroNet's backend: music and meditation.

Part of neuronet.py's Api, in a file of its own (2026-10-06, the audit:
"split the Python backend by section"). It isn't imported: neuronet.py runs it
in its own namespace (load_api_parts), so every name here -- data_dir,
_picture, json, os, Api -- is neuronet.py's, exactly as when it was one file.
"""
# flake8: noqa


class MusicApi:
    # -- music (Chords) ------------------------------------------------
    # Chords' own method names were ALREADY namespaced -- chords_list,
    # chords_import, chords_audio_url -- so they are kept exactly as they
    # were and the JS did not have to change. Only its four genuinely
    # generic ones (read_json, write_json, image_url, thumb_url) needed
    # renaming, and those became music_*.
    def music_read_json(self, name):
        if name != "chords.json":
            return None
        return read_json(chords_file(), {})

    def music_write_json(self, name, data):
        if name != "chords.json":
            return {"error": "Unknown file."}
        try:
            atomic_write_json(chords_file(), data)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't save: {e}"}

    def music_image_url(self, name):
        return _art_data_url(name, full=True)

    def music_thumb_url(self, name, max_edge=None):
        """The small shared thumbnail, or -- given max_edge -- a copy made
        for exactly that size. max_edge used to be accepted and silently
        ignored, which is how the album cover ended up full size: asking
        for a smaller one did nothing."""
        if max_edge:
            try:
                edge = max(64, min(2048, int(max_edge)))
            except (TypeError, ValueError):
                edge = None
            if edge:
                return _art_data_url(name, full=False, edge=edge, as_url=True)
        return _art_data_url(name, full=False, as_url=True)

    def chords_list(self):
        out = []
        try:
            for n in sorted(os.listdir(music_dir())):
                if n.lower().endswith(AUDIO_EXTS):
                    out.append({"name": n,
                                "size": os.path.getsize(
                                    os.path.join(music_dir(), n))})
        except OSError:
            pass
        return out

    def chords_import(self):
        """Adds audio by PATH, never by bytes.

        pywebview's file dialog hands back filesystem paths, and the
        files are copied here. Reading a 400 MB lossless album into the
        page and back out over the bridge would cost several times its
        size in memory for no reason.
        """
        import webview
        picked = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True)
        if not picked:
            return {"cancelled": True}
        added, skipped = [], []
        for path in picked:
            if not str(path).lower().endswith(AUDIO_EXTS):
                skipped.append(os.path.basename(str(path)))
                continue
            final = dedupe_audio_name(os.path.basename(str(path)))
            try:
                shutil.copy2(path, os.path.join(music_dir(), final))
                added.append({"file": final})
            except OSError:
                skipped.append(os.path.basename(str(path)))
        return {"added": added, "skipped": skipped}

    def chords_audio_url(self, name):
        """The loopback media server's URL for one track."""
        path = safe_audio_path(name)
        if not path:
            return {"error": "That track isn't in the music folder."}
        info = ensure_media_server()
        if not info:
            url = audio_file_url(path)
            return {"url": url, "streamed": False} if url else \
                {"error": "Couldn't open a local media port."}
        return {"url": media_url_for("music", name), "streamed": True}

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

    def music_mpris_update(self, state):
        """What's playing, for the Linux media bus (see mpris.py). The page
        calls this on every change; it is a no-op until main() has put
        NeuroNet on the bus."""
        if _mpris is not None:
            _mpris.update(state)
        return None

    def music_assign_photo(self, stored_name, target_name):
        """Album art comes from the photo library, like everything else."""
        src = os.path.join(photos_dir(), os.path.basename(str(stored_name or "")))
        if not os.path.isfile(src):
            return {"error": "That photo isn't in the library any more."}
        stem = _safe_file_stem(target_name) or "album"
        ext = os.path.splitext(src)[1] or ".jpg"
        final, n = stem + ext, 2
        while os.path.exists(os.path.join(music_images_dir(), final)):
            final = "%s-%d%s" % (stem, n, ext)
            n += 1
        try:
            shutil.copy2(src, os.path.join(music_images_dir(), final))
        except OSError as e:
            return {"error": f"Couldn't copy that photo: {e}"}
        return {"name": final}

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
