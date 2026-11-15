"""The letterhead every printout in NeuroNet shares.

Cam: "Now i want Coach Cam print out to have Neuronet on the top left hand
corner and coach cam logo on the top right hand corner. If the application
can handle all printouts like this it will help keep consistency (like a
styled page header). I still want the contents of the coach cam printout to
be the same as it is now with the colors for exercise groupings."

ONE BUILDER, IN ONE LANGUAGE, and that is the whole point of this file.

The printouts are not built in one place. Training renders its documents in
Python, because the same builders also produce its .docx, .xlsx and .pdf;
Personal Effects, the Notes books, the guides, Money and the puzzles all
render theirs in JavaScript. A shared header written twice -- once here and
once in JS -- would be two things that must agree forever, and they would
not: someone nudges a colour on one side, and half the app's paperwork
quietly stops matching the other half. That is exactly the drift Cam is
asking to be rid of.

So it is written once, here, and the JavaScript side ASKS for it across the
bridge (Api.print_header). Printing is rare and always something a person
just clicked, so a round trip costs nothing anyone can feel.

THE ARTWORK HAS ONE HOME TOO. The NeuroNet mark is read out of the app's own
icon sprite in ui/index.html -- the same paths the sidebar draws -- rather
than pasted in here as a copy. Change the logo one day and every printed
page follows. Coach Cam's mark is the PNG that has always been in icons/.

WHAT THIS DOES NOT TOUCH: the contents. Cam asked for the header and said
the rest stays as it is, so nothing here knows anything about sessions,
exercises or the block colours that group them.
"""
import base64
import os
import re

#: NeuroNet's green. The light one is decoration; the dark one is for
#: anything that has to be read on white paper, where the light one
#: measures 2.95:1 and prints washy.
BRAND = "#5FA665"
BRAND_INK = "#2E6B38"
RULE_GREY = "#d8d2ca"
MUTED = "#6a6560"

_cache = {}


def _resource_dir():
    """Where ui/ and icons/ live. Imported lazily so this file can be read
    and tested without booting the whole app."""
    return os.path.dirname(os.path.abspath(__file__))


def neuronet_mark_svg(colour=BRAND, height_pt=30):
    """The NeuroNet wordmark, as inline SVG, from the app's own sprite.

    Returns "" if the sprite cannot be read. A page with no logo is a small
    disappointment; a page with a broken <svg> on it is an embarrassment,
    and printouts leave the house.
    """
    key = ("mark", colour, height_pt)
    if key in _cache:
        return _cache[key]
    path = os.path.join(_resource_dir(), "ui", "index.html")
    out = ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        m = re.search(r'<symbol id="i-neuronet" viewBox="([^"]+)"[^>]*>'
                      r'\s*<path d="([^"]+)"', html)
        if m:
            box, d = m.group(1), m.group(2)
            nums = box.split()
            ratio = (float(nums[2]) / float(nums[3])) if len(nums) == 4 else 3.8
            width = round(height_pt * ratio, 1)
            out = (f'<svg viewBox="{box}" width="{width}" height="{height_pt}" '
                   f'xmlns="http://www.w3.org/2000/svg" role="img" '
                   f'aria-label="NeuroNet" style="display:block">'
                   f'<path fill="{colour}" d="{d}"/></svg>')
    except OSError:
        out = ""
    _cache[key] = out
    return out


def logo_data_uri(name):
    """An icon from icons/, as a data: URI, or None.

    A printed page is a standalone file opened by the printer -- it cannot
    reference anything in the app folder, so the bytes have to travel in it.
    """
    key = ("logo", name)
    if key in _cache:
        return _cache[key]
    path = os.path.join(_resource_dir(), "icons", name)
    uri = None
    try:
        with open(path, "rb") as f:
            uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")
    except OSError:
        uri = None
    _cache[key] = uri
    return uri


def logo_svg(name, colour=BRAND, height_pt=30):
    """An SVG mark from icons/, inlined and recoloured, or "".

    Cam's cookery logo is line art, and line art traced to paths stays
    sharp at any size and takes whatever colour the page needs -- where a
    PNG of it would be a fixed-colour picture on a black square, which is
    the wrong thing to drop onto white paper.

    The file is stored WITHOUT a fill so the colour is decided here. A
    printed page is white, so the deep green is used rather than the light
    brand green, which measures 2.95:1 on white and prints washy.
    """
    key = ("svg", name, colour, height_pt)
    if key in _cache:
        return _cache[key]
    path = os.path.join(_resource_dir(), "icons", name)
    out = ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        m = re.search(r'viewBox="([^"]+)"', raw)
        d = re.search(r'<path d="([^"]+)"', raw)
        if m and d:
            nums = m.group(1).split()
            ratio = (float(nums[2]) / float(nums[3])) if len(nums) == 4 else 1.0
            width = round(height_pt * ratio, 1)
            out = (f'<svg viewBox="{m.group(1)}" width="{width}" '
                   f'height="{height_pt}" xmlns="http://www.w3.org/2000/svg" '
                   f'style="display:block"><path fill="{colour}" '
                   f'd="{d.group(1)}"/></svg>')
    except OSError:
        out = ""
    _cache[key] = out
    return out


