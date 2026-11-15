"""
code_runner.py (Code -> IDE): Algorithm's runner.py, moved across unchanged.

Algorithm — running commands.

WHAT THIS IS, AND IS NOT.

It runs a command inside the project folder, streams its output live, takes
typed input, and can stop it. That covers what the terminal is actually for:
running a script, running a test suite, watching it fail, fixing it, running
it again.

It is NOT a terminal emulator. There is no cursor addressing, so anything
that redraws the screen — vim, htop, a progress bar that rewinds — will look
wrong. Building a real VT100 is weeks of work and the wrong thing to attach
to a code editor; a user who wants vim already has a terminal.

WHY A PTY AND NOT JUST PIPES. Three reasons, all of which show up
immediately in practice:

  Buffering.  Python, cargo and most tools switch to block buffering when
              stdout is a pipe. On a pipe, a test suite prints nothing for
              thirty seconds and then everything at once. On a terminal they
              line-buffer, so output arrives as it happens.
  Colour.     Tools check isatty() before emitting colour. pytest, cargo and
              ruff all go monochrome down a pipe.
  Prompts.    input() and anything asking for confirmation need a terminal
              to behave normally.

The cost is that stdout and stderr are merged — a PTY has one stream. That
is the right trade here: interleaved output in the order it happened is what
you want when watching a test run.
"""

import os
import pty
import re
import select
import signal
import subprocess
import threading
import time
import uuid

#: How much output to keep per session. A runaway loop printing forever must
#: not grow memory without limit; the oldest output goes first because the
#: end is what you are reading.
MAX_CHARS = 400_000

#: Commands offered per language. Kept short and predictable — the free
#: command box is there for anything else.
RUN_COMMANDS = {
    "python": ["python3 {file}", "python3 -m pytest -q", "python3 -m pytest {file} -q"],
    "javascript": ["node {file}", "npm test"],
    "rust": ["cargo run", "cargo test", "cargo check"],
    "html": [],
    "css": [],
    "plain": [],
}


def suggestions(language, rel_path):
    out = []
    for template in RUN_COMMANDS.get(language, []):
        if "{file}" in template and not rel_path:
            continue
        out.append(template.replace("{file}", _quote(rel_path or "")))
    return out


def _quote(path):
    if not path:
        return ""
    return f'"{path}"' if any(c in path for c in ' \t"\'') else path


#: Strip the escape sequences that are not colour. Colour is handed to the
#: interface to render; everything else — cursor moves, screen clears — is
#: removed rather than shown as gibberish.
_ANSI_OTHER = re.compile(r"\x1b\[[0-9;?]*[A-Za-z](?<![m])|\x1b\][^\x07]*\x07|\x1b[()][B0]|\r")


