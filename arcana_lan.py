"""NeuroArcana on the home network, inside NeuroNet -- the same protocol as the game's own shell/lan.js (2026-11-01).

Cam: "my PC and my partner's are hooked into the same router -- can we set up LAN for trading cards and fighting?"
One computer hosts, the other joins; the joiner only connects OUT to the host, so only the host needs a port open
(47432/tcp, home network only). See NeuroArcana's shell/lan.js for the protocol (/aa/hello, join, send, poll, leave).
"""
import ipaddress
import json
import os
import secrets
import socket
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("AA_LAN_PORT") or 47432)
MAX_BODY = 256 * 1024
GONE = 20.0


def private_ip(a):
    a = str(a or "").replace("::ffff:", "")
    try:
        ip = ipaddress.ip_address(a)
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback


def local_addrs():
    """This computer's home-network IPv4 addresses."""
    out = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))           # no packet is sent: this only picks the route's address
        out.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            out.add(info[4][0])
    except OSError:
        pass
    return [a for a in out if private_ip(a) and not a.startswith("127.")]


class Lan:
    def __init__(self):
        self.me = {"name": "", "face": None, "diff": "normal"}
        self.server = None
        self.guest = None          # {session, name, face, diff, seen}
        self.joined = None         # {addr, session, host, since, misses}
        self.inbox, self.outbox = [], []
        self.seq = self.oseq = 0
        self.lock = threading.Lock()

    def _push(self, box, msg):
        with self.lock:
            if box is self.inbox:
                self.seq += 1
                n = self.seq
            else:
                self.oseq += 1
                n = self.oseq
            box.append({"seq": n, "msg": msg})
            del box[:-500]

    # ---- the page's calls ----
    def status(self):
        if self.guest and time.time() - self.guest["seen"] > GONE:
            self._push(self.inbox, {"type": "left", "peer": {"name": self.guest["name"]}})
            self.guest = None
        g = self.guest
        return {"hosting": self.server is not None, "port": PORT, "addrs": local_addrs(),
                "guest": {"name": g["name"], "face": g["face"], "diff": g["diff"]} if g else None,
                "joined": {"addr": self.joined["addr"], "host": self.joined["host"]} if self.joined else None, "me": self.me}

    def set_me(self, m):
        if isinstance(m, dict):
            self.me = {"name": str(m.get("name") or "")[:30], "face": m.get("face")[:80] if isinstance(m.get("face"), str) else None, "diff": str(m.get("diff") or "normal")[:8]}
        return self.status()

    def host(self, on):
        if not on:
            if self.server:
                srv, self.server = self.server, None
                threading.Thread(target=srv.shutdown, daemon=True).start()
            self.guest = None
            return self.status()
        if self.server:
            return self.status()
        lan = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _reply(self, code, obj):
                b = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def _body(self):
                n = int(self.headers.get("Content-Length") or 0)
                if n > MAX_BODY:
                    return None
                try:
                    return json.loads(self.rfile.read(n) or b"{}")
                except ValueError:
                    return None

            def do_GET(self):
                if not private_ip(self.client_address[0]):
                    return self._reply(403, {"error": "home network only"})
                u = urlparse(self.path)
                if u.path == "/aa/hello":
                    return self._reply(200, {"game": "neuroarcana", **lan.me, "busy": bool(lan.guest)})
                q = parse_qs(u.query)
                if not lan.guest or (q.get("session") or [""])[0] != lan.guest["session"]:
                    return self._reply(403, {"error": "not in this game"})
                lan.guest["seen"] = time.time()
                if u.path == "/aa/poll":
                    since = int((q.get("since") or ["0"])[0] or 0)
                    with lan.lock:
                        msgs = [m for m in lan.outbox if m["seq"] > since]
                    return self._reply(200, {"msgs": msgs})
                return self._reply(404, {"error": "no"})

            def do_POST(self):
                if not private_ip(self.client_address[0]):
                    return self._reply(403, {"error": "home network only"})
                u = urlparse(self.path)
                b = self._body()
                if b is None:
                    return self._reply(400, {"error": "bad request"})
                if u.path == "/aa/join":
                    if lan.guest and time.time() - lan.guest["seen"] < GONE:
                        return self._reply(409, {"error": (lan.me["name"] or "They") + " is already playing with someone."})
                    lan.guest = {"session": secrets.token_hex(12), "name": str(b.get("name") or "A guest")[:30],
                                 "face": b.get("face")[:80] if isinstance(b.get("face"), str) else None, "diff": str(b.get("diff") or "normal")[:8], "seen": time.time()}
                    with lan.lock:
                        lan.outbox.clear()
                    lan._push(lan.inbox, {"type": "joined", "peer": {k: lan.guest[k] for k in ("name", "face", "diff")}})
                    return self._reply(200, {"session": lan.guest["session"], **lan.me})
                if not lan.guest or b.get("session") != lan.guest["session"]:
                    return self._reply(403, {"error": "not in this game"})
                lan.guest["seen"] = time.time()
                if u.path == "/aa/send":
                    if isinstance(b.get("msg"), dict):
                        lan._push(lan.inbox, {"type": "msg", "msg": b["msg"]})
                    return self._reply(200, {"ok": True})
                if u.path == "/aa/leave":
                    lan._push(lan.inbox, {"type": "left", "peer": {"name": lan.guest["name"]}})
                    lan.guest = None
                    return self._reply(200, {"ok": True})
                return self._reply(404, {"error": "no"})

        try:
            self.server = ThreadingHTTPServer(("0.0.0.0", PORT), H)
        except OSError as e:
            return dict(self.status(), error="Another program is using the game's port (%d)." % PORT if e.errno == 98 else str(e))
        self.server.daemon_threads = True
        threading.Thread(target=self.server.serve_forever, name="arcana-lan", daemon=True).start()
        return self.status()

    @staticmethod
    def _request(method, addr, path, data=None, timeout=3.0):
        try:
            req = urllib.request.Request("http://%s:%d%s" % (addr, PORT, path), method=method,
                                         data=json.dumps(data).encode() if data is not None else None,
                                         headers={"Content-Type": "application/json"} if data is not None else {})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return dict(json.loads(r.read() or b"{}"), status=r.status)
        except urllib.error.HTTPError as e:
            try:
                return dict(json.loads(e.read() or b"{}"), status=e.code)
            except ValueError:
                return {"status": e.code, "error": "refused"}
        except (OSError, ValueError) as e:
            return {"error": str(e)}

    def scan(self, extra=None):
        targets = set(a for a in (extra or []) if private_ip(a))
        for a in local_addrs():
            base = a.rsplit(".", 1)[0]
            targets.update(base + "." + str(i) for i in range(1, 255) if base + "." + str(i) != a)
        found = []

        def probe(addr):
            r = self._request("GET", addr, "/aa/hello", timeout=0.7)
            if r.get("game") == "neuroarcana":
                found.append({"addr": addr, "name": r.get("name"), "face": r.get("face"), "diff": r.get("diff"), "busy": r.get("busy")})
        with ThreadPoolExecutor(64) as ex:
            list(ex.map(probe, sorted(targets)))
        return {"hosts": found}

    def join(self, addr):
        if not private_ip(addr):
            return {"error": "That isn't an address on the home network."}
        r = self._request("POST", addr, "/aa/join", self.me)
        if not r.get("session"):
            return {"error": r.get("error") or "No game there."}
        self.leave(True)
        self.joined = {"addr": addr, "session": r["session"], "host": {"name": r.get("name"), "face": r.get("face"), "diff": r.get("diff")}, "since": 0, "misses": 0}
        self._push(self.inbox, {"type": "joined", "peer": self.joined["host"]})
        j = self.joined

        def poll():
            while self.joined is j:
                p = self._request("GET", j["addr"], "/aa/poll?session=%s&since=%d" % (j["session"], j["since"]))
                if self.joined is not j:
                    return
                if isinstance(p.get("msgs"), list):
                    j["misses"] = 0
                    for m in p["msgs"]:
                        j["since"] = max(j["since"], m["seq"])
                        self._push(self.inbox, {"type": "msg", "msg": m["msg"]})
                else:
                    j["misses"] += 1
                    if j["misses"] > 12 or p.get("status") == 403:
                        self._push(self.inbox, {"type": "left", "peer": j["host"]})
                        self.joined = None
                        return
                time.sleep(0.5)
        threading.Thread(target=poll, name="arcana-lan-poll", daemon=True).start()
        return self.status()

    def leave(self, quiet=False):
        if self.joined:
            j, self.joined = self.joined, None
            threading.Thread(target=self._request, args=("POST", j["addr"], "/aa/leave", {"session": j["session"]}, 1.5), daemon=True).start()
            if not quiet:
                self._push(self.inbox, {"type": "left", "peer": j["host"]})
        if self.guest and not quiet:
            self._push(self.outbox, {"type": "bye"})
            self.guest = None
        return self.status()

    def send(self, msg):
        if not isinstance(msg, dict):
            return {"error": "nothing to send"}
        if self.joined:
            r = self._request("POST", self.joined["addr"], "/aa/send", {"session": self.joined["session"], "msg": msg})
            return {"ok": True} if r.get("ok") else {"error": r.get("error") or "not sent"}
        if self.guest:
            self._push(self.outbox, msg)
            return {"ok": True}
        return {"error": "Not playing with anyone."}

    def inbox_since(self, since):
        since = int(since or 0)
        with self.lock:
            return {"msgs": [m for m in self.inbox if m["seq"] > since], "seq": self.seq}

    def stop(self):
        self.leave(True)
        return self.host(False)
