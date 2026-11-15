"""Super+Alt+O on an Omarchy 4.5 floating workspace (neuronet-quick full), 14 Nov 2026.
Cam: "when opening Neuronet with Super + Alt + O in floating mode it should open
as a window that is consistent with that mode". Runs only the script's own
floating_workspace() against a stand-in omarchy command; nothing real is touched.

Run: python3 test/test_quick_floating.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import re  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, "..", "neuronet-quick"), encoding="utf-8").read()
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


fn = re.search(r"^floating_workspace\(\) \{.*?^\}", SRC, re.M | re.S).group(0)
with tempfile.TemporaryDirectory() as tmp:
    stub = os.path.join(tmp, "omarchy-hyprland-workspace-layout-current")
    open(stub, "w").write('#!/bin/sh\n[ "$1" = 3 ] && echo floating || echo dwindle\n')
    os.chmod(stub, 0o755)

    def ask(ws, path):
        env = dict(os.environ, PATH=path)
        return subprocess.run(["bash", "-c", fn + '\nfloating_workspace "$1" && echo yes || echo no', "_", ws],
                              capture_output=True, text=True, env=env).stdout.strip()
    ok("a floating workspace is recognised (Omarchy's own answer)", ask("3", tmp + ":/usr/bin:/bin") == "yes")
    ok("a tiled one isn't", ask("1", tmp + ":/usr/bin:/bin") == "no")
    ok("a special workspace (the scratchpad) never is", ask("special:neuronet", tmp + ":/usr/bin:/bin") == "no")
    ok("without Omarchy 4.5's command, nothing is floating (it tiles, as before)", ask("3", "/usr/bin:/bin") == "no")

body = re.search(r"^full\(\) \{.*?^\}", SRC, re.M | re.S).group(0)
ok("on a floating workspace NeuroNet stays floating, at Omarchy's open size, centred",
   'if floating_workspace "$target"; then' in body and "[1100, (.width / .scale) * 0.64] | min" in body
   and "[760, (.height / .scale) * 0.68] | min" in body and "hl.dsp.window.center" in body)
ok("elsewhere it tiles, as it always has", re.search(r'else\n\s*\[ "\$floating" = "true" \] && dsp "hl\.dsp\.window\.float', body))
print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
