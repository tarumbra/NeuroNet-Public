"""A deck's guidebook -- all of it or chosen cards -- as a PDF.

Cam: "Printing guidebook from a tarot deck gets stuck on preparing, change to
export to PDF then i can just print that PDF."

Why it stuck: the page used to be built in the web page, which fetched every
card's picture across the pywebview bridge (78 x ~200 KB) and then sent the
whole 16 MB document back across it. Now nothing big crosses the bridge: the
page asks for "this deck, these cards", and everything happens here, reading
the pictures straight off the disk.

The design is unchanged: the shared letterhead (print_header.header_html)
with the divination mark on the right, green headings, the two-tone rule --
the same page as every other printout in the app. Chromium renders it to PDF
(exactly what the print preview would have shown); if Chromium isn't
installed, the Qt web engine NeuroNet itself runs on does it instead.
"""
import html
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

import print_header as ph

INK, TINT = ph.BRAND_INK, ph.BRAND
KIND_LABEL = {"tarot": "Tarot", "oracle": "Oracle", "lenormand": "Lenormand"}
LOGO, LOGO_NAME = "divination.png", "divination"

CSS = f"""
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact;
      print-color-adjust: exact; }}
  body {{ margin: 0; font: 11pt/1.55 "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
         color: #1F2A24; background: #fff; }}
  .page {{ padding: 4pt 6pt; page-break-after: always; break-after: page; }}
  .page:last-child {{ page-break-after: auto; break-after: auto; }}
  .cover-main {{ text-align: center; margin-top: 40pt; }}
  .cover-kicker {{ font: 600 11pt/1.3 Helvetica, Arial, sans-serif;
                  letter-spacing: .18em; text-transform: uppercase;
                  color: #5d665f; margin: 0; }}
  .cover-rule {{ width: 70pt; height: 2pt; background: #1F2A24;
                margin: 12pt auto 18pt; }}
  .cover-title {{ font-size: 30pt; font-weight: 700; line-height: 1.15;
                 margin: 8pt 0 0; color: #1F2A24; }}
  .cover-art {{ display: block; margin: 0 auto; max-width: 62%;
               max-height: 130mm; object-fit: contain; border-radius: 6pt; }}
  .cover-sub {{ margin-top: 18pt; font-size: 13pt; color: #5d665f;
               font-style: italic; }}
  .cover-meta {{ margin-top: 10pt; font: 9.5pt Helvetica, Arial, sans-serif;
                color: #5d665f; }}
  /* the house style (2026-10-05): a dark rule under titles, not the two-tone one */
  .rule {{ height: 2px; margin: 0 0 12pt; border: 0; background: #1F2A24; }}
  h2.toc-title {{ font-size: 15pt; margin: 14pt 0 2pt; color: #1F2A24; }}
  .toc {{ columns: 3; column-gap: 20pt; }}
  .toc-group {{ break-inside: avoid; margin: 0 0 10pt; }}
  .toc-suit {{ font: 600 8.5pt Helvetica, Arial, sans-serif; letter-spacing: .16em;
              text-transform: uppercase; color: {INK}; margin: 0 0 3pt; }}
  .toc ol {{ margin: 0; padding-left: 22pt; }}
  .toc li {{ margin: 1pt 0; font-size: 9.5pt; line-height: 1.35; }}
  .toc li::marker {{ color: {INK}; font-weight: bold; }}
  /* The picture sits top left and the words wrap round it, then use the
     whole width: a long synopsis fills the page instead of running on. */
  .card {{ margin-top: 10pt; }}
  .card::after {{ content: ""; display: block; clear: both; }}
  .card-art {{ float: left; width: 40%; margin: 0 18pt 10pt 0; }}
  .card-art img {{ display: block; width: 100%; max-height: 165mm;
                  object-fit: contain; border-radius: 6pt; }}
  .card-art .blank {{ aspect-ratio: 5 / 7; border: 1.5pt dashed #c8bdb0;
                     border-radius: 6pt; }}
  .card-text {{ font-size: 10.5pt; line-height: 1.5; }}
  .card-kicker {{ font: 600 8.5pt Helvetica, Arial, sans-serif; letter-spacing: .16em;
                 text-transform: uppercase; color: {INK}; margin: 0 0 3pt; }}
  .card-text h1 {{ font-size: 21pt; line-height: 1.2; margin: 0 0 4pt; color: #1F2A24; }}
  .card-text h2 {{ font: 700 9pt Helvetica, Arial, sans-serif; letter-spacing: .12em;
                  text-transform: uppercase; color: #1F2A24; margin: 14pt 0 4pt; }}
  .card-text p {{ margin: 0 0 8pt; white-space: pre-wrap; }}
  .card-empty {{ color: #5d665f; font-style: italic; }}
  @page {{ size: A4; margin: 12mm; }}"""