class Session:
    """One running command."""

    def __init__(self, command, cwd, env=None):
        self.id = uuid.uuid4().hex[:10]
        self.command = command
        self.cwd = cwd
        self.output = ""
        self.started_at = time.time()
        self.ended_at = None
        self.exit_code = None
        self.error = None
        self._lock = threading.Lock()
        self._master = None
        self._process = None
        self._reader = None
        self._env = env

    # ---- lifecycle ----------------------------------------------------

    def start(self):
        try:
            master, slave = pty.openpty()
        except OSError as exc:
            self.error = f"Could not open a terminal: {exc}"
            self.ended_at = time.time()
            return False

        env = dict(os.environ)
        env.update({
            "TERM": "xterm-256color",
            # Some tools check these rather than isatty(); setting them makes
            # colour behaviour consistent across the ones that do.
            "FORCE_COLOR": "1",
            "PYTHONUNBUFFERED": "1",
            "COLUMNS": "100",
            "LINES": "30",
        })
        if self._env:
            env.update(self._env)

        try:
            self._process = subprocess.Popen(
                self.command,
                shell=True,
                cwd=self.cwd,
                stdin=slave,
                stdout=slave,
                stderr=slave,
                env=env,
                close_fds=True,
                # Its own session, so stopping reaches the whole tree — a
                # test runner that spawns workers would otherwise leave them
                # running after Stop.
                start_new_session=True,
            )
        except OSError as exc:
            os.close(master)
            os.close(slave)
            self.error = str(exc)
            self.ended_at = time.time()
            return False

        os.close(slave)
        self._master = master
        self._reader = threading.Thread(target=self._read_loop, daemon=True,
                                        name=f"algo-run-{self.id}")
        self._reader.start()
        return True

    def _read_loop(self):
        """Drain the PTY continuously.

        Not optional: an unread PTY buffer fills and the child blocks on
        write, which looks exactly like a hung program.
        """
        buffer = b""
        while True:
            try:
                ready, _, _ = select.select([self._master], [], [], 0.2)
            except (OSError, ValueError):
                break
            if ready:
                try:
                    chunk = os.read(self._master, 8192)
                except OSError:
                    break                      # the child closed the PTY
                if not chunk:
                    break
                buffer += chunk
                # Decode on a boundary that cannot split a UTF-8 sequence.
                text = buffer.decode("utf-8", errors="replace")
                buffer = b""
                self._append(text)
            elif self._process.poll() is not None:
                # Exited and nothing left to read.
                break

        try:
            self.exit_code = self._process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.exit_code = None
        self.ended_at = time.time()
        try:
            os.close(self._master)
        except OSError:
            pass

    def _append(self, text):
        with self._lock:
            self.output += text
            if len(self.output) > MAX_CHARS:
                # Trim from the front: the end is what is being read.
                self.output = ("…(earlier output trimmed)\n"
                               + self.output[-MAX_CHARS:])

    # ---- interaction --------------------------------------------------

    def write(self, text):
        if self._master is None or self.ended_at:
            return {"error": "Nothing is running."}
        try:
            os.write(self._master, text.encode("utf-8"))
            return {"ok": True}
        except OSError as exc:
            return {"error": str(exc)}

    def stop(self):
        if self._process is None or self._process.poll() is not None:
            return {"ok": True}
        try:
            os.killpg(os.getpgid(self._process.pid), signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass
        for _ in range(20):
            if self._process.poll() is not None:
                break
            time.sleep(0.05)
        if self._process.poll() is None:
            try:
                os.killpg(os.getpgid(self._process.pid), signal.SIGKILL)
            except (OSError, ProcessLookupError):
                pass
        self._append("\n[stopped]\n")
        return {"ok": True}

    @property
    def running(self):
        return self._process is not None and self._process.poll() is None

    def snapshot(self, since=0):
        """Output from `since` onwards, so the interface only fetches what it
        has not already got."""
        with self._lock:
            total = len(self.output)
            chunk = self.output[int(since):] if since < total else ""
        return {
            "id": self.id,
            "command": self.command,
            "running": self.running,
            "exit_code": self.exit_code,
            "error": self.error,
            "since": total,
            "chunk": clean(chunk),
            "elapsed": round((self.ended_at or time.time()) - self.started_at, 1),
        }


def clean(text):
    """Remove the escape sequences that are not colour."""
    return _ANSI_OTHER.sub("", text or "")


class Runner:
    """Holds the sessions. One at a time per project, replacing the last."""

    def __init__(self):
        self._sessions = {}
        self._order = []

    def run(self, command, cwd, env=None):
        if not str(command or "").strip():
            return {"error": "No command given."}
        if not os.path.isdir(cwd):
            return {"error": "That project folder is missing."}

        session = Session(command, cwd, env)
        if not session.start():
            return {"error": session.error or "Could not start that command."}

        self._sessions[session.id] = session
        self._order.append(session.id)
        # Keep only a handful; each holds its output in memory.
        while len(self._order) > 6:
            old = self._order.pop(0)
            dead = self._sessions.pop(old, None)
            if dead and dead.running:
                dead.stop()
        return session.snapshot()

    def get(self, session_id, since=0):
        session = self._sessions.get(session_id)
        return session.snapshot(since) if session else {"error": "No such run."}

    def write(self, session_id, text):
        session = self._sessions.get(session_id)
        return session.write(text) if session else {"error": "No such run."}

    def stop(self, session_id):
        session = self._sessions.get(session_id)
        return session.stop() if session else {"error": "No such run."}

    def stop_all(self):
        for session in self._sessions.values():
            if session.running:
                session.stop()
        return {"ok": True}
