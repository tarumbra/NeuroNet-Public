#!/usr/bin/env python3
"""NeuroArcana's keeping side inside NeuroNet (arcana_store.py, 2026-11-01): the same files as the game's own Electron
shell, so a save moves between the two. Every test works in a scratch folder (AA_DATA) -- never the real saves.
    python3 test/test_arcana_store.py"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import arcana_store as S  # noqa: E402

GOOD = {"v": 1, "game": "neuroarcana", "made": 1, "moon": 5, "cards": {}, "journal": []}


class Store(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix="aa-store-")
        self.old = os.environ.get("AA_DATA")
        os.environ["AA_DATA"] = self.d

    def tearDown(self):
        if self.old is None:
            os.environ.pop("AA_DATA", None)
        else:
            os.environ["AA_DATA"] = self.old

    def test_new_player_empty(self):
        self.assertEqual(S.load(), {"v": 1, "game": "neuroarcana"})
        self.assertTrue(self.d.startswith(tempfile.gettempdir()))

    def test_save_load_and_backup(self):
        self.assertTrue(S.save(GOOD)["ok"])
        S.save(dict(GOOD, moon=9))
        self.assertEqual(S.load()["moon"], 9)
        p = os.path.join(self.d, "profiles", "p1.json")
        with open(p, "w") as f:
            f.write("{ broken")
        self.assertEqual(S.load()["moon"], 5, "a damaged save gives way to the copy before it")

    def test_refused(self):
        self.assertIn("error", S.save({"game": "neurocafe", "v": 1}))
        self.assertIn("error", S.save(dict(GOOD, moon="lots")))
        self.assertIn("error", S.save(dict(GOOD, cards=[])))

    def test_old_save_moves_in_as_sandbox(self):
        with open(os.path.join(self.d, "arcana.json"), "w") as f:
            json.dump(dict(GOOD, sandbox=True, moon=42), f)
        p = S.profiles()
        self.assertEqual(p["list"][0]["kind"], "sandbox")
        self.assertEqual(p["list"][0]["diff"], "free")
        self.assertEqual(S.load()["moon"], 42)

    def test_profiles(self):
        S.save(dict(GOOD, moon=1))
        p = S.profile_new({"name": "  Player   two ", "diff": "hard", "face": "deck-a:fool"})
        self.assertEqual(p["active"], "p2")
        self.assertEqual(p["list"][1]["name"], "Player two")
        self.assertEqual(p["list"][1]["diff"], "hard")
        self.assertEqual(S.load(), {"v": 1, "game": "neuroarcana"})
        S.save(dict(GOOD, moon=2))
        S.profile_use("p1")
        self.assertEqual(S.load()["moon"], 1)
        self.assertEqual(S.load("p2")["moon"], 2)
        S.profile_edit("p2", {"name": "Renamed", "face": "../../etc", "diff": "free"})
        e = S.profiles()["list"][1]
        self.assertEqual((e["name"], e["face"], e["diff"]), ("Renamed", None, "hard"), "the difficulty is kept unless a new save begins")
        self.assertIn("error", S.profile_delete("p1"), "not the open one")
        self.assertNotIn("error", S.profile_delete("p2"))
        self.assertEqual(len(os.listdir(os.path.join(self.d, "profiles", "deleted"))), 1)

    def test_diary(self):
        S.ach_add("hard", {"ids": ["keeper-fool-1", "../evil"], "by": "Cam"})
        x = S.ach_get()
        self.assertEqual(x["hard"]["keeper-fool-1"]["by"], "Cam")
        self.assertNotIn("../evil", x["hard"])
        S.ach_add("hard", {"ids": ["keeper-fool-1"], "by": "Sam"})
        self.assertEqual(S.ach_get()["hard"]["keeper-fool-1"]["by"], "Cam")
        self.assertIn("error", S.ach_add("free", {"ids": ["x"]}))

    def test_the_api_refuses_unknown_calls(self):
        import neuroarcana
        a = neuroarcana.Api()
        self.assertIn("error", a.call("shell_exec", ["rm -rf /"]))
        self.assertEqual(a.call("profiles", [])["active"], "p1")
        self.assertGreater(len(a.call("catalogue", [])["decks"]), 0, "NeuroNet carries the card art")


if __name__ == "__main__":
    unittest.main(verbosity=1)