def _e(s):
    return html.escape(str(s or ""), quote=True)


def plain(v):
    """Card text, whatever shape it arrived in (see journal.plain)."""
    if isinstance(v, list):
        return "".join(r[0] if isinstance(r, list) and r and isinstance(r[0], str)
                       else (r if isinstance(r, str) else "") for r in v).strip("\n")
    return v if isinstance(v, str) else ("" if v is None else str(v))


def _file_url(path):
    from urllib.request import pathname2url
    return "file:" + pathname2url(os.path.abspath(path))


def build_html(deck, cards, kind, cover=True, image_path=None, today=None):
    """The document. `cards` are the deck's own card dicts, in deck order;
    `image_path(name)` gives a card picture's file on disk, or None."""
    label = KIND_LABEL.get(kind, "Divination")
    total = len(deck.get("cards") or [])
    pos = {c.get("id"): i + 1 for i, c in enumerate(deck.get("cards") or [])}
    image_path = image_path or (lambda name: None)

    def img(name, cls=""):
        path = image_path(name) if name else None
        return f'<img class="{cls}" src="{_file_url(path)}" alt="">' if path else ""

    def head(title, sub):
        return ph.header_html(title, subtitle=sub, right_logo=LOGO, right_name=LOGO_NAME)

    day = today or datetime.now()
    when = f"{day.day} {day.strftime('%B %Y')}"
    parts = []
    if cover and len(cards) > 1:
        n = len(cards)
        groups = []
        for c in cards:
            suit = c.get("suit") or ""
            if groups and groups[-1][0] == suit:
                groups[-1][1].append(c)
            else:
                groups.append((suit, [c]))
        cover_head = head(deck.get("name"), f"{label} guidebook")
        parts.append(f"""<section class="page cover">
          {cover_head}
          <div class="cover-main">
            <p class="cover-kicker">{_e(label)} guidebook</p>
            <h1 class="cover-title">{_e(deck.get("name"))}</h1>
            <div class="cover-rule"></div>
            {img(deck.get("cover"), "cover-art")}
            <p class="cover-sub">{f"All {total} cards" if n == total else f"{n} of the deck's {total} cards"}</p>
            <p class="cover-meta">Exported {_e(when)}</p>
          </div>
        </section>
        <section class="page">
          {cover_head}
          <h2 class="toc-title">Contents</h2><hr class="rule">
          <div class="toc">{"".join(f'''<div class="toc-group">
            {f'<p class="toc-suit">{_e(suit)}</p>' if suit else ""}
            <ol>{"".join(f'<li value="{pos.get(c.get("id"))}">{_e(c.get("name"))}</li>' for c in group)}</ol>
          </div>''' for suit, group in groups)}</div>
        </section>""")

    def section(title, text):
        text = plain(text).strip()
        return f"<h2>{title}</h2><p>{_e(text)}</p>" if text else ""

    for c in cards:
        body = (section("Upright", c.get("upright")) + section("Reversed", c.get("reversed"))
                + section("Card Synopsis", c.get("synopsis")))
        parts.append(f"""<section class="page">
          {head(c.get("name"), deck.get("name"))}
          <div class="card">
            <div class="card-art">{img(c.get("image")) or '<div class="blank"></div>'}</div>
            <div class="card-text">
              <p class="card-kicker">{_e(c.get("suit") or label)} &middot; Card {pos.get(c.get("id"))} of {total}</p>
              <h1>{_e(c.get("name"))}</h1><hr class="rule">
              {body or '<p class="card-empty">Nothing written for this card yet.</p>'}
            </div>
          </div>
        </section>""")

    return (f'<!DOCTYPE html><html><head><meta charset="utf-8">'
            f'<title>{_e(deck.get("name"))} — Guidebook</title>'
            f'<style>{CSS}</style></head><body>{"".join(parts)}</body></html>')


