#!/usr/bin/env python3
"""NeuroArcana on the home network inside NeuroNet (arcana_lan.py, 2026-11-01): one copy hosts on a test port on this
computer, another joins it at 127.0.0.1, and messages go both ways. The same protocol as the game's shell/lan.js.
    python3 test/test_arcana_lan.py"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import sys
import time
import unittest

os.environ["AA_LAN_PORT"] = "47498"          # a test port, never the game's own
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import arcana_lan as L  # noqa: E402


def wait(f, secs=5.0):
    end = time.time() + secs
    while time.time() < end:
        x = f()
        if x:
            return x
        time.sleep(0.1)
    return None


class Lan(unittest.TestCase):
    def setUp(self):
        self.host, self.guest = L.Lan(), L.Lan()

    def tearDown(self):
        self.guest.stop()
        self.host.stop()

    def test_home_network_only(self):
        self.assertTrue(L.private_ip("192.168.1.20") and L.private_ip("10.0.0.2") and L.private_ip("127.0.0.1"))
        self.assertFalse(L.private_ip("8.8.8.8") or L.private_ip("nonsense"))
        self.assertIn("error", self.guest.join("8.8.8.8"))

    def test_join_and_talk(self):
        self.host.set_me({"name": "Cam", "diff": "normal"})
        self.guest.set_me({"name": "Partner", "diff": "free"})
        self.assertTrue(self.host.host(True)["hosting"])
        r = self.guest.join("127.0.0.1")
        self.assertEqual(r["joined"]["host"]["name"], "Cam")
        joined = [m["msg"] for m in self.host.inbox_since(0)["msgs"]]
        self.assertEqual(joined[0], {"type": "joined", "peer": {"name": "Partner", "face": None, "diff": "free"}})
        self.assertEqual(self.guest.send({"kind": "invite", "what": "trade"}), {"ok": True})
        self.assertTrue(wait(lambda: any(m["msg"].get("msg", {}).get("kind") == "invite" for m in self.host.inbox_since(0)["msgs"])))
        self.host.send({"kind": "accept", "what": "trade"})
        self.assertTrue(wait(lambda: any(m["msg"].get("msg", {}).get("kind") == "accept" for m in self.guest.inbox_since(0)["msgs"])))
        # a second guest is turned away while the first plays
        other = L.Lan()
        self.assertIn("already playing", other.join("127.0.0.1")["error"])
        # the guest leaves: the host hears
        self.guest.leave(False)
        self.assertTrue(wait(lambda: any(m["msg"].get("type") == "left" for m in self.host.inbox_since(0)["msgs"])))


if __name__ == "__main__":
    unittest.main()
