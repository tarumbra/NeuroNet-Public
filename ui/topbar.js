/* ==========================================================================
   The top bar's clock (moved out of the music code, chords.js, when the
   music left NeuroNet for NeuroStream on 19 Nov 2026, V31).
   ==========================================================================
   The clock fits itself to the bar: each tick tries the full form first and
   steps down only if the bar actually overflows -- measured, not guessed from
   a width -- and steps back up when room returns.

   Ticking without leaking (the memory-leak fix, 2026-09-29; the performance
   audit, 3 Nov 2026): the one text node is rewritten in place, the fit is
   measured again only when the text's length changes or once a minute, the
   formatters are made once (toLocaleString with options left ~47 KB behind
   each call in QtWebEngine), and the second hand only runs while NeuroNet is
   the window in front: hidden, nothing; behind another, once a minute.
   ========================================================================== */
(() => {
  "use strict";
  const FORMS = [
    {weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit"},
    {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"},
    {hour: "numeric", minute: "2-digit"},
  ];
  const WITH_SECONDS = FORMS.map((o) => new Intl.DateTimeFormat(undefined, o));
  const MINUTES = FORMS.map((o) => { const c = Object.assign({}, o); delete c.second; return new Intl.DateTimeFormat(undefined, c); });
  let focused = true, minuteShown = -1, form = 0, len = -1, measured = 0;

  function paint() {
    const el = document.getElementById("ch-top-bar-clock");
    if (!el) return;
    const bar = document.getElementById("ch-top-bar");
    const now = new Date();
    const write = (s) => {
      if (el.firstChild && el.firstChild.nodeType === 3 && !el.firstChild.nextSibling) {
        if (el.firstChild.nodeValue !== s) el.firstChild.nodeValue = s;
      } else {
        el.textContent = s;
      }
    };
    const FM = focused ? WITH_SECONDS : MINUTES;
    let text = FM[form].format(now);
    const shown = !!bar && bar.getClientRects().length > 0;
    if (shown && (text.length !== len || now - measured > 60000)) {
      measured = now;
      for (let i = 0; i < FORMS.length; i++) {
        text = FM[i].format(now);
        write(text);
        form = i;
        if (bar.scrollWidth <= bar.clientWidth + 1) break;
      }
      len = text.length;
      return;
    }
    write(text);
  }

  function start() {
    paint();
    setInterval(() => {
      if (document.hidden) return;
      /* Lite mode (lite.py, 17 Nov 2026): to the minute even in front */
      const front = document.hasFocus() && !(window.NNLite && NNLite.on), minute = Math.floor(Date.now() / 60000);
      if (!front && !focused && minute === minuteShown) return;       // (behind: once a minute)
      focused = front; minuteShown = minute;
      requestAnimationFrame(paint);
    }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once: true});
  else start();
})();
