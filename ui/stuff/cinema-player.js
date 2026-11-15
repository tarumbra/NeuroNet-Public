/* ==========================================================================
   Cinema's own player (14 Nov 2026).
   ==========================================================================
   Cam: "Is there a way to have the film or show play inside of the app with
   its own player please, it just needs to be simple with pause, play,
   ability to click a spot in the time line, FF, RR, closed captions, A
   settings cog which has the CC and the ability to upload subtitles for the
   movie, also a seamless way to enter full screen mode or theatre mode
   (think like youtubes theatre feature. Also split screen capability".

   The film arrives converted live (cinema.py: H.264/AAC from the loopback
   server, on the NVIDIA card). A live stream can't be scrubbed inside, so the
   timeline is the player's own: the stream starts at `offset` seconds, the
   time shown is offset + the video's own clock, and a click, a skip or a key
   starts the stream again at the new time (about a second).

   CAPTIONS are drawn by the player too (a <track> would be timed from the
   stream's start, not the film's): the chosen track's WebVTT is parsed once
   and the right line shown as the clock moves.

   SPLIT VIEW: everything lives inside the page it was opened in, and the keys
   only work while the player has focus, so in Multitask a film plays on one
   side while Scribe takes the keyboard on the other. THEATRE fills the pane
   it's in, dark, the YouTube way; FULL SCREEN fills the screen (Escape, or
   the button, comes back).

   Nothing runs once it closes: the video is emptied (the server stops the
   conversion when the connection drops, and cinema_stop makes sure), and the
   one timer (saving the place every 15 s) stops with it.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Cinema");
  const toast = (m, k) => SS.shared.toast(m, k);
  const SKIP = 10;
  const PREF = "nn:cinema:theatre";

  const fmt = (sec) => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
  };

  /* WebVTT -> [{start, end, text}] (cue settings and styling tags dropped) */
  function parseVtt(text) {
    const cues = [];
    const t = (s) => {
      const p = s.trim().split(":").map(Number);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    };
    for (const block of String(text || "").replace(/\r/g, "").split(/\n\n+/)) {
      const lines = block.split("\n");
      const i = lines.findIndex((l) => l.includes("-->"));
      if (i < 0) continue;
      const [a, b] = lines[i].split("-->");
      const body = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
      if (body) cues.push({start: t(a), end: t(b.trim().split(/\s+/)[0]), text: body});
    }
    return cues;
  }

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18V6l-8.5 6zm.5-6l8.5 6V6z" fill="currentColor"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 6v12l8.5-6zM4 18l8.5-6L4 6z" fill="currentColor"/></svg>',
    cc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 10.2a2.5 2.5 0 1 0 0 3.6M17 10.2a2.5 2.5 0 1 0 0 3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    cog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    theatre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    unfull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  /** Open the player in `host` (the Cinema page). items: [{path, label}],
      the queue; it starts at items[index]. onClose(): back to the library. */
  function open(host, {items, index = 0, onClose, onWatched}) {
    let i = index, item = items[i], info = null;
    let offset = 0, cues = [], track = "", lastTrack = "", saving = 0, hideT = 0, seekT = 0, watchedSent = false;
    let theatre = false;
    try { theatre = localStorage.getItem(PREF) === "1"; } catch (e) { /* default */ }

    host.innerHTML = `
      <div class="cn-player${theatre ? " cn-theatre" : ""}" tabindex="0" aria-label="Video player">
        <div class="cn-topline">
          <button class="btn btn-quiet btn-sm" data-p="close">‹ Back</button>
          <b class="cn-ptitle"></b>
          <span class="spacer"></span>
          <button class="btn btn-quiet btn-sm" data-p="mpv" title="Play it in mpv instead">Open in mpv</button>
        </div>
        <div class="cn-stage">
          <video class="cn-video" playsinline preload="auto"></video>
          <div class="cn-cc" aria-live="off"></div>
          <div class="cn-wait" hidden>Loading…</div>
          <div class="cn-controls">
            <div class="cn-time" role="slider" tabindex="0" aria-label="Time in the film" aria-valuemin="0">
              <div class="cn-time-fill"></div><div class="cn-time-tip" hidden></div>
            </div>
            <div class="cn-ctl-row">
              <button class="cn-b" data-p="back" title="Back ${SKIP} seconds (←)" aria-label="Back ${SKIP} seconds">${ICON.back}</button>
              <button class="cn-b cn-b-big" data-p="play" title="Play / pause (Space)" aria-label="Play">${ICON.play}</button>
              <button class="cn-b" data-p="fwd" title="Forward ${SKIP} seconds (→)" aria-label="Forward ${SKIP} seconds">${ICON.fwd}</button>
              <span class="cn-clock">0:00 / 0:00</span>
              <span class="spacer"></span>
              <button class="cn-b" data-p="cc" title="Captions (C)" aria-label="Captions" aria-pressed="false">${ICON.cc}</button>
              <button class="cn-b" data-p="cog" title="Settings" aria-label="Settings" aria-expanded="false">${ICON.cog}</button>
              <button class="cn-b" data-p="theatre" title="Theatre (T)" aria-label="Theatre mode" aria-pressed="${theatre}">${ICON.theatre}</button>
              <button class="cn-b" data-p="full" title="Full screen (F)" aria-label="Full screen">${ICON.full}</button>
            </div>
          </div>
          <div class="cn-settings" hidden role="dialog" aria-label="Player settings"></div>
        </div>
      </div>`;
    const root = host.querySelector(".cn-player");
    const video = root.querySelector("video");
    const ccEl = root.querySelector(".cn-cc");
    const bar = root.querySelector(".cn-time");
    const fill = root.querySelector(".cn-time-fill");
    const tip = root.querySelector(".cn-time-tip");
    const clock = root.querySelector(".cn-clock");
    const wait = root.querySelector(".cn-wait");
    const settings = root.querySelector(".cn-settings");
    const btn = (p) => root.querySelector(`[data-p="${p}"]`);

    const now = () => offset + (video.currentTime || 0);
    const dur = () => (info && info.duration) || 0;
    const paint = () => {
      const t = now(), d = dur();
      fill.style.width = d ? Math.min(100, t / d * 100) + "%" : "0";
      clock.textContent = `${fmt(t)} / ${fmt(d)}`;
      bar.setAttribute("aria-valuenow", String(Math.round(t)));
      bar.setAttribute("aria-valuetext", fmt(t));
      if (cues.length) {
        const c = cues.find((x) => t >= x.start && t <= x.end);
        const txt = c ? c.text : "";
        if (ccEl.textContent !== txt) ccEl.textContent = txt;
      }
    };
    const playIcon = () => {
      const b = btn("play");
      b.innerHTML = video.paused ? ICON.play : ICON.pause;
      b.setAttribute("aria-label", video.paused ? "Play" : "Pause");
    };

    function startAt(t) {
      offset = Math.max(0, Math.min(t, Math.max(0, dur() - 1)));
      wait.hidden = false;
      video.src = `${info.stream}?t=${offset.toFixed(2)}`;
      video.play().catch(() => {});
      paint();
    }
    /* clicks, skips and held keys settle first, then one new stream */
    function seek(t) {
      offset = Math.max(0, Math.min(t, Math.max(0, dur() - 1)));
      video.pause();
      try { video.currentTime = 0; } catch (e) { /* not yet */ }
      paint();
      clearTimeout(seekT);
      seekT = setTimeout(() => startAt(offset), 250);
    }
    function save() {
      if (!item || !info) return;
      const t = now();
      call("cinema_position", [item.path, t], "Saving your place");
      if (!watchedSent && dur() && t / dur() >= 0.92) {
        watchedSent = true;
        call("cinema_mark", [item.path, true], "Saving").then((r) => { if (r && r.watched && onWatched) onWatched(r.watched); });
      }
    }

    async function load(k) {
      i = k; item = items[i];
      watchedSent = false; cues = []; ccEl.textContent = "";
      root.querySelector(".cn-ptitle").textContent = item.label;
      info = await call("cinema_open", [item.path], "Opening");
      if (!root.isConnected) return;
      if (!info || info.error) {
        toast((info && info.error) || "That couldn't be opened.", "error");
        return;
      }
      if (lastTrack && info.subtitles.some((s) => s.id === lastTrack)) setTrack(lastTrack);
      else if (track) setTrack("");
      const resume = info.resume && dur() && info.resume < dur() * 0.95 ? Math.max(0, info.resume - 3) : 0;
      startAt(resume);
      paintSettings();
    }

    async function setTrack(id) {
      track = id;
      if (id) lastTrack = id;
      btn("cc").setAttribute("aria-pressed", String(!!id));
      btn("cc").classList.toggle("on", !!id);
      cues = [];
      ccEl.textContent = "";
      if (id) {
        const r = await call("cinema_subtitle", [item.path, id], "Captions");
        cues = parseVtt(r && r.vtt);
        if (!cues.length) toast("That caption track is empty.", "warn");
      }
      paintSettings();
      paint();
    }

    function paintSettings() {
      const subs = (info && info.subtitles) || [];
      settings.innerHTML = `
        <div class="cn-set-h">Captions</div>
        <label class="cn-set-row"><input type="radio" name="cn-cc" value="" ${track ? "" : "checked"}> Off</label>
        ${subs.map((s) => `<label class="cn-set-row"><input type="radio" name="cn-cc" value="${esc(s.id)}"
            ${track === s.id ? "checked" : ""}> ${esc(s.label)}</label>`).join("")}
        ${subs.length ? "" : `<p class="stamp">This film has no caption tracks.</p>`}
        <button class="btn btn-sm" data-p="upload">Upload subtitles…</button>`;
      settings.querySelectorAll('input[name="cn-cc"]').forEach((r) =>
        r.addEventListener("change", () => setTrack(r.value)));
      settings.querySelector('[data-p="upload"]').onclick = async () => {
        const r = await call("cinema_subtitle_upload", [item.path], "Adding subtitles");
        if (!r || r.cancelled) return;
        if (r.error) { toast(r.error, "error"); return; }
        info.subtitles = r.subtitles;
        const added = r.subtitles.find((s) => s.label.startsWith(r.name));
        await setTrack(added ? added.id : track);
        toast("Subtitles added.", "good");
      };
    }

    function toggleTheatre() {
      theatre = !root.classList.contains("cn-theatre");
      root.classList.toggle("cn-theatre", theatre);
      btn("theatre").setAttribute("aria-pressed", String(theatre));
      try { localStorage.setItem(PREF, theatre ? "1" : "0"); } catch (e) { /* session only */ }
    }
    function toggleFull() {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else root.requestFullscreen().catch(() => toast("Full screen isn't available here.", "warn"));
    }
    const onFs = () => {
      const on = document.fullscreenElement === root;
      root.classList.toggle("cn-full", on);
      btn("full").innerHTML = on ? ICON.unfull : ICON.full;
    };
    document.addEventListener("fullscreenchange", onFs);

    function showControls() {
      root.classList.remove("cn-idle");
      clearTimeout(hideT);
      hideT = setTimeout(() => { if (!video.paused && settings.hidden) root.classList.add("cn-idle"); }, 2500);
    }

    function close() {
      save();
      clearInterval(saving);
      clearTimeout(hideT); clearTimeout(seekT);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
      video.pause();
      video.removeAttribute("src");
      video.load();
      call("cinema_stop", [], "Stopping");
      if (onClose) onClose();
    }

    /* ---- wiring ---- */
    video.addEventListener("timeupdate", paint);
    video.addEventListener("playing", () => { wait.hidden = true; playIcon(); showControls(); });
    video.addEventListener("waiting", () => { wait.hidden = false; });
    video.addEventListener("pause", () => { playIcon(); root.classList.remove("cn-idle"); save(); });
    video.addEventListener("ended", () => {
      save();
      if (offset + (video.duration || 0) < dur() - 5) return;   // the stream broke off early, not the film
      if (i + 1 < items.length) load(i + 1); else playIcon();
    });
    video.addEventListener("error", () => {
      wait.hidden = true;
      if (video.getAttribute("src")) toast("The player couldn't play this. Open in mpv still will.", "error");
    });
    video.addEventListener("click", () => { if (video.paused) video.play(); else video.pause(); });
    video.addEventListener("dblclick", toggleFull);
    root.addEventListener("mousemove", showControls);

    btn("play").onclick = () => { if (video.paused) video.play().catch(() => {}); else video.pause(); };
    btn("back").onclick = () => seek(now() - SKIP);
    btn("fwd").onclick = () => seek(now() + SKIP);
    btn("cc").onclick = () => setTrack(track ? "" : (lastTrack || ((info && info.subtitles[0]) || {}).id || ""));
    btn("cog").onclick = () => {
      settings.hidden = !settings.hidden;
      btn("cog").setAttribute("aria-expanded", String(!settings.hidden));
    };
    btn("theatre").onclick = toggleTheatre;
    btn("full").onclick = toggleFull;
    btn("close").onclick = close;
    btn("mpv").onclick = async () => {
      const at = now();
      await call("cinema_position", [item.path, at], "Saving your place");
      video.pause();
      const r = await call("cinema_play", [[item.path]], "Playing");
      if (r && r.error) toast(r.error, "error");
      else toast(`Playing in ${r.player}. It carries on from where mpv last stopped.`, "good");
    };
    const at = (e) => {
      const r = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur();
    };
    bar.addEventListener("click", (e) => seek(at(e)));
    bar.addEventListener("mousemove", (e) => {
      tip.hidden = false;
      tip.textContent = fmt(at(e));
      tip.style.left = Math.max(0, Math.min(bar.clientWidth, e.clientX - bar.getBoundingClientRect().left)) + "px";
    });
    bar.addEventListener("mouseleave", () => { tip.hidden = true; });

    /* keys: only while the player has focus (split view's other side keeps its own) */
    root.addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea, select") || e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") { e.preventDefault(); btn("play").click(); }
      else if (k === "arrowleft" || k === "j") { e.preventDefault(); seek(now() - SKIP); }
      else if (k === "arrowright" || k === "l") { e.preventDefault(); seek(now() + SKIP); }
      else if (k === "f") { e.preventDefault(); toggleFull(); }
      else if (k === "t") { e.preventDefault(); toggleTheatre(); }
      else if (k === "c") { e.preventDefault(); btn("cc").click(); }
      else if (k === "escape" && !settings.hidden) { settings.hidden = true; }
      else return;
      showControls();
    });

    /* the place is saved every 15 s while open; the timer ends when the
       player does (closed, or its page replaced by another) */
    saving = setInterval(() => {
      if (!root.isConnected) { clearInterval(saving); document.removeEventListener("fullscreenchange", onFs); return; }
      if (!video.paused) save();
    }, 15000);

    root.focus();
    load(i);
    return {close, _test: {parseVtt, fmt, get offset() { return offset; }, seek, now}};
  }

  SS.CinemaPlayer = {open, _test: {parseVtt, fmt}};
})();
