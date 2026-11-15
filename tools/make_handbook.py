#!/usr/bin/env python3
"""A Scribe folder of notes made into one PDF book on Scribe's Ebooks shelf (2026-11-08, Cam: the Networking Handbook
"can also be provided as a PDF within neuronet"). The notes stay the source: change them, run this again, and the book
on the shelf is swapped in place (ebooks.Library.shelve keeps the reading position, bookmarks and highlights).

    python3 tools/make_handbook.py "Networking Handbook" "NeuroNet Networking Handbook" [--subtitle ...] [--no-shelve out.pdf]

The folder is under the main vault (<data>/notes/vault/<folder>); its .md notes go in file-name order. The markdown
is Scribe's everyday kind: headings, paragraphs, lists, tick boxes, tables, code blocks, **bold**, *italic*, `code`.
Needs Chromium (headless, prints the PDF)."""
import argparse
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)

CSS = """
@page { size: A4; margin: 18mm 17mm 20mm; }
:root { --ink:#1d2330; --soft:#5b6475; --line:#d9dde5; --accent:#2f6f8f; --code:#f3f5f8; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.55 "Noto Sans", "DejaVu Sans", sans-serif; color: var(--ink); margin: 0; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always;
  border-left: 6mm solid var(--accent); padding-left: 14mm; }
.cover h1 { font-size: 34pt; line-height: 1.1; margin: 0 0 6mm; border: 0; }
.cover .sub { font-size: 14pt; color: var(--soft); margin: 0 0 18mm; }
.cover .meta { font-size: 10pt; color: var(--soft); }
.toc { page-break-after: always; }
.toc h2 { margin-top: 0; }
.toc ul { list-style: none; padding-left: 0; font-size: 12pt; line-height: 2; }
section.ch { page-break-before: always; }
h1, h2, h3 { color: var(--ink); line-height: 1.25; page-break-after: avoid; }
h1 { font-size: 21pt; margin: 0 0 5mm; padding-bottom: 2mm; border-bottom: 2px solid var(--accent); }
h2 { font-size: 14pt; margin: 7mm 0 2mm; color: var(--accent); }
h3 { font-size: 11.5pt; margin: 5mm 0 1.5mm; }
p { margin: 0 0 2.6mm; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin: 0.6mm 0; }
li.task { list-style: none; margin-left: -5mm; }
li.task .box { display: inline-block; width: 3.6mm; height: 3.6mm; border: 1.3px solid var(--accent); border-radius: 0.8mm;
  margin-right: 2mm; vertical-align: -0.5mm; text-align: center; font-size: 8pt; line-height: 3.3mm; color: var(--accent); }
code { font: 9pt/1.4 "JetBrains Mono", "DejaVu Sans Mono", monospace; background: var(--code); padding: 0.2mm 1mm; border-radius: 1mm; }
pre { background: var(--code); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 1.5mm;
  padding: 2.5mm 3.5mm; margin: 0 0 3.5mm; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 8.6pt; }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 4mm; font-size: 9.4pt; page-break-inside: avoid; }
th, td { border: 1px solid var(--line); padding: 1.4mm 2mm; text-align: left; vertical-align: top; }
th { background: #eaf1f5; }
hr { border: 0; border-top: 1px solid var(--line); margin: 5mm 0; }
strong { color: #111; }
"""


def inline(s):
    out, parts = [], re.split(r"(`[^`]+`)", s)
    for p in parts:
        if p.startswith("`") and p.endswith("`") and len(p) > 1:
            out.append("<code>" + html.escape(p[1:-1]) + "</code>")
            continue
        t = html.escape(p)
        t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
        t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
        out.append(t)
    return "".join(out)