# ------------------------------------------------------------ rendering --
CHROMIUMS = ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
             "microsoft-edge", "microsoft-edge-stable", "brave", "brave-browser")
WINDOWS_CHROMIUMS = (
    r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
    r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
    r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
    r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
)


def find_chromium():
    for name in CHROMIUMS:
        path = shutil.which(name)
        if path:
            return path
    if os.name == "nt":
        for p in WINDOWS_CHROMIUMS:
            p = os.path.expandvars(p)
            if os.path.isfile(p):
                return p
    return None


def _chromium_pdf(exe, html_path, pdf_path, timeout):
    profile = tempfile.mkdtemp(prefix="neuronet-pdf-")
    try:
        subprocess.run(
            [exe, "--headless=new", "--disable-gpu", "--no-first-run",
             "--no-default-browser-check", "--allow-file-access-from-files",
             f"--user-data-dir={profile}", "--no-pdf-header-footer",
             f"--print-to-pdf={pdf_path}", _file_url(html_path)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=timeout, check=False)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    return os.path.isfile(pdf_path) and os.path.getsize(pdf_path) > 0


# The Qt web engine, in a process of its own: it cannot be started inside the
# running app's API thread, and a render that fails must not take the app
# down with it. The settings are the ones a headless QtWebEngine needs here
# (see the notes on test_qt_permissions.py).
_QT_SCRIPT = r"""
import os, sys
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("QTWEBENGINE_DISABLE_SANDBOX", "1")
from PyQt6.QtCore import Qt, QUrl, QCoreApplication, QMarginsF, QTimer
QCoreApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts)
from PyQt6.QtWidgets import QApplication
from PyQt6.QtWebEngineCore import QWebEnginePage
from PyQt6.QtGui import QPageLayout, QPageSize
app = QApplication(sys.argv[:1])
page = QWebEnginePage()
src, dest = sys.argv[1], sys.argv[2]
def done(ok):
    if not ok:
        os._exit(2)
    layout = QPageLayout(QPageSize(QPageSize.PageSizeId.A4),
                         QPageLayout.Orientation.Portrait, QMarginsF(12, 12, 12, 12),
                         QPageLayout.Unit.Millimeter)
    page.pdfPrintingFinished.connect(lambda path, good: os._exit(0 if good else 3))
    QTimer.singleShot(300, lambda: page.printToPdf(dest, layout))
page.loadFinished.connect(done)
page.load(QUrl.fromLocalFile(src))
app.exec()
os._exit(4)
"""


def _qt_pdf(html_path, pdf_path, timeout):
    try:
        subprocess.run([sys.executable, "-c", _QT_SCRIPT, html_path, pdf_path],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return os.path.isfile(pdf_path) and os.path.getsize(pdf_path) > 0


def html_to_pdf(html_text, pdf_path, timeout=300):
    """Renders a finished page to `pdf_path`. {"ok": True, "engine": ...} or
    {"error": ...}."""
    work = tempfile.mkdtemp(prefix="neuronet-guidebook-")
    try:
        src = os.path.join(work, "guidebook.html")
        with open(src, "w", encoding="utf-8") as f:
            f.write(html_text)
        tmp_pdf = os.path.join(work, "guidebook.pdf")
        exe = find_chromium()
        try:
            if exe and _chromium_pdf(exe, src, tmp_pdf, timeout):
                engine = "chromium"
            elif _qt_pdf(src, tmp_pdf, timeout):
                engine = "qt"
            else:
                return {"error": "Couldn't make the PDF. It needs Chromium or Chrome "
                                 "installed (or the Qt web engine NeuroNet uses)."}
        except subprocess.TimeoutExpired:
            return {"error": "Making the PDF took too long and was stopped."}
        shutil.move(tmp_pdf, pdf_path)
        return {"ok": True, "engine": engine}
    except OSError as e:
        return {"error": f"Couldn't save the PDF: {e}"}
    finally:
        shutil.rmtree(work, ignore_errors=True)


def open_file(path):
    """Opens the PDF in whatever the computer uses for PDFs."""
    try:
        if os.name == "nt":
            os.startfile(path)                      # noqa: S606
        else:
            opener = "xdg-open" if sys.platform.startswith("linux") else "open"
            subprocess.Popen([opener, path], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except OSError:
        return False
