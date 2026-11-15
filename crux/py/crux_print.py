"""crux.print — getting a document in front of the user's eyes.

TWO THINGS EVERY APP IN THIS PROJECT LEARNED SEPARATELY, both fixed here
once:

1. window.open() DOES NOT WORK. pywebview renders into a native OS
   webview inside the app's own window frame, not a browser with popup
   or tab support, so window.open() returns null every time. Cheffo,
   Coach Cam and Cashbox each hit this and each shipped "Couldn't open
   print" before the real fix: build the HTML in Python, write it to a
   real temp file, and hand it to the OS's actual default browser, which
   has a real window and a real print dialog.

2. A NEW WINDOW, NOT A TAB. Cam: "force a new browser to open, i don't
   want a tab in a current browser. It gets confusing which one i am
   printing. Plus i lose the tab amongst the others or dont see it at
   all if a browser is open in the background." webbrowser.open() reuses
   an existing window; new=1 only ASKS and is ignored by most browsers.
   The browsers' own --new-window flags are honoured, so those are tried
   first.
"""

import os
import shutil
import subprocess
import sys
import tempfile
import webbrowser

# Tried in order; the first one actually installed wins.
_LINUX_BROWSERS = ("firefox", "google-chrome", "google-chrome-stable",
                   "chromium", "chromium-browser", "brave-browser",
                   "microsoft-edge")


def open_in_new_window(url):
    """Opens a URL in a genuinely new browser window where possible."""
    if sys.platform == "darwin":
        try:
            subprocess.Popen(["open", "-n", "-a", "Safari", url],
                             stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
            return {"ok": True}
        except (OSError, subprocess.SubprocessError):
            pass
    elif os.name == "nt":
        # cmd's `start` needs that empty "" or it treats the first
        # quoted argument as the window title.
        for exe in ("chrome", "msedge", "firefox"):
            try:
                subprocess.Popen(
                    ["cmd", "/c", "start", "", exe, "--new-window", url],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    shell=False)
                return {"ok": True}
            except (OSError, subprocess.SubprocessError):
                continue
    else:
        for exe in _LINUX_BROWSERS:
            found = shutil.which(exe)
            if not found:
                continue
            try:
                subprocess.Popen([found, "--new-window", url],
                                 stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
                return {"ok": True}
            except (OSError, subprocess.SubprocessError):
                continue

    # Nothing recognised: a tab is still better than no printout.
    try:
        webbrowser.open(url, new=1)
        return {"ok": True}
    except Exception as e:                       # noqa: BLE001
        return {"error": f"Couldn't open the print view: {e}"}


def open_html(html, prefix="kincrux-print-"):
    """Writes a finished HTML document to a temp file and opens it."""
    try:
        fd, path = tempfile.mkstemp(suffix=".html", prefix=prefix)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(html)
        return open_in_new_window("file://" + path)
    except OSError as e:
        return {"error": f"Couldn't open the print view: {e}"}


def he(s):
    """HTML-escape. Every field that is not deliberately rich text goes
    through this on its way to a printed page."""
    return (str(s if s is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def print_css(accent="#C7392C", ink="#33302E", paper="#FBF6EF",
              muted="#8A7F71", rule="#E6DED2", panel="#F3EBDE"):
    """The shared print stylesheet.

    print-color-adjust is forced deliberately: most browsers strip
    background colours when actually printing — only the on-screen
    preview shows them — unless the page opts back in. Without this a
    coloured title bar looks right in the tab and then silently prints
    as blank white paper.
    """
    return f"""
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact;
       print-color-adjust: exact; color-adjust: exact; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Arial, sans-serif; color: {ink}; background: {paper};
          margin: 0; }}
  .pr-wrap {{ max-width: 720px; margin: 0 auto; padding: 0 36px 48px; }}
  .pr-titlebar {{ background: {accent}; color: #FFFDF8;
                  padding: 30px 36px 26px; margin-bottom: 26px; }}
  .pr-titlebar h1 {{ font-family: Georgia, "Times New Roman", serif;
                     margin: 0; font-size: 32px; }}
  .pr-meta {{ margin: 8px 0 0; font-size: 15px; opacity: .9; }}
  h2 {{ font-family: Georgia, "Times New Roman", serif; color: {accent};
        border-left: 4px solid {accent}; padding-left: 12px;
        font-size: 21px; margin: 28px 0 10px; }}
  p, li {{ font-size: 16px; line-height: 1.55; }}
  ul, ol {{ padding-left: 24px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
  th {{ text-align: left; font-size: 11px; text-transform: uppercase;
        letter-spacing: .04em; color: {muted};
        border-bottom: 2px solid {ink}; padding: 6px 8px; }}
  td {{ padding: 7px 8px; border-bottom: 1px solid {rule};
        font-size: 14.5px; }}
  .pr-note {{ background: {panel}; border-radius: 10px;
              padding: 14px 18px; margin-top: 20px; }}
  .pr-chip {{ display: inline-block; background: {panel};
              border: 1px solid {rule}; border-radius: 999px;
              padding: 3px 13px; font-size: 13px; margin: 0 6px 6px 0; }}
  .pr-page {{ page-break-after: always; }}
  .pr-page:last-child {{ page-break-after: auto; }}
  @media print {{ body {{ background: #FFFFFF; }} }}
"""


def document(title, body_html, meta="", css=None):
    """A complete, self-contained printable page.

    Self-contained matters: this is opened as a temp file, so it can
    reference nothing from the app's own folder. Images must already be
    embedded as data URIs by the caller.
    """
    extra = f'<p class="pr-meta">{meta}</p>' if meta else ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{he(title)}</title>
<style>{css or print_css()}</style></head>
<body>
<div class="pr-titlebar"><h1>{he(title)}</h1>{extra}</div>
<div class="pr-wrap">{body_html}</div>
</body></html>"""
