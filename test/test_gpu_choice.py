"""NeuroNet draws on the built-in GPU on a two-GPU laptop, and leaves an
NVIDIA-only computer alone (neuronet.prefer_integrated_gpu; health check,
2026-09-30). Fake /sys/class/drm folders; the real environment is untouched."""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
sys.argv = sys.argv[:1]
import neuronet  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


ICD = tempfile.mkdtemp(prefix="nn-icd-")
for n in ("intel_icd.json", "nvidia_icd.json", "radeon_icd.x86_64.json"):
    open(os.path.join(ICD, n), "w").close()
DRI = tempfile.mkdtemp(prefix="nn-dri-")


def machine(*vendors):
    d = tempfile.mkdtemp(prefix="nn-drm-")
    for i, v in enumerate(vendors):
        os.makedirs(os.path.join(d, "card%d" % i, "device"))
        with open(os.path.join(d, "card%d" % i, "device", "vendor"), "w") as f:
            f.write(v + "\n")
    os.makedirs(os.path.join(d, "renderD128"))       # not a card: ignored
    return d


mesa = tempfile.NamedTemporaryFile(suffix="_mesa.json", delete=False).name
pick = lambda env, *v: neuronet.prefer_integrated_gpu(env, machine(*v), mesa, ICD, DRI)  # noqa: E731

env = {}
got = pick(env, "0x10de", "0x8086")
ok("NVIDIA + Intel: NeuroNet uses Mesa's EGL (the built-in GPU)",
   env.get("__EGL_VENDOR_LIBRARY_FILENAMES") == mesa and env.get("__GLX_VENDOR_LIBRARY_NAME") == "mesa", env)
ok("  and says what it set", got == env)
ok("  Vulkan sees every driver but NVIDIA's",
   env.get("VK_DRIVER_FILES") == os.path.join(ICD, "intel_icd.json") + ":" + os.path.join(ICD, "radeon_icd.x86_64.json"),
   env.get("VK_DRIVER_FILES"))
ok("  no Intel video driver installed: no hardware decoding rather than NVIDIA's",
   env.get("LIBVA_DRIVER_NAME") == "none")
open(os.path.join(DRI, "iHD_drv_video.so"), "w").close()
env = {}
pick(env, "0x10de", "0x8086")
ok("  with intel-media-driver installed: Intel's (iHD)", env.get("LIBVA_DRIVER_NAME") == "iHD")
env = {}
ok("NVIDIA + AMD: the same", pick(env, "0x1002", "0x10de") and env["__EGL_VENDOR_LIBRARY_FILENAMES"] == mesa)
env = {}
ok("NVIDIA only (the first ISO machine): nothing changes", pick(env, "0x10de") == {} and env == {})
env = {}
ok("Intel only: nothing changes", pick(env, "0x8086") == {} and env == {})
env = {"NEURONET_GPU": "nvidia"}
ok("NEURONET_GPU=nvidia keeps it on the NVIDIA card", pick(env, "0x10de", "0x8086") == {} and len(env) == 1)
env = {"__EGL_VENDOR_LIBRARY_FILENAMES": "/mine.json"}
pick(env, "0x10de", "0x8086")
ok("a choice already made by hand is kept", env["__EGL_VENDOR_LIBRARY_FILENAMES"] == "/mine.json")
env = {"LIBVA_DRIVER_NAME": "nvidia", "__GLX_VENDOR_LIBRARY_NAME": "nvidia"}
pick(env, "0x10de", "0x8086")
ok("Omarchy's desktop-wide \"nvidia\" defaults are replaced on a two-GPU laptop",
   env["LIBVA_DRIVER_NAME"] != "nvidia" and env["__GLX_VENDOR_LIBRARY_NAME"] == "mesa", env)
env = {"LIBVA_DRIVER_NAME": "nvidia", "__GLX_VENDOR_LIBRARY_NAME": "nvidia"}
pick(env, "0x10de")
ok("  and kept on an NVIDIA-only computer", env == {"LIBVA_DRIVER_NAME": "nvidia", "__GLX_VENDOR_LIBRARY_NAME": "nvidia"})
env = {"LIBVA_DRIVER_NAME": "i965"}
pick(env, "0x10de", "0x8086")
ok("  but a driver someone chose is kept", env["LIBVA_DRIVER_NAME"] == "i965")
env = {}
ok("no Mesa installed: nothing changes (it would leave no GL at all)",
   neuronet.prefer_integrated_gpu(env, machine("0x10de", "0x8086"), "/nope/50_mesa.json") == {} and env == {})
ok("no /sys/class/drm: nothing changes", neuronet.prefer_integrated_gpu({}, "/nope", mesa) == {})
os.remove(mesa)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
