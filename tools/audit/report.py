"""Build an audit report as HTML and print it to PDF (2026-10-18). A Report collects sections; each section is plain
HTML made with the helpers below, and figures are SVG from charts.py.

    r = Report("NeuroPets Audit", "subtitle", "18 October 2026")
    r.h1("1. Summary"); r.p("..."); r.fig(charts.bar(...), "Figure caption"); r.table(["A", "B"], rows)
    r.write("out.html"); r.pdf("out.pdf")
"""
import os, re, subprocess
from html import escape

HERE = os.path.dirname(os.path.abspath(__file__))

CSS = """
@page { size: A4; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.4pt/1.5 'Noto Sans', 'DejaVu Sans', sans-serif; color: #3b2213; background: #fff; }
h1 { font-size: 19pt; margin: 0 0 8pt; padding: 6pt 0 5pt; border-bottom: 2.5pt solid #8a5434; break-after: avoid; page-break-before: always; }
h1.first { page-break-before: auto; }
h2 { font-size: 13.5pt; margin: 14pt 0 5pt; color: #6a3a1c; break-after: avoid; }
h3 { font-size: 11pt; margin: 11pt 0 3pt; break-after: avoid; }
p { margin: 0 0 7pt; } ul, ol { margin: 0 0 8pt; padding-left: 16pt; } li { margin: 0 0 2.5pt; }
.lead { font-size: 11.5pt; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 9pt; break-inside: auto; }
th { background: #8a5434; color: #fff6e6; text-align: left; padding: 4pt 6pt; font-weight: 700; }
td { padding: 3.5pt 6pt; border-bottom: .6pt solid #e2cfa8; vertical-align: top; }
tr:nth-child(even) td { background: #f8eedb; }
tr { break-inside: avoid; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
figure { margin: 6pt 0 12pt; padding: 8pt 10pt 6pt; background: #f6ead2; border: .8pt solid #d9c29a; border-radius: 6pt; break-inside: avoid; }
figcaption { font-size: 8.8pt; color: #6f4a2b; margin-top: 4pt; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; } .two figure { margin: 0 0 10pt; }
.callout { padding: 8pt 11pt; margin: 6pt 0 11pt; border-left: 4pt solid #4e8a2c; background: #eef3e2; border-radius: 0 6pt 6pt 0; break-inside: avoid; }
.callout.warn { border-color: #c9773d; background: #fbeedd; } .callout.bad { border-color: #b8402a; background: #f8e3dc; }
.callout > b:first-child { display: block; margin-bottom: 2pt; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7pt; margin: 6pt 0 12pt; }
.kpi { background: #f6ead2; border: .8pt solid #d9c29a; border-radius: 6pt; padding: 7pt 8pt; break-inside: avoid; }
.kpi b { display: block; font-size: 17pt; line-height: 1.1; color: #8a5434; } .kpi span { font-size: 8.5pt; color: #6f4a2b; }
.tag { display: inline-block; padding: 0 5pt; border-radius: 8pt; font-size: 8pt; font-weight: 700; color: #fff; background: #8a5434; }
.tag.high { background: #b8402a; } .tag.med { background: #c9773d; } .tag.low { background: #4e8a2c; } .tag.info { background: #2f7f8f; }
.by { font-size: 9pt; color: #6f4a2b; margin: -4pt 0 8pt; font-style: italic; }
.small { font-size: 8.6pt; color: #6f4a2b; }
.cover { height: 257mm; display: flex; flex-direction: column; justify-content: center; padding: 0 8mm; background:
  radial-gradient(ellipse at 30% 20%, #fff6e2 0, #f3e3c3 60%, #e8d0a4 100%); border: 3pt solid #8a5434; border-radius: 10pt; }
.cover h1 { border: 0; font-size: 34pt; margin: 0; page-break-before: auto; padding: 0; }
.cover .sub { font-size: 14pt; color: #6a3a1c; margin: 6pt 0 26pt; }
.cover .meta { font-size: 10.5pt; line-height: 1.7; } .cover img { width: 120px; margin-bottom: 18pt; }
.toc { columns: 2; column-gap: 18pt; font-size: 10pt; } .toc div { break-inside: avoid; padding: 1.5pt 0; border-bottom: .5pt dotted #d9c29a; }
.mock { border: .8pt solid #d9c29a; border-radius: 6pt; overflow: hidden; background: #fff; break-inside: avoid; }
.mock img { display: block; width: 100%; }
code { font: 8.8pt 'DejaVu Sans Mono', monospace; background: #f1e3c6; padding: 0 2pt; border-radius: 2pt; }
.cite { font-size: 8.5pt; } .cite li { margin-bottom: 3pt; word-break: break-all; }
"""