def md(text):
    """Scribe's everyday markdown -> HTML (what these notes use; not every corner of the spec)."""
    lines, out, i = text.split("\n"), [], 0
    lists = []                                   # open list tags, e.g. ["ul"]

    def close_lists():
        while lists:
            out.append(f"</{lists.pop()}>")

    while i < len(lines):
        ln = lines[i]
        if ln.startswith("```"):
            close_lists()
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            out.append("<pre><code>" + html.escape("\n".join(lines[i + 1:j])) + "</code></pre>")
            i = j + 1
            continue
        m = re.match(r"(#{1,3}) (.*)", ln)
        if m:
            close_lists()
            n = len(m.group(1))
            out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
            i += 1
            continue
        if ln.strip() == "---":
            close_lists()
            out.append("<hr>")
            i += 1
            continue
        if ln.startswith("|") and i + 1 < len(lines) and re.match(r"\|[\s:|-]+\|?\s*$", lines[i + 1]):
            close_lists()
            row = lambda r: [c.strip() for c in r.strip().strip("|").split("|")]
            head, body, j = row(ln), [], i + 2
            while j < len(lines) and lines[j].startswith("|"):
                body.append(row(lines[j]))
                j += 1
            out.append("<table><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr>"
                       + "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</table>")
            i = j
            continue
        m = re.match(r"\s*(- |\d+\. )(.*)", ln)
        if m:
            tag = "ul" if m.group(1) == "- " else "ol"
            if lists and lists[-1] != tag:
                close_lists()
            if not lists:
                out.append(f"<{tag}>")
                lists.append(tag)
            item = m.group(2)
            t = re.match(r"\[( |x)\] (.*)", item)
            if t:
                out.append(f'<li class="task"><span class="box">{"✓" if t.group(1) == "x" else ""}</span>{inline(t.group(2))}</li>')
            else:
                out.append(f"<li>{inline(item)}</li>")
            i += 1
            continue
        if not ln.strip():
            close_lists()
            i += 1
            continue
        close_lists()
        para = [ln]
        while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(r"(#{1,3} |```|\||\s*(- |\d+\. )|---$)", lines[i + 1]):
            i += 1
            para.append(lines[i])
        out.append("<p>" + inline(" ".join(para)) + "</p>")
        i += 1
    close_lists()
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("title")
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--author", default="Cam and Claude")
    ap.add_argument("--no-shelve", metavar="PDF", help="write the PDF here instead of putting it on the shelf")
    a = ap.parse_args()
    data = subprocess.run(["neuronet-path", "data"], capture_output=True, text=True).stdout.strip() or os.path.join(APP, "neuronet_data")
    src = os.path.join(data, "notes", "vault", a.folder)
    notes = sorted(n for n in os.listdir(src) if n.endswith(".md"))
    if not notes:
        sys.exit(f"make_handbook: no notes in {src}")
    chapters = [open(os.path.join(src, n), encoding="utf-8").read() for n in notes]
    titles = [re.match(r"#\s+(.*)", c).group(1) if re.match(r"#\s+(.*)", c) else n[:-3] for c, n in zip(chapters, notes)]
    import time
    doc = (f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(a.title)}</title><style>{CSS}</style></head><body>"
           f"<div class='cover'><h1>{html.escape(a.title)}</h1><p class='sub'>{html.escape(a.subtitle)}</p>"
           f"<p class='meta'>{html.escape(a.author)} · {time.strftime('%-d %B %Y')}</p></div>"
           "<div class='toc'><h2>Contents</h2><ul>" + "".join(f"<li>{inline(t)}</li>" for t in titles) + "</ul></div>"
           + "".join(f"<section class='ch'>{md(c)}</section>" for c in chapters) + "</body></html>")
    chrome = next((shutil.which(c) for c in ("chromium", "chromium-browser", "google-chrome-stable") if shutil.which(c)), None)
    if not chrome:
        sys.exit("make_handbook: needs Chromium")
    with tempfile.TemporaryDirectory(prefix="nn-handbook-") as t:
        page = os.path.join(t, "book.html")
        with open(page, "w", encoding="utf-8") as f:
            f.write(doc)
        pdf = os.path.join(t, a.title + ".pdf")
        subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-sandbox", f"--user-data-dir={t}/profile", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", "file://" + page], capture_output=True, timeout=180)
        if not os.path.isfile(pdf):
            sys.exit("make_handbook: Chromium didn't make the PDF")
        if a.no_shelve:
            out = os.path.abspath(a.no_shelve)
            shutil.copyfile(pdf, out)
            print(f"{out} ({os.path.getsize(out) // 1024} KB)")
            return 0
        import ebooks
        lib = ebooks.Library(os.path.join(data, "ebooks"))
        r = lib.shelve(pdf)
        if r.get("error"):
            sys.exit("make_handbook: " + r["error"])
        patch = {"title": a.title + (": " + a.subtitle if a.subtitle else ""), "author": a.author}
        if shutil.which("pdftoppm"):          # the cover on the shelf: page one, small
            subprocess.run(["pdftoppm", "-jpeg", "-r", "40", "-f", "1", "-l", "1", "-singlefile", pdf, os.path.join(t, "cover")], capture_output=True)
            if os.path.isfile(os.path.join(t, "cover.jpg")):
                import base64
                patch["cover"] = "data:image/jpeg;base64," + base64.b64encode(open(os.path.join(t, "cover.jpg"), "rb").read()).decode()
        lib.update(r["id"], patch)
        print(f"on Scribe's Ebooks shelf: {a.title} ({os.path.getsize(pdf) // 1024} KB, {len(notes)} chapters, "
              + ("new" if r.get("fresh") else "updated" if r.get("refreshed") else "unchanged") + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