def _esc(s):
    return (str("" if s is None else s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def header_html(title, subtitle="", right_logo=None, right_name="", meta=""):
    """The letterhead.

        NeuroNet mark          TITLE           Coach Cam
             (left)          (centred)        logo + name
                                                 (right)
        ------------------- coloured rule -------------------

    THREE COLUMNS, and the outer two are given the SAME fixed width on
    purpose. Left it to flex and the middle column centres on whatever is
    left over rather than on the page, which reads as very slightly
    crooked and is the sort of thing that is hard to name but easy to see.
    The previous Coach Cam header already did this; it is kept.

    `right_logo` is a file name in icons/ ("coachcam-192.png"). Anything
    without a mark of its own passes `meta` instead -- usually the date --
    so the right column still balances the left rather than sitting empty.

    Inline styles throughout, not a stylesheet: this HTML is also fed to
    the .docx converter and pasted into documents built elsewhere, and a
    <style> block that arrives halfway down a page does nothing.
    """
    mark = neuronet_mark_svg(BRAND, 26)
    side = 190

    right_bits = []
    if right_logo:
        if str(right_logo).lower().endswith(".svg"):
            # Line art: inlined as paths, in the deep green, so it is sharp
            # at any size and carries no background onto the page.
            svg = logo_svg(right_logo, BRAND_INK, 30)
            if svg:
                right_bits.append(svg)
        else:
            uri = logo_data_uri(right_logo)
            if uri:
                right_bits.append(
                    f'<img src="{uri}" alt="" width="30" height="30" '
                    f'style="display:block;border-radius:6px">')
    if right_name:
        right_bits.append(
            f'<span style="font-family:sans-serif;font-size:14px;'
            f'font-weight:700;letter-spacing:.01em;color:{BRAND_INK}">'
            f'{_esc(right_name)}</span>')
    if not right_bits and meta:
        right_bits.append(
            f'<span style="font-family:sans-serif;font-size:11px;'
            f'color:{MUTED}">{_esc(meta)}</span>')
    right = (f'<div style="width:{side}px;flex:0 0 {side}px;display:flex;'
             f'align-items:center;justify-content:flex-end;gap:8px">'
             + "".join(right_bits) + "</div>")

    middle = (f'<div style="flex:1;text-align:center;font-family:sans-serif">'
              f'<div style="font-size:19px;font-weight:700;color:{BRAND_INK}">'
              f'{_esc(title)}</div>'
              + (f'<div style="font-size:11px;color:{MUTED};margin-top:2px">'
                 f'{_esc(subtitle)}</div>' if subtitle else "")
              + "</div>")

    left = (f'<div style="width:{side}px;flex:0 0 {side}px;display:flex;'
            f'align-items:center">{mark}</div>')

    return (
        '<div style="display:flex;align-items:center;gap:12px;'
        'padding-bottom:10px;margin-bottom:6px">'
        + left + middle + right +
        '</div>'
        # The rule is its own element rather than a border on the flex row:
        # a gradient border is not a thing, and Cam asked for colour.
        f'<div style="height:2.5pt;margin:0 0 16px;background:linear-gradient('
        f'to right, rgba(95,166,101,0) 0%, {BRAND} 18%, {BRAND_INK} 50%, '
        f'{BRAND} 82%, rgba(95,166,101,0) 100%)"></div>')


# ----------------------------------------------------------------------------
# THE SAME LETTERHEAD IN WORD AND EXCEL.
#
# Cam: "make them match all the prints you have done before." An export built
# by converting the printed page to .docx lost both marks -- the converter can
# carry text, not an inline SVG or a data: picture -- so the Word file opened
# with "[image]" where the logos should be. These draw the letterhead natively:
# NeuroNet's mark on the left, the title centred, the section's mark and name
# on the right, and the green rule under it. Pictures come from icons/;
# NeuroNet's mark is icons/neuronet-mark.png, drawn from the same sprite the
# sidebar and the printed letterhead use.
# ----------------------------------------------------------------------------

def _icon_path(name):
    path = os.path.join(_resource_dir(), "icons", str(name or ""))
    return path if name and os.path.isfile(path) else None


def docx_letterhead(doc, title, subtitle="", right_logo=None, right_name="",
                    meta=""):
    """Adds the letterhead to a python-docx Document. Never raises for a
    missing or unreadable picture: the words stand in for it."""
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt, RGBColor

    ink = RGBColor.from_string(BRAND_INK.lstrip("#").upper())
    muted = RGBColor.from_string(MUTED.lstrip("#").upper())
    table = doc.add_table(rows=1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for cell, w in zip(table.rows[0].cells, (Inches(2.0), Inches(2.6), Inches(2.0))):
        cell.width = w

    left = table.rows[0].cells[0].paragraphs[0]
    mark = _icon_path("neuronet-mark.png")
    drawn = False
    if mark:
        try:
            left.add_run().add_picture(mark, height=Inches(0.26))
            drawn = True
        except Exception:
            drawn = False
    if not drawn:
        r = left.add_run("NeuroNet"); r.bold = True; r.font.size = Pt(12)
        r.font.color.rgb = ink

    mid = table.rows[0].cells[1]
    p = mid.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(str(title or "")); r.bold = True; r.font.size = Pt(15)
    r.font.color.rgb = ink
    if subtitle:
        p2 = mid.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p2.add_run(str(subtitle)); r.font.size = Pt(8.5); r.font.color.rgb = muted

    right = table.rows[0].cells[2].paragraphs[0]
    right.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    logo = _icon_path(right_logo) if right_logo and not str(right_logo).endswith(".svg") else None
    if logo:
        try:
            right.add_run().add_picture(logo, height=Inches(0.36))
            right.add_run(" ")
        except Exception:
            pass
    if right_name:
        r = right.add_run(str(right_name)); r.bold = True; r.font.size = Pt(11)
        r.font.color.rgb = ink
    elif meta:
        r = right.add_run(str(meta)); r.font.size = Pt(8.5); r.font.color.rgb = muted

    rule = doc.add_paragraph()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for k, v in (("w:val", "single"), ("w:sz", "12"), ("w:space", "1"),
                 ("w:color", BRAND.lstrip("#").upper())):
        bottom.set(qn(k), v)
    borders.append(bottom)
    rule._p.get_or_add_pPr().append(borders)
    return table


def xlsx_letterhead(ws, title, subtitle="", right_logo=None, right_name="",
                    ncols=4):
    """The letterhead across the top of a worksheet: NeuroNet's mark in the
    first column, the title and subtitle centred across the rest, the
    section's mark and name at the far right, a green rule under it.
    Returns the first free row for the data."""
    from openpyxl.styles import Alignment, Border, Font, Side
    ncols = max(3, int(ncols or 3))
    ws.row_dimensions[1].height = 34
    ws.merge_cells(start_row=1, start_column=2, end_row=1, end_column=ncols - 1)
    c = ws.cell(1, 2, str(title or ""))
    c.font = Font(bold=True, size=15, color=BRAND_INK.lstrip("#").upper())
    c.alignment = Alignment(horizontal="center", vertical="center")
    if subtitle:
        ws.merge_cells(start_row=2, start_column=2, end_row=2, end_column=ncols - 1)
        s = ws.cell(2, 2, str(subtitle))
        s.font = Font(size=9, color=MUTED.lstrip("#").upper())
        s.alignment = Alignment(horizontal="center")
    if right_name:
        n = ws.cell(2, ncols, str(right_name))
        n.font = Font(bold=True, size=10, color=BRAND_INK.lstrip("#").upper())
        n.alignment = Alignment(horizontal="right")
    try:
        from openpyxl.drawing.image import Image as XLImage
        mark = _icon_path("neuronet-mark.png")
        if mark:
            im = XLImage(mark)
            im.height, im.width = 22, round(22 * im.width / im.height)
            ws.add_image(im, "A1")
        logo = _icon_path(right_logo) if right_logo else None
        if logo:
            im = XLImage(logo)
            im.width, im.height = round(34 * im.width / im.height), 34
            from openpyxl.utils import get_column_letter
            ws.add_image(im, get_column_letter(ncols) + "1")
    except Exception:
        pass            # the words carry it without the pictures
    rule = Side(style="medium", color=BRAND.lstrip("#").upper())
    for col in range(1, ncols + 1):
        ws.cell(3, col).border = Border(bottom=rule)
    return 5


# ----------------------------------------------------------------------------
# THE HOUSE STYLE (2026-10-05).
#
# Cam, after the Training refresh: "That is amazing, it looks clean and
# professional. I would like all printouts from Neuronet to be handled in this
# way please." So the page itself -- type, headings, tables, panels, the title
# block under the letterhead, the footer -- is written once, here, like the
# letterhead. Python builders put HOUSE_CSS in their <head>; the JavaScript
# ones ask for it across the bridge (Api.print_house_css) and use the same
# class names through SS.PrintHouse (ui/print-house.js). Classes are prefixed
# nn- so they can't collide with a module's own.
#
# A module's own stylesheet comes AFTER this one, so it only needs the rules
# that are truly its own (a recipe's tick boxes, a puzzle's grid).
# ----------------------------------------------------------------------------

HOUSE_INK = "#1F2A24"         # text and titles: a deep green-charcoal
HOUSE_HEAD = "#33473B"        # table heads
HOUSE_ACCENT = BRAND_INK      # section bars, kickers (#2E6B38)
HOUSE_MUTED = "#5d665f"
HOUSE_LINE = "#d6d9d3"
HOUSE_PANEL = "#f4f6f2"

HOUSE_CSS = """
@page { size: A4; margin: 14mm 13mm 16mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1F2A24;
  font-size: 13px; line-height: 1.5; max-width: 820px; margin: 28px auto; padding: 0 22px 40px;
  background: #fff; }
@media print { body { margin: 0 auto; padding: 0; } }
p { margin: 0 0 8px; }
h1, h2, h3, h4 { color: #1F2A24; font-family: inherit; }
h1 { font-size: 25px; line-height: 1.2; margin: 0 0 10px; letter-spacing: -.01em; }
h2 { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  margin: 22px 0 9px; padding: 1px 0 1px 10px; border-left: 4px solid #2E6B38;
  break-after: avoid; page-break-after: avoid; }
h3 { font-size: 14px; font-weight: 700; margin: 16px 0 6px; break-after: avoid; }
ul, ol { margin: 0 0 10px; padding-left: 20px; }
li { margin: 3px 0; }
li::marker { color: #2E6B38; font-weight: 700; }
blockquote { margin: 0 0 10px; padding: 4px 0 4px 12px; border-left: 3px solid #d6d9d3; color: #5d665f; }
hr { border: 0; border-top: 1px solid #d6d9d3; margin: 14px 0; }
code, pre { font-family: "JetBrains Mono", Consolas, monospace; }
img { max-width: 100%; }
table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12.5px;
  margin: 4px 0 14px; border: 1px solid #d6d9d3; border-radius: 6px; overflow: hidden; }
th { background: #33473B; color: #fff; text-align: left; font-size: 10px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; padding: 8px 10px; }
td { padding: 7px 10px; border-top: 1px solid rgba(31,42,36,.12); vertical-align: top; }
tr { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }
.nn-title-block { margin: 18px 0 14px; }
.nn-kicker { font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: #2E6B38; margin-bottom: 4px; break-after: avoid; page-break-after: avoid; }
.nn-title { font-size: 25px; line-height: 1.2; font-weight: 700; margin: 0 0 10px;
  padding-bottom: 10px; border-bottom: 2px solid #1F2A24; letter-spacing: -.01em; }
.nn-sub { font-size: 13px; color: #5d665f; margin: -4px 0 10px; }
.nn-chips { display: flex; flex-wrap: wrap; gap: 6px 8px; }
.nn-chip { font-size: 11px; color: #5d665f; background: #f4f6f2; border: 1px solid #d6d9d3;
  border-radius: 999px; padding: 2px 10px; }
.nn-chip b { color: #1F2A24; font-weight: 600; margin-right: 2px; }
.nn-panel { background: #f4f6f2; border: 1px solid #d6d9d3; border-left: 4px solid #2E6B38;
  border-radius: 6px; padding: 10px 14px; margin: 10px 0 14px; break-inside: avoid; }
.nn-panel p:last-child { margin-bottom: 0; }
.nn-panel-label { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: #2E6B38; margin-bottom: 4px; }
.nn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0 14px; }
.nn-grid .nn-panel { margin: 0; }
.nn-grid .nn-panel.wide { grid-column: 1 / -1; }
.nn-page-break { break-before: page; page-break-before: always; }
.nn-foot { break-before: avoid; page-break-before: avoid; margin-top: 26px; padding-top: 8px; border-top: 1px solid #d6d9d3; font-size: 10.5px;
  color: #5d665f; display: flex; justify-content: space-between; gap: 12px; }
"""


def title_block_html(kicker, title, chips=None, sub=""):
    """The block under the letterhead: what the document is (small capitals),
    its name, then its facts as labelled chips -- [(label, value)]."""
    chip_html = "".join(f'<span class="nn-chip"><b>{_esc(k)}</b> {_esc(v)}</span>'
                        for k, v in (chips or []) if str(v or "").strip())
    return (f'<div class="nn-title-block"><div class="nn-kicker">{_esc(kicker)}</div>'
            f'<div class="nn-title">{_esc(title)}</div>'
            + (f'<div class="nn-sub">{_esc(sub)}</div>' if sub else "")
            + (f'<div class="nn-chips">{chip_html}</div>' if chip_html else "")
            + '</div>')


def footer_html(left, right_name="NeuroNet"):
    """The line at the foot of the last page: what it is, who made it, the date."""
    import datetime
    return (f'<div class="nn-foot"><span>{_esc(left)}</span><span>{_esc(right_name)} '
            f'· printed {datetime.date.today().strftime("%d %b %Y")}</span></div>')
