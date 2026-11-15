"""NeuroFarm -- where the farm is kept (neuronet_data/farm/farm.json).

Cam (2026-10-07): "a new game NeuroFarm (A farmville, simfarm game ...)". Like
NeuroPets (pet.py): THE RULES ARE NOT HERE -- they're ui/farm/farmcore.js. The
page applies an action and hands the result here to keep: checked, written
safely, the previous copy kept as farm.json.bak.
"""
import json
import os
import shutil
import tempfile

#: Provides the NeuroNet data folder. Set by neurofarm.py; tests point it at a scratch folder.
DATA_DIR_PROVIDER = None
MAX_BYTES = 512 * 1024


def root():
    d = os.path.join(DATA_DIR_PROVIDER(), "farm")
    os.makedirs(d, exist_ok=True)
    return d


def path():
    return os.path.join(root(), "farm.json")


def empty():
    return {"v": 1, "game": "neurofarm", "log": []}


def load():
    """The saved farm, or a new one."""
    for p in (path(), path() + ".bak"):
        try:
            with open(p, encoding="utf-8") as f:
                s = json.load(f)
            if isinstance(s, dict):
                return s
        except FileNotFoundError:
            if p == path():
                if not os.path.exists(path() + ".bak"):
                    return empty()
        except (OSError, ValueError):
            continue
    return empty()


def check(state):
    if not isinstance(state, dict) or state.get("v") != 1 or state.get("game") != "neurofarm":
        return "That isn't a NeuroFarm save."
    if not isinstance(state.get("log", []), list):
        return "The farm's diary is damaged."
    if not isinstance(state.get("tiles", {}), dict) or not isinstance(state.get("silo", {}), dict):
        return "The farm's fields are damaged."
    return None


def save(state):
    err = check(state)
    if err:
        return {"error": err}
    text = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_BYTES:
        return {"error": "The farm's save is too big."}
    target = path()
    fd, tmp = tempfile.mkstemp(dir=root(), prefix=".farm-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(target):
            shutil.copyfile(target, target + ".bak")
        os.replace(tmp, target)
    except OSError:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return {"ok": True}
