"""Settings -> App stats -> NeuroNet's health (the performance audit, 3 Nov 2026).

Cam found NeuroNet 1.8 GB bigger by the morning and had no way to see it
from inside. This says how much memory NeuroNet is using right now -- its own
Python and every process under it (the page, the GPU helper, ...) -- how long
it has been running, and how that has gone over the last day: a sample every
five minutes, kept in memory only (a restart starts the line again).

Reads /proc for NeuroNet's own processes only, never anyone else's. Without
/proc (not Linux) it says nothing.
"""
import collections
import os
import threading
import time

EVERY = 300                       # seconds between samples
KEEP = 24 * 3600 // EVERY         # a day of them
_samples = collections.deque(maxlen=KEEP)
_started = [False]


def _children():
    kids = {}
    for p in os.listdir("/proc"):
        if not p.isdigit():
            continue
        try:
            with open("/proc/%s/stat" % p) as f:
                st = f.read()
            ppid = int(st[st.rindex(")") + 2:].split()[1])
            kids.setdefault(ppid, []).append(int(p))
        except (OSError, ValueError, IndexError):
            continue
    return kids


def _kind(pid):
    try:
        with open("/proc/%d/cmdline" % pid, "rb") as f:
            cmd = f.read().replace(b"\0", b" ").decode("utf-8", "replace")
    except OSError:
        return None
    if "--type=renderer" in cmd:
        return "page"
    if "--type=gpu" in cmd:
        return "graphics"
    if pid == os.getpid():
        return "app"
    return "helpers"


def _rss_mb(pid):
    try:
        with open("/proc/%d/status" % pid) as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024.0
    except (OSError, ValueError):
        pass
    return 0.0


def measure(root=None):
    """{"total": MB, "parts": {"app"|"page"|"graphics"|"helpers": MB}} for
    `root` (this process) and everything under it; None without /proc."""
    if not os.path.isdir("/proc"):
        return None
    root = root or os.getpid()
    kids, parts, todo = _children(), {}, [root]
    while todo:
        p = todo.pop()
        k = _kind(p)
        if k:
            parts[k] = parts.get(k, 0.0) + _rss_mb(p)
        todo.extend(kids.get(p, []))
    parts = {k: round(v) for k, v in parts.items()}
    return {"total": sum(parts.values()), "parts": parts}


def started_at(pid=None):
    """When this process started (seconds since the epoch), or None."""
    try:
        with open("/proc/%d/stat" % (pid or os.getpid())) as f:
            st = f.read()
        ticks = int(st[st.rindex(")") + 2:].split()[19])
        with open("/proc/uptime") as f:
            up = float(f.read().split()[0])
        return time.time() - up + ticks / os.sysconf("SC_CLK_TCK")
    except (OSError, ValueError, IndexError):
        return None


def sample(now=None):
    m = measure()
    if m:
        _samples.append([round(now or time.time()), m["total"]])
    return m


def start():
    """The five-minute sampler (main() only -- never on import or in a test)."""
    if _started[0]:
        return False
    _started[0] = True

    def loop():
        while True:
            try:
                sample()
            except Exception:
                pass
            time.sleep(EVERY)
    threading.Thread(target=loop, name="neuronet-health", daemon=True).start()
    return True


def trend(samples, hours=2.0):
    """MB an hour over the last `hours` (first to last sample in that window),
    or None with under half an hour of samples."""
    if not samples:
        return None
    t1 = samples[-1][0]
    win = [s for s in samples if s[0] >= t1 - hours * 3600]
    if len(win) < 2 or win[-1][0] - win[0][0] < 1800:
        return None
    return (win[-1][1] - win[0][1]) * 3600.0 / (win[-1][0] - win[0][0])


def snapshot():
    now = measure()
    if now is None:
        return {"error": "Memory can't be read here."}
    samples = list(_samples) + [[round(time.time()), now["total"]]]
    rate = trend(samples)
    return {"now": now, "since": started_at(), "samples": samples, "perHour": None if rate is None else round(rate),
            "steady": None if rate is None else rate < 40}
