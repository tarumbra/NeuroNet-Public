"""system/ssh-keys-only.sh (I17, 8 Nov 2026): the PC's SSH to keys only -- on a scratch home and settings folder, with
sudo, sshd and systemctl stubbed. Never the real /etc/ssh or the real sshd.
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
TOOL = os.path.join(APP, "system", "ssh-keys-only.sh")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


print("\nThe PC's SSH, keys only (system/ssh-keys-only.sh)\n")
tmp = tempfile.mkdtemp(prefix="nn-sshkeys-")
try:
    home, conf, bin_, log = (os.path.join(tmp, x) for x in ("home", "sshd_config.d", "bin", "calls.log"))
    os.makedirs(os.path.join(home, ".ssh"))
    os.makedirs(bin_)
    stubs = {
        "sudo": '#!/bin/bash\nexec "$@"\n',
        "sshd": f'#!/bin/bash\necho "sshd $*" >> {log}\n[ "$1" = -t ] && [ -n "${{SSHD_BAD:-}}" ] && {{ echo "line 3: Bad option"; exit 255; }}\n'
                '[ "$1" = -T ] && printf "passwordauthentication no\\npermitrootlogin no\\nallowusers cam\\nport 22\\n"\nexit 0\n',
        "systemctl": f'#!/bin/bash\necho "systemctl $*" >> {log}\nexit 0\n',
    }
    for n, s in stubs.items():
        open(os.path.join(bin_, n), "w").write(s)
        os.chmod(os.path.join(bin_, n), 0o755)
    env = dict(os.environ, HOME=home, SSHD_CONF_DIR=conf, PATH=bin_ + ":" + os.environ["PATH"])
    keys = os.path.join(home, ".ssh", "authorized_keys")
    cfile = os.path.join(conf, "10-cam.conf")

    def run(*a, **extra):
        if os.path.exists(log):
            os.remove(log)
        return subprocess.run(["bash", TOOL, *a], capture_output=True, text=True, env=dict(env, **extra), timeout=30)

    r = run()
    ok("no key to log in with: STOPPED before changing anything (no lock-out)", r.returncode == 1 and "STOPPED" in r.stdout and not os.path.exists(cfile), r.stdout)
    open(keys, "w").write("# a comment\nssh-ed25519 AAAAC3Nz laptop\n")
    r = run(SSHD_BAD="1")
    ok("settings sshd won't accept: taken back out, nothing reloaded", r.returncode == 1 and "taken back out" in r.stdout and not os.path.exists(cfile)
       and "reload" not in open(log).read(), r.stdout)
    r = run()
    c = open(cfile).read() if os.path.exists(cfile) else ""
    calls = open(log).read()
    ok("with a key: passwords off, no root, only this user, in its own early file; tested, then reloaded", r.returncode == 0
       and all(x in c for x in ("PasswordAuthentication no", "KbdInteractiveAuthentication no", "PermitRootLogin no", "AllowUsers " + subprocess.run(["id", "-un"], capture_output=True, text=True).stdout.strip()))
       and "sshd -t" in calls and calls.index("sshd -t") < calls.index("systemctl reload sshd") and "passwordauthentication no" in r.stdout, r.stdout + calls)
    ok("  the keys file untouched without --home-only", open(keys).read() == "# a comment\nssh-ed25519 AAAAC3Nz laptop\n")
    r = run("--home-only")
    ok("--home-only: each key limited to the home network, the old file kept; comments left alone",
       open(keys).read() == '# a comment\nfrom="192.168.1.0/24",no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAAC3Nz laptop\n'
       and os.path.exists(keys + ".before-home-only"), open(keys).read())
    run("--home-only")
    ok("  run again: not limited twice", open(keys).read().count("from=") == 1)
    r = run("--undo")
    ok("--undo: the settings file taken out and sshd reloaded (passwords back)", not os.path.exists(cfile) and "systemctl reload sshd" in open(log).read(), r.stdout)
    ok("never edits sshd_config itself", "sshd_config\"" not in open(TOOL).read() and "/etc/ssh/sshd_config " not in open(TOOL).read())
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