class Report:
    def __init__(self, title, subtitle, date, footer=None, logo=None):
        self.title, self.subtitle, self.date, self.footer, self.logo = title, subtitle, date, footer or title, logo
        self.parts, self.heads, self.meta = [], [], []
        self._first = True

    # ---- blocks -------------------------------------------------------------------------------------------------------
    def raw(self, html): self.parts.append(html); return self
    def h1(self, text, by=None):
        cls = ' class="first"' if self._first else ""
        self._first = False
        self.heads.append(text)
        self.parts.append(f'<h1{cls}>{escape(text)}</h1>' + (f'<p class="by">{escape(by)}</p>' if by else ""))
        return self
    def h2(self, text): self.parts.append(f"<h2>{escape(text)}</h2>"); return self
    def h3(self, text): self.parts.append(f"<h3>{escape(text)}</h3>"); return self
    def p(self, html, cls=""): self.parts.append(f'<p{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{html}</p>'); return self
    def ul(self, items): self.parts.append("<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"); return self
    def ol(self, items): self.parts.append("<ol>" + "".join(f"<li>{i}</li>" for i in items) + "</ol>"); return self
    def callout(self, title, html, kind=""): self.parts.append(f'<div class="callout {kind}"><b>{escape(title)}</b>{html}</div>'); return self
    def kpis(self, items): self.parts.append('<div class="kpis">' + "".join(f'<div class="kpi"><b>{escape(str(v))}</b><span>{escape(l)}</span></div>' for v, l in items) + "</div>"); return self
    def fig(self, svg, caption=""): self.parts.append(f"<figure>{svg}<figcaption>{caption}</figcaption></figure>"); return self
    def figs(self, a, ca, b, cb): self.parts.append(f'<div class="two"><figure>{a}<figcaption>{ca}</figcaption></figure><figure>{b}<figcaption>{cb}</figcaption></figure></div>'); return self
    def img(self, path, caption=""):
        self.parts.append(f'<figure><div class="mock"><img src="file://{escape(os.path.abspath(path))}"></div><figcaption>{caption}</figcaption></figure>'); return self
    def imgs(self, a, ca, b, cb):
        self.parts.append(f'<div class="two"><figure><div class="mock"><img src="file://{escape(os.path.abspath(a))}"></div><figcaption>{ca}</figcaption></figure>'
                          f'<figure><div class="mock"><img src="file://{escape(os.path.abspath(b))}"></div><figcaption>{cb}</figcaption></figure></div>'); return self
    def table(self, head, rows, num=()):
        """num: column indexes to right-align. Cells are HTML (escape your own text)."""
        h = "".join(f'<th class="num">{escape(c)}</th>' if i in num else f"<th>{escape(c)}</th>" for i, c in enumerate(head))
        b = "".join("<tr>" + "".join(f'<td class="num">{c}</td>' if i in num else f"<td>{c}</td>" for i, c in enumerate(r)) + "</tr>" for r in rows)
        self.parts.append(f"<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>")
        return self

    # ---- output -------------------------------------------------------------------------------------------------------
    def html(self):
        logo = f'<img src="file://{escape(self.logo)}" alt="">' if self.logo else ""
        cover = (f'<div class="cover">{logo}<h1>{escape(self.title)}</h1><div class="sub">{escape(self.subtitle)}</div>'
                 f'<div class="meta">{"<br>".join(self.meta)}<br>{escape(self.date)}</div></div>')
        toc = '<h1>Contents</h1><div class="toc">' + "".join(f"<div>{escape(h)}</div>" for h in self.heads) + "</div>"
        self._first_html = True
        body = "".join(self.parts).replace('<h1 class="first">', "<h1>", 1)
        return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(self.title)}</title><style>{CSS}</style></head>'
                f"<body>{cover}{toc}{body}</body></html>")

    def write(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.html())
        return path

    def pdf(self, html_path, pdf_path):
        r = subprocess.run(["node", os.path.join(HERE, "pdf.js"), html_path, pdf_path, self.footer], capture_output=True, text=True, timeout=300)
        print(r.stdout.strip() or r.stderr.strip())
        return r.returncode == 0


def tag(level):
    """A severity chip: high / med / low / info."""
    names = {"high": "High", "med": "Medium", "low": "Low", "info": "Note"}
    return f'<span class="tag {level}">{names[level]}</span>'
