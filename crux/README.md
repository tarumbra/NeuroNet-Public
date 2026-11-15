# crux — the shared core

One copy of the things every app in this project had grown its own
version of. Fixing a bug here fixes it everywhere, which was the entire
point of the merge.

```
crux/
  js/          loaded by the UI  (copied to ui/crux/ — see below)
    theme.js   themes, text size, first-paint application
    store.js   the pywebview bridge, the localStorage fallback,
               and the stale-write guard
    ui.js      toasts, dialogs, confirms, the veil discipline
  py/          imported by the backend
    crux_store.py  atomic writes, safe reads, the stale-write guard,
                   merge-on-save, shape helpers
    crux_paths.py  app_dir vs resource_dir, data-folder discovery
    crux_print.py  print-to-a-real-browser-window, the print stylesheet
    crux_rich.py   the rich-text allowlist and the two sanitisers
  test/
    harness.js   booting an app under jsdom, with the traps handled
    contrast.js  WCAG contrast measurement for theme checking
```

## Why the JS lives at `ui/crux/` and not `../crux/js/`

Coach Cam paid for this one:

> *Over `file://`, which is how pywebview loads them, WebKitGTK would not
> pull the stylesheets back out of the parent directory, so Forge opened
> as invisible furniture on an invisible background — no error, just a
> blank window.*

So **nothing in the UI traverses upward.** The JS core is a descendant of
`ui/`, referenced as `crux/theme.js`. Python has no such limit — it
imports from `crux/py/` through `sys.path`.

If `crux/py/` is missing, the app exits with an explanation rather than a
raw `ModuleNotFoundError`, because the likely cause is a half-copied
folder.

## What each piece carries

**`crux_store`** — atomic write (temp file in the *same* folder, fsync,
replace: `/tmp` is often a different filesystem and `os.replace` is only
atomic within one). Reads never raise. And the **stale-write guard**,
which only Coach Cam had: pass the stamp you last saw and a write that
would clobber a newer one is refused instead of silently winning.

**`crux_rich`** — attacked with 18 XSS vectors, output *parsed* rather
than pattern-matched. It holds because attributes are dropped
unconditionally; it never tries to filter them. It also carries the fix
for prose in angle brackets — "Simmer &lt;do not boil&gt;" used to print
as "Simmer  ", losing a safety instruction silently.

**`crux_print`** — `window.open()` returns null inside a webview, and
browsers open a tab when you ask for a window. Three apps hit both.

**`crux/js/theme.js`** — a theme is one enumerable object of custom
properties, so the contrast checker can walk every theme automatically.
`data-theme` and `data-shape` are set on the root, so anything colour
cannot express (Aero's gloss, Windows 98's bevels) hangs off CSS.
Applied before first paint from `localStorage`, or every launch flashes
the default theme first.

**`crux/js/ui.js`** — three real bugs' worth of rules: one veil element
per overlay, listeners attached once not per dialog, and close on
mousedown *and* mouseup so a text-selection drag isn't read as a click
outside.

## Adding to it

Anything a second module would otherwise copy belongs here. Anything
only one module needs does not — a shared core that knows about recipes
is no longer shared.
