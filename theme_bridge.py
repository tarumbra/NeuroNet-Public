"""The one palette.

Cam: "I want the UI color to be the same throughout the app for
continuity."

Each ported app arrived with its own complete colour system, defined on
:root. Scoping those onto each module's shell stopped them repainting
the host -- but it left four different-looking apps in one window:
Cranium magenta, Chords blue, Celestial purple, NeuroNet ember.

So the tokens are not deleted, they are REDEFINED in terms of the
host's. Every module keeps its own vocabulary -- Cranium still says
--bg-panel, Celestial still says --warm-white -- and all of them now
resolve to the same nine-theme palette the host is using. Nothing in the
ported CSS had to change, and switching theme in Settings moves the
whole app at once, which is the actual test of continuity.

Structural tokens (spacing, type scale) are left alone: they are each
app's own layout, not its colour.
"""

# Celestial and Chords descend from the same design language and share a
# vocabulary. Cranium has its own.
WARM = {
    "--cream": "--bg", "--cream-deep": "--elevated",
    "--warm-white": "--panel",
    "--ink": "--ink", "--charcoal": "--text", "--soft-grey": "--muted",
    "--line": "--line", "--line-strong": "--line-strong",
    "--tomato": "--accent", "--tomato-deep": "--accent-deep",
    "--tomato-tint": "--accent-tint",
    "--terracotta": "--accent-hover", "--terracotta-deep": "--accent-deep",
    "--terracotta-tint": "--accent-tint",
    "--olive": "--good", "--olive-deep": "--good", "--olive-tint": "--accent-tint",
    "--gold": "--star", "--gold-deep": "--star", "--gold-tint": "--accent-tint",
    "--accent": "--accent", "--accent-tint": "--accent-tint",
    "--on-accent": "--on-accent",
    "--chord-btn": "--accent", "--chord-btn-deep": "--accent-deep",
    "--chord-btn-tint": "--accent-tint",
    "--font-display": "--font-display", "--font-body": "--font",
    "--font-mono": "--font-mono",
    "--radius-sm": "--radius", "--radius-md": "--radius",
    "--radius-lg": "--radius-lg",
}

CRANIUM = {
    "--bg-app": "--bg", "--bg-panel": "--panel", "--bg-elevated": "--elevated",
    "--bg-hover": "--hover", "--bg-active": "--active",
    "--line": "--line", "--line-strong": "--line-strong",
    "--ink": "--ink", "--text": "--text",
    "--text-muted": "--muted", "--text-faint": "--faint",
    "--accent": "--accent", "--accent-hover": "--accent-hover",
    "--accent-deep": "--accent-deep", "--accent-tint": "--accent-tint",
    "--on-accent": "--on-accent",
    "--good": "--good", "--good-deep": "--good", "--good-tint": "--accent-tint",
    "--danger": "--danger", "--danger-tint": "--danger-tint",
    "--warn": "--star",
    "--radius": "--radius", "--radius-lg": "--radius-lg",
    "--font": "--font", "--font-mono": "--font-mono",
}


def bridge(shell_id, mapping):
    """The block that goes LAST in a module's stylesheet.

    Last matters: these have the same specificity as the module's own
    token block, so the later one wins. Put first, they lose silently
    and the module keeps its old colours -- which is exactly what
    happened to Chords' top bar the first time.

    IDENTITY MAPPINGS ARE SKIPPED, and that is not a tidiness choice.
    `--line: var(--line)` ON THE SAME ELEMENT is a cycle: the spec makes
    a self-referencing custom property invalid at computed-value time,
    so it resolves to NOTHING rather than to the inherited value.
    Emitted naively, this block emptied --line, --accent, --text, --ink,
    --radius and --font in all three modules at once -- borders gone,
    accent gone, text unstyled. Measured, every one of them came back
    "(EMPTY)".

    A token whose name is the same on both sides needs no bridge: it
    simply inherits from :root, which is the whole point.
    """
    lines = ["", "/* " + "=" * 68,
             "   ONE PALETTE — see theme_bridge.py.",
             "   " + "=" * 68,
             "   These redefine this module's own colour names in terms of the",
             "   host's, so every screen in NeuroNet is the same colour and one",
             "   theme change moves all of them. Deliberately LAST in the file:",
             "   same specificity as the block above, so the later rule wins.",
             "   */",
             "#%s {" % shell_id]
    same = []
    for own, host in mapping.items():
        if own == host:            # see the docstring: this would be a cycle
            same.append(own)
            continue
        pad = " " * max(1, 18 - len(own))
        lines.append("  %s:%svar(%s);" % (own, pad, host))
    if same:
        lines.append("  /* inherited from :root as they are, same name both")
        lines.append("     sides -- bridging them would be a cycle:")
        for n in same:
            lines.append("     %s" % n)
        lines.append("   */")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


import os
import re


def host_tokens():
    """Every custom property the host defines on :root.

    Read from shared.css rather than listed here, so adding a token to
    the host cannot leave this file quietly out of date.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "ui", "shared.css")
    with open(path, encoding="utf-8") as f:
        css = f.read()
    names = set()
    for m in re.finditer(r":root\s*\{([^}]*)\}", css):
        names |= set(re.findall(r"(--[\w-]+)\s*:", m.group(1)))
    return names


def strip_host_tokens(block_body, owned):
    """Drop a module's own declarations of tokens the HOST also defines.

    Bridging them is impossible -- `--line: var(--line)` on the same
    element is a cycle and resolves to nothing. Leaving them alone is
    worse: the module keeps its own --accent and --line and stays a
    different colour, which is the thing being fixed.

    So they are removed, and the host's values inherit down. That is the
    only one of the three options that actually works.
    """
    out, dropped = [], []
    for line in block_body.split("\n"):
        m = re.match(r"\s*(--[\w-]+)\s*:", line)
        if m and m.group(1) in owned:
            dropped.append(m.group(1))
            continue
        out.append(line)
    return "\n".join(out), dropped
