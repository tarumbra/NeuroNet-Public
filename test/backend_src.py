"""The backend's source as one text, for the tests that read it (2026-10-06).

neuronet.py's Api was split by section into api/*.py (the audit: "split the
Python backend by section"); a test that looks for a call's code finds it in
either.
"""
import glob
import os


def backend_source(app):
    parts = [os.path.join(app, "neuronet.py")] + sorted(glob.glob(os.path.join(app, "api", "*.py")))
    out = []
    for p in parts:
        with open(p, encoding="utf-8") as f:
            out.append(f.read())
    return "\n".join(out)
