/* ==========================================================================
   CF.Timer — turns a saved circuit into a running interval clock.

   A circuit already carries everything a timer needs: rounds, and per
   station a work time and a rest. Stations that specify reps instead of a
   work time can't be timed, so those become "tap when done" steps rather
   than being given an invented duration.

   Timing is driven off Date.now() rather than by counting setInterval
   ticks, because a backgrounded phone throttles timers and a counted clock
   silently drifts minutes behind over a long session.
   ========================================================================== */
CF.Timer = (() => {
  "use strict";

  /** "40 S", "30s", "1:30", "90" → seconds. Anything unparseable → 0. */
  function seconds(value) {
    if (value == null) return 0;
    const s = String(value).trim().toLowerCase();
    if (!s) return 0;

    const clock = s.match(/^(\d+):(\d{1,2})$/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

    const min = s.match(/^([\d.]+)\s*(?:m|min|mins|minutes)$/);
    if (min) return Math.round(Number(min[1]) * 60);

    const sec = s.match(/^([\d.]+)\s*(?:s|sec|secs|seconds)?$/);
    if (sec) return Math.round(Number(sec[1]));

    return 0;
  }

  function clock(total) {
    const t = Math.max(0, Math.round(total));
    const m = Math.floor(t / 60);
    return `${m}:${String(t % 60).padStart(2, "0")}`;
  }

  /** Flatten a circuit into the ordered list of steps it implies. */
  function buildSchedule(circuit) {
    const rounds = Math.max(1, parseInt(circuit.rounds, 10) || 1);
    const steps = [];
    for (let round = 1; round <= rounds; round++) {
      circuit.stations.forEach((station, i) => {
        const work = seconds(station.workTime);
        steps.push({
          kind: work ? "work" : "manual",
          duration: work,
          station, round, rounds,
          index: i, stationCount: circuit.stations.length,
          label: station.name,
        });
        const rest = seconds(station.rest);
        const isLast = round === rounds && i === circuit.stations.length - 1;
        if (rest && !isLast) {
          steps.push({
            kind: "rest", duration: rest, station, round, rounds,
            index: i, stationCount: circuit.stations.length,
            label: "Rest",
            next: circuit.stations[i + 1] || circuit.stations[0],
          });
        }
      });
    }
    return steps;
  }

  function totalDuration(steps) {
    return steps.reduce((sum, s) => sum + s.duration, 0);
  }

  /* ---- audio ----------------------------------------------------------- */

  let audioCtx = null;

  /** Must be called from inside a tap — mobile browsers refuse to start an
      audio context any other way. */
  function unlockAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  /** `delay` is seconds from now. Scheduling against the audio clock rather
      than with setTimeout keeps a run of beeps evenly spaced even when the
      main thread is busy redrawing. */
  function beep(frequency = 880, duration = 0.12, gainValue = 0.25, delay = 0) {
    if (!audioCtx) return;
    const at = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(gainValue, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(at);
    osc.stop(at + duration);
  }

  /* A changeover is three beeps, each noticeably longer than the short ticks
     counting down the last three seconds — so from across a gym floor the
     "move now" signal is unmistakably different from "nearly there", without
     having to look at the phone. */
  const TICK_LENGTH = 0.09;
  const CHANGE_LENGTH = 0.22;
  const CHANGE_GAP = 0.3;
  /** How long a changeover keeps the speaker to itself. */
  const CHANGE_SPAN = CHANGE_GAP * 2 + CHANGE_LENGTH + 0.05;

  function changeTone(frequency) {
    for (let i = 0; i < 3; i++) {
      beep(frequency, CHANGE_LENGTH, 0.3, i * CHANGE_GAP);
    }
  }

  const buzz = (pattern) => { if (navigator.vibrate) navigator.vibrate(pattern); };

  /* Three pulses matching the three beeps, for a phone in a pocket. */
  const CHANGE_BUZZ = [220, 80, 220, 80, 220];

  /* ---- the running clock ---------------------------------------------- */

  function create(circuit, handlers = {}) {
    const steps = buildSchedule(circuit);
    let index = 0;
    let running = false;
    let stepStartedAt = 0;
    let elapsedInStep = 0;
    let raf = null;
    let lastWholeSecond = null;
    let wakeLock = null;
    let lastChangeAt = 0;

    const step = () => steps[index] || null;

    async function holdScreenAwake() {
      try {
        if ("wakeLock" in navigator && !wakeLock) {
          wakeLock = await navigator.wakeLock.request("screen");
          wakeLock.addEventListener("release", () => { wakeLock = null; });
        }
      } catch { /* not available, or refused — the clock still runs */ }
    }
    function releaseScreen() {
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    }

    function remaining() {
      const s = step();
      if (!s) return 0;
      if (s.kind === "manual") return 0;
      const spent = elapsedInStep + (running ? (Date.now() - stepStartedAt) / 1000 : 0);
      return Math.max(0, s.duration - spent);
    }

    function tick() {
      if (!running) return;
      const s = step();
      if (!s) return;

      if (s.kind !== "manual") {
        const left = remaining();
        const whole = Math.ceil(left);

        if (whole !== lastWholeSecond) {
          lastWholeSecond = whole;
          /* On a phase short enough that its "3 seconds left" tick lands
             while the changeover is still sounding, the two run together and
             neither reads clearly. The changeover wins. */
          const duringChange = Date.now() - lastChangeAt < CHANGE_SPAN * 1000;
          if (whole <= 3 && whole > 0 && !duringChange) {
            beep(660, TICK_LENGTH, 0.2);
            buzz(30);
          }
        }
        if (left <= 0) { advance(true); return; }
      }
      handlers.onTick && handlers.onTick(snapshot());
      raf = requestAnimationFrame(tick);
    }

    function snapshot() {
      const s = step();
      const doneBefore = steps.slice(0, index).reduce((sum, x) => sum + x.duration, 0);
      const spentHere = s && s.kind !== "manual" ? s.duration - remaining() : 0;
      return {
        step: s, index, total: steps.length,
        remaining: remaining(),
        running, finished: !s,
        elapsed: doneBefore + spentHere,
        totalDuration: totalDuration(steps),
      };
    }

    function start() {
      if (running || !step()) return;
      unlockAudio();
      holdScreenAwake();
      running = true;
      stepStartedAt = Date.now();
      lastWholeSecond = null;
      handlers.onChange && handlers.onChange(snapshot());
      raf = requestAnimationFrame(tick);
    }

    function pause() {
      if (!running) return;
      elapsedInStep += (Date.now() - stepStartedAt) / 1000;
      running = false;
      cancelAnimationFrame(raf);
      releaseScreen();
      handlers.onChange && handlers.onChange(snapshot());
    }

    function toggle() { running ? pause() : start(); }

    function advance(automatic = false) {
      index++;
      elapsedInStep = 0;
      stepStartedAt = Date.now();
      lastWholeSecond = null;

      const s = step();
      if (!s) {
        running = false;
        cancelAnimationFrame(raf);
        releaseScreen();
        beep(1046, 0.4, 0.3); buzz([90, 60, 90, 60, 200]);
        handlers.onFinish && handlers.onFinish(snapshot());
        handlers.onChange && handlers.onChange(snapshot());
        return;
      }
      if (automatic) {
        // Rest and work keep their own pitches; only the shape is shared.
        changeTone(s.kind === "rest" ? 520 : 980);
        buzz(CHANGE_BUZZ);
        lastChangeAt = Date.now();
      }
      handlers.onChange && handlers.onChange(snapshot());
      if (running) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
    }

    function back() {
      if (index === 0) { elapsedInStep = 0; stepStartedAt = Date.now(); }
      else index--;
      elapsedInStep = 0;
      stepStartedAt = Date.now();
      lastWholeSecond = null;
      handlers.onChange && handlers.onChange(snapshot());
    }

    /* Coming back from a locked screen re-requests the wake lock, which the
       browser drops on its own whenever the page is hidden. */
    /* The browser drops a wake lock whenever the page is hidden, so it has
       to be re-taken on return. This listener is on `document`, which
       outlives the runner — so stop() must remove it, or every circuit run
       would leave one behind for the life of the session. */
    const onVisible = () => {
      if (!document.hidden && running) holdScreenAwake();
    };
    document.addEventListener("visibilitychange", onVisible);

    function dispose() {
      running = false;
      cancelAnimationFrame(raf);
      releaseScreen();
      document.removeEventListener("visibilitychange", onVisible);
    }

    return {
      start, pause, toggle, advance, back,
      stop: dispose, snapshot, steps, unlockAudio,
    };
  }

  return {
    create, seconds, clock, buildSchedule, totalDuration, unlockAudio, beep,
    changeTone, TICK_LENGTH, CHANGE_LENGTH, CHANGE_GAP,
  };
})();
