"""Coach Cam's document engine, moved into KinCrux.

Cam: "I want it to be on par with the last Coach Cam application...
allign the new KinCrux training print layout to match the print from
coach cam. It would be great if you kept the coach cam logo and name on
the print from KinCrux as well."

WHAT WAS WRONG. When Training was ported, this file did not come with
it, and the interface fell back to a placeholder that dumped the record
as a key/value table -- id, name, created, then the exercise NAMES as a
bullet list. No sets, no reps, no load, no rest, no block colours, no
letterhead. The comment in storage.js said so at the time: "Coach Cam's
Python built this server-side; until that comes across, a plain
readable page beats a dead button." This is that coming across.

MOVED, NOT REWRITTEN. These functions already produce the documents Cam
hands to athletes. They are proven against real data, and a second
implementation would differ from the sheets already in circulation in
small ways nobody would notice until a printout looked wrong. Three
edits, and only three:

  * the three storage_paths imports now resolve against KinCrux's own
    folders,
  * the logo is looked up in KinCrux's icons/ folder, where Coach Cam's
    icon was copied,
  * open_print_document hands off to crux_print, so training sheets open
    exactly the way recipes and money sheets already do.

Optional dependencies: python-docx (Word), openpyxl (Excel), reportlab
(PDF). Each is imported at the point of use, so a missing one disables
only its own format rather than stopping the app.
"""


import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from html import escape as _html_escape
from html.parser import HTMLParser

# NeuroNet owns the folders now -- Training moved here from KinCrux.
# Imported lazily inside the functions below rather than at module scope,
# because neuronet.py imports THIS file and a top-level import back would
# be a cycle.


def _host():
    import neuronet
    return neuronet


def documents_dir():
    d = os.path.join(_host().training_dir(), "documents")
    os.makedirs(d, exist_ok=True)
    return d


def photos_dir():
    """Training's own photos, inside the training folder.

    Deliberately NOT the host's photos_dir(). In KinCrux that pointed at
    the family photo library, which meant an exercise photo added in
    Training would have been filed among the family pictures. NeuroNet
    has a photo library of its own too, so the same trap was waiting.
    Training keeps everything it owns in one folder, which is also what
    makes it movable as a unit.
    """
    d = os.path.join(_host().training_dir(), "photos")
    os.makedirs(d, exist_ok=True)
    return d


def resource_dir():
    return _host().resource_dir()


APP_NAME = "Coaching"
# The name beside Coach Cam's mark on printouts and exports: lower case, as
# the artwork writes it, like "cashbox", "camscookery" and "collection".
PRINT_NAME = "coaching"

DEFAULT_CIRCUIT_TYPES = ["Chipper", "EMOM", "E2MOM", "E3MOM", "AMRAP",
                        "AMAP", "TABATA", "RUNNING"]

DEFAULT_DATA = {"exercises": {}, "sessions": [], "athletes": [],
                "groups": [], "programs": [], "documents": [],
                "circuits": [], "guides": [], "questionnaires": [],
                "circuitTypes": list(DEFAULT_CIRCUIT_TYPES),
                "lessonPlans": [], "calendars": [], "equipment": []}

# The professional refresh (Cam, 2026-10-05: "refine the print out page to take a more
# professional look"): navy gave way to the coaching mark's green -- a deep green-charcoal
# for titles, a darker green-grey for table heads, NeuroNet's ink green for session bars.
# Word, Excel and PDF read these same three, so every format follows.
DOCX_HEADER_DARK = "1F2A24"   # program/mesocycle title bars

DOCX_HEADER_MED = "33473B"    # table header rows, overview section bar

DOCX_SESSION_BAR = "2E6B38"   # each session's own name bar

BLOCK_COLORS = ["C6EFCE", "FFF2B8", "FFD3DC", "D9E2F3", "E4D9F3", "FFE0C2",
                "D6EAF0", "F0E6D2"]


def _block_letter(block):
    m = re.match(r"^([A-Za-z]+)", str(block or "").strip())
    return m.group(1).upper() if m else None


#: Warm-up and cool-down get their own colours rather than a letter's.
#: They are still not supersets — nothing inside them is paired — so they sit
#: outside the A/B/C cycle deliberately, with hues chosen to stay clear of
#: the letters actually in use (A green, B amber, C rose, D blue): a warm
#: sunrise tone for the warm-up and a cool indigo for the cool-down.
NEUTRAL_BLOCKS = ("W", "Z")
BLOCK_NEUTRAL = "E8E8E4"
#: Deliberately deeper than the A-H pastels rather than another tint of the
#: same weight. Measured in CIELAB, these sit 17.8 and 15.9 from their
#: nearest lettered neighbour, where the closest existing pair (D and G) is
#: only 7.2 apart — so the bookends are further from every letter than the
#: letters are from each other.
SPECIAL_BLOCK_COLORS = {
    "W": "F2C88C",   # warm-up — amber
    "Z": "AFC0E8",   # cool-down — indigo
}


def _color_for_block(block):
    """A fixed letter->color mapping (A always green, B always
    yellow, ...), not "first letter seen in this table" — confirmed
    against Cam's own reference file, where block A is green in
    every single session table in the document, not just the first
    one."""
    letter = _block_letter(block)
    if not letter:
        return None
    if letter[0] in SPECIAL_BLOCK_COLORS:
        return SPECIAL_BLOCK_COLORS[letter[0]]
    idx = (ord(letter[0]) - ord("A")) % len(BLOCK_COLORS)
    return BLOCK_COLORS[idx]


def _set_cell_fill(cell, hex_color):
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def _set_cell_text(cell, text, bold=False, color=None):
    from docx.shared import RGBColor
    cell.text = ""
    p = cell.paragraphs[0]
    run = p.add_run("" if text is None else str(text))
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def _add_bar_heading(doc, text, fill_hex, size=14):
    """A full-width colored bar for a section title — python-docx
    paragraphs have no native full-width background, so a 1x1 table
    is the standard workaround."""
    from docx.shared import Pt
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    _set_cell_fill(cell, fill_hex)
    _set_cell_text(cell, text, bold=True, color="FFFFFF")
    cell.paragraphs[0].runs[0].font.size = Pt(size)


def _visible_columns(rows, col_specs):
    """Cam: "when exporting if collums are empty ignore them when
    exporting." col_specs is an ordered list of (key, label,
    always_show) — the identifying column (exercise/station name)
    always stays even if somehow blank; every other column only
    shows up if at least one row actually has data for it."""
    return [(key, label) for key, label, always in col_specs
            if always or any((row.get(key) or "").strip() for row in rows)]


#: Word column widths in mm: the exercise gets the room (2026-10-05)
DOCX_WIDTHS = {"block": 18, "name": 64, "sets": 15, "reps": 34, "load": 28, "rest": 31, "workTime": 24}


def _docx_widths(table, cols):
    from docx.shared import Mm
    table.autofit = False
    grid = table._tbl.tblGrid.findall("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}gridCol")
    for i, (key, label) in enumerate(cols):
        w = Mm(DOCX_WIDTHS.get(key, 28))
        if i < len(grid):
            grid[i].set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w", str(int(w.twips)))
        for cell in table.columns[i].cells:
            cell.width = w


def _add_exercise_table(doc, items):
    """The actual Block/Exercise/Sets/Reps/Load/Rest table with
    superset coloring — just the table, no heading, since it gets
    reused both for a standalone session export and for each session
    embedded inside a program export, and those two contexts want
    different headings around it."""
    if not items:
        doc.add_paragraph("No exercises in this session.")
        return
    cols = _visible_columns(items, [("block", "Block", False),
        ("name", "Exercise", True), ("sets", "Sets", False),
        ("reps", "Reps", False), ("load", "Load", False),
        ("rest", "Rest", False)])
    table = doc.add_table(rows=1, cols=len(cols))
    table.style = "Table Grid"
    _docx_widths(table, cols)
    hdr = table.rows[0].cells
    for i, (key, label) in enumerate(cols):
        _set_cell_text(hdr[i], label.upper(), bold=True, color="FFFFFF")
        _set_cell_fill(hdr[i], DOCX_HEADER_MED)
    for it in items:
        row = table.add_row().cells
        color = _color_for_block(it.get("block", ""))
        for i, (key, label) in enumerate(cols):
            val = it.get(key, "")
            _set_cell_text(row[i], val if val else "\u2014", bold=key in ("block", "name"))
            if color:
                _set_cell_fill(row[i], color)
    _docx_widths(table, cols)


def _new_document():
    """python-docx's own default template is missing a required
    attribute on its zoom element — confirmed present even in a
    single-paragraph document with none of this file's own code
    involved, so it's a pre-existing library quirk, not something
    introduced here. Cheap to patch at the source since the fix is
    just filling in a sensible default (100%)."""
    import docx
    from docx.oxml.ns import qn
    doc = docx.Document()
    zoom = doc.settings.element.find(qn("w:zoom"))
    if zoom is not None and zoom.get(qn("w:percent")) is None:
        zoom.set(qn("w:percent"), "100")
    # the professional refresh (2026-10-05): a clean sans-serif, comfortable margins
    from docx.shared import Pt, Mm, RGBColor
    from docx.oxml import OxmlElement
    normal = doc.styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor(0x1F, 0x2A, 0x24)
    rpr = normal.element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        fonts.set(qn(attr), "Arial")
    normal.paragraph_format.space_after = Pt(4)
    for section in doc.sections:
        section.top_margin = section.bottom_margin = Mm(14)
        section.left_margin = section.right_margin = Mm(14)
    return doc


def _group_by_parts(items, parts):
    """Mirrors app.js's own groupItemsByParts exactly \u2014 items with no
    partId, or one pointing at a since-deleted part, land in a
    trailing None-part bucket rather than vanishing. No parts at all
    returns everything as one ungrouped bucket, same as before this
    feature existed."""
    if not parts:
        return [(None, items)]
    groups = [(p, []) for p in parts]
    general = []
    by_id = {p["id"]: bucket for p, bucket in groups}
    for it in items:
        bucket = by_id.get(it.get("partId"))
        (bucket if bucket is not None else general).append(it)
    result = list(groups)
    if general:
        result.append((None, general))
    return result


def _record_context_lines(record, doc_lookup=None):
    """Tags and linked guide names, for the exported sheet. A coach handing a
    session to someone else should not have to open the app to find out which
    guide it was built from."""
    lines = []
    tags = [t for t in (record.get("tags") or []) if str(t).strip()]
    if tags:
        lines.append(("Tags", ", ".join(tags)))
    names = record.get("guideNames") or []
    if names:
        lines.append(("Read first", ", ".join(names)))
    return lines


def _append_session_docx_content(doc, session, title_size=16):
    _add_bar_heading(doc, session.get("name") or "Session", DOCX_HEADER_DARK,
                     size=title_size)
    for label, value in _record_context_lines(session):
        para = doc.add_paragraph()
        run = para.add_run(f"{label}: ")
        run.bold = True
        para.add_run(value)
    if session.get("notes"):
        doc.add_paragraph(session["notes"])
    doc.add_paragraph("")
    parts = session.get("parts") or []
    for part, group_items in _group_by_parts(session.get("items") or [], parts):
        if part:
            heading = doc.add_paragraph()
            run = heading.add_run(part["name"] + (f" \u2014 {part['goal']}"
                if part.get("goal") else ""))
            run.bold = True
        elif parts:
            doc.add_paragraph("General")
        _add_exercise_table(doc, group_items)
        doc.add_paragraph("")



# ------------------------------------------------- printed sheet furniture ---
"""
The letterhead, the write-on notes area, and the adaptation log — the parts
that make a printed sheet a working document rather than a data dump.

These are only applied by the top-level build_*/print entry points. The
_append_*_content functions stay as they were, because a session embedded
inside an athlete pack or a lesson plan must not drag a second letterhead and
a second notes area into the middle of the page.
"""

POST_SESSION_HEADING = "Post session notes"
POST_SESSION_LINES = 6


def _logo_bytes():
    """The app icon, or None. A missing icon must never stop an export, so
    every caller treats this as optional."""
    # Coach Cam's own icon, copied into KinCrux so the letterhead Cam
    # knows keeps its mark. "It would be great if you kept the coach cam
    # logo and name on the print from KinCrux as well."
    path = os.path.join(resource_dir(), "icons", "coachcam-192.png")
    try:
        with open(path, "rb") as f:
            return f.read()
    except OSError:
        return None


def _logo_data_uri():
    raw = _logo_bytes()
    if not raw:
        return None
    import base64
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


def _format_log_date(value):
    """Log dates are stored as YYYY-MM-DD. Anything else is printed as given
    rather than guessed at."""
    text = str(value or "").strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", text)
    if not m:
        return text
    import datetime
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)),
                             int(m.group(3))).strftime("%d %b %Y")
    except ValueError:
        return text


# ---- HTML ----

def _print_header_html(title):
    """Coach Cam's sheet, on NeuroNet's letterhead.

    Cam: "i want Coach Cam print out to have Neuronet on the top left hand
    corner and coach cam logo on the top right hand corner."

    Which is a swap: the mark and the name used to be on the left with the
    workout centred beside them and an empty spacer on the right. Now
    NeuroNet holds the left, the workout stays centred, and Coach Cam moves
    across to the right.

    The header itself is not built here any more. It is the one every
    printout in the app shares, so this page and a Personal Effects list
    come off the printer looking like they belong to the same application
    -- which is the reason Cam asked. Nothing below the rule changed: the
    session, its blocks and the colours that group the exercises are
    exactly as they were.
    """
    import print_header
    return print_header.header_html(
        title, right_logo="coachcam-192.png", right_name=PRINT_NAME)


def _log_rows_html(record):
    """The notes already written, if any. One section, not two — a heading
    called Post session notes above written notes, and a second identically
    named heading above the blank lines, would read as a mistake."""
    rows = []
    for entry in record.get("logEntries") or []:
        text = (entry.get("text") or "").strip()
        if not text:
            continue
        date = _format_log_date(entry.get("date"))
        title = (entry.get("title") or "").strip()
        heading = (f'<div class="log-title">{_he(title)}</div>') if title else ""
        rows.append(f'<tr><td class="date">{_he(date)}</td>'
                    f'<td>{heading}{_he(text)}</td></tr>')
    if not rows:
        return ""
    return ('<table class="info log"><tbody>' + "".join(rows) + '</tbody></table>')


def _post_session_notes_html(record=None, lines=POST_SESSION_LINES):
    """The heading, whatever has already been written, then blank ruled lines
    to add more."""
    rules = "".join(
        '<div style="border-bottom:1px solid #999"></div>'
        for _ in range(lines))
    written = _log_rows_html(record) if record else ""
    return ('<div style="break-inside:avoid">'
            + _html_bar(POST_SESSION_HEADING, DOCX_SESSION_BAR, 14) +
            written + f'<div class="rules">{rules}</div></div>')


#: What the letterhead says in its centre, by kind -- the record's own name is
#: the title block's, just below, so it isn't printed twice (2026-10-05).
KIND_LABELS = {"session": "Training session", "circuit": "Circuit", "program": "Training program",
               "guide": "Guide", "questionnaire": "Questionnaire", "athlete": "Athlete pack",
               "lessonplan": "Lesson plan", "calendar": "Calendar", "mas_sheet": "MAS sheet",
               "book": "Coaching book", "log": "Training log"}


def print_page(title, body_html, record=None, kind=None):
    """A complete, printable page: letterhead, the content, the adaptation
    log if there is one, and a write-on notes area. With `kind`, the
    letterhead names the kind of document and the title block the record."""
    import datetime
    parts = [_print_header_html(KIND_LABELS.get(kind) or title), body_html]
    if record is not None:
        parts.append(_post_session_notes_html(record))
    parts.append(f'<div class="nn-foot"><span>{_he(title)}</span>'
                 f'<span>coaching \u00b7 printed '
                 f'{datetime.date.today().strftime("%d %b %Y")}</span></div>')
    return _html_document(title, "".join(parts))


# ---- docx ----

def _add_print_header_docx(doc, title):
    """The same letterhead as every printout, in Word.

    Cam: "please replace the print, export icon for coach cam ... As before
    please make them match all the prints you have done before." The printed
    sheets carried NeuroNet top left, the title in the middle and Coach Cam
    on the right; the Word exports still had the old Coach Cam-on-the-left
    header. They now use the one Word letterhead in print_header.py, so a
    session in Word and a session on paper open the same way."""
    import print_header
    print_header.docx_letterhead(doc, title, right_logo="coachcam-192.png",
                                 right_name=PRINT_NAME)
    doc.add_paragraph("")


def _add_write_on_lines(doc, count=POST_SESSION_LINES):
    """Empty paragraphs with a bottom border — ruled lines to write on. A
    bordered table would box every line in on all four sides, which reads as
    a form to fill rather than a space to write."""
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    for _ in range(count):
        para = doc.add_paragraph()
        para.paragraph_format.space_after = None
        borders = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "6")
        bottom.set(qn("w:color"), "999999")
        borders.append(bottom)
        para._p.get_or_add_pPr().append(borders)


def _add_post_session_notes_docx(doc, record=None):
    """One section: the heading, the notes already written, then ruled lines
    to add more."""
    _add_bar_heading(doc, POST_SESSION_HEADING, DOCX_HEADER_MED, size=14)

    entries = [e for e in ((record or {}).get("logEntries") or [])
               if (e.get("text") or "").strip()]
    if entries:
        table = doc.add_table(rows=0, cols=2)
        table.style = "Table Grid"
        for entry in entries:
            cells = table.add_row().cells
            cells[0].text = _format_log_date(entry.get("date"))
            body = cells[1].paragraphs[0]
            title = (entry.get("title") or "").strip()
            if title:
                run = body.add_run(title)
                run.bold = True
                # A newline inside a run is ignored by Word; a break element
                # is the only thing that actually starts a new line.
                run.add_break()
            body.add_run((entry.get("text") or "").strip())
        doc.add_paragraph("")

    _add_write_on_lines(doc)
    doc.add_paragraph("")



# ------------------------------------------------------------- MAS sheet ---
"""
A squad running sheet. "8 x 15 s at 120% MAS" is one instruction for the
group but a different distance for every athlete, so the sheet is a table:
athletes down the side, the prescribed intervals across.

Distance = MAS x percentage x interval seconds. Shuttle runs are marked out
as half that distance, since the athlete runs out and back, so both are
given — measuring the wrong one is the easiest mistake to make on the grass.
"""


def mas_distance(mas, percent, seconds):
    return mas * (percent / 100.0) * seconds


def build_mas_sheet_rows(athletes, intervals):
    """athletes: [{name, mas}]; intervals: [{percent, seconds}]."""
    rows = []
    for athlete in athletes:
        mas = float(athlete.get("mas") or 0)
        if mas <= 0:
            continue
        cells = []
        for spec in intervals:
            distance = mas_distance(mas, spec["percent"], spec["seconds"])
            cells.append({
                "out": round(distance),
                "shuttle": round(distance / 2.0),
            })
        rows.append({"name": athlete.get("name") or "", "mas": mas, "cells": cells})
    return rows


def _mas_sheet_html(sheet):
    intervals = sheet.get("intervals") or []
    rows = build_mas_sheet_rows(sheet.get("athletes") or [], intervals)

    head = ("<th style='text-align:left'>Athlete</th>"
            "<th>MAS</th>"
            + "".join(
                f"<th>{_he(str(i['seconds']))}s @ {_he(str(i['percent']))}%</th>"
                for i in intervals))
    body = []
    for row in rows:
        cells = "".join(
            f"<td style='text-align:center'>{c['out']} m"
            f"<div style='font-size:11px;color:#666'>{c['shuttle']} m out-and-back</div></td>"
            for c in row["cells"])
        body.append(
            f"<tr><td style='text-align:left'>{_he(row['name'])}</td>"
            f"<td style='text-align:center'>{row['mas']:.2f}</td>{cells}</tr>")

    if not body:
        return (_html_bar(sheet.get("name") or "MAS sheet", DOCX_HEADER_DARK, 16)
                + "<p>No athlete has a MAS recorded yet.</p>")

    return (
        _html_bar(sheet.get("name") or "MAS sheet", DOCX_HEADER_DARK, 16)
        + "<table style='border-collapse:collapse;width:100%;"
          "font-family:sans-serif;font-size:13px'>"
        + f"<thead><tr>{head}</tr></thead><tbody>"
        + "".join(body) + "</tbody></table>"
        + "<p style='font-family:sans-serif;font-size:12px;color:#555'>"
          "Distance = MAS &times; percentage &times; interval. The smaller figure "
          "is the cone spacing for an out-and-back shuttle.</p>")


def build_mas_sheet_docx(sheet):
    doc = _new_document()
    _add_print_header_docx(doc, sheet.get("name") or "MAS sheet")

    intervals = sheet.get("intervals") or []
    rows = build_mas_sheet_rows(sheet.get("athletes") or [], intervals)
    if not rows:
        doc.add_paragraph("No athlete has a MAS recorded yet.")
        return doc

    table = doc.add_table(rows=1, cols=2 + len(intervals))
    table.style = "Table Grid"
    headers = ["Athlete", "MAS"] + [f"{i['seconds']}s @ {i['percent']}%" for i in intervals]
    for cell, text in zip(table.rows[0].cells, headers):
        _set_cell_text(cell, text, bold=True)
        _set_cell_fill(cell, DOCX_HEADER_MED)

    for row in rows:
        cells = table.add_row().cells
        _set_cell_text(cells[0], row["name"])
        _set_cell_text(cells[1], f"{row['mas']:.2f}")
        for i, c in enumerate(row["cells"]):
            _set_cell_text(cells[2 + i], f"{c['out']} m  ({c['shuttle']} m o/b)")

    doc.add_paragraph("")
    note = doc.add_paragraph(
        "Distance = MAS \u00d7 percentage \u00d7 interval. The bracketed figure "
        "is the cone spacing for an out-and-back shuttle.")
    note.runs[0].italic = True
    return doc


def build_mas_sheet_xlsx(sheet):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "MAS sheet"
    intervals = sheet.get("intervals") or []
    ws.append(["Athlete", "MAS (m/s)"]
              + [f"{i['seconds']}s @ {i['percent']}%" for i in intervals])
    for row in build_mas_sheet_rows(sheet.get("athletes") or [], intervals):
        ws.append([row["name"], round(row["mas"], 2)]
                  + [c["out"] for c in row["cells"]])
    return wb



# ----------------------------------------------------------------- books ---
"""
A book is an ordered collection of existing records — circuits, sessions,
guides, exercises, programs — printed as one document with a cover page.

Nothing is copied into a book. It holds references, so a book always prints
whatever those records say today. That is the right default for a coaching
manual you reprint each season; it does mean a book is a view of the vault
rather than a snapshot of it, which is worth knowing before relying on one
as a historical record.
"""

BOOK_ITEM_TYPES = ("circuit", "session", "guide", "exercise", "program",
                   "document")

DEFAULT_BOOK_BRAND = "Coaching"


def _book_brand(book):
    """What goes under the mark on the cover. A book can carry its own, so a
    manual for one group need not be branded as another's."""
    brand = (book.get("brand") or "").strip()
    return brand if brand else DEFAULT_BOOK_BRAND


def _book_logo_bytes(book):
    """The book's own cover image if it has one, otherwise the app mark.

    A book that has never been given a logo falls back rather than storing a
    copy of the default, so changing the app icon still updates every book
    that never overrode it.
    """
    cover = book.get("coverLogo") or {}
    stored = cover.get("storedName")
    if stored:
        path = os.path.join(photos_dir(), stored)
        try:
            with open(path, "rb") as f:
                return f.read()
        except OSError:
            # A cover image deleted from disk falls back to the app mark
            # rather than printing a book with a hole in it.
            pass
    return _logo_bytes()


def _book_logo_data_uri(book):
    raw = _book_logo_bytes(book)
    if not raw:
        return None
    import base64
    # The stored name carries the original extension; browsers are forgiving
    # about the declared type, and every path here writes PNG or JPEG.
    stored = (book.get("coverLogo") or {}).get("storedName") or ""
    kind = "jpeg" if stored.lower().endswith((".jpg", ".jpeg")) else "png"
    return f"data:image/{kind};base64," + base64.b64encode(raw).decode("ascii")


#: Images can be placed into a printed book; anything else cannot be, and
#: saying so on the page is better than leaving a silent gap.
BOOK_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".bmp")


def _append_document_docx_content(doc, record, title_size=16):
    """A library file inside a printed book.

    An image is placed on the page. A PDF or a spreadsheet cannot be — Word
    has no way to inline them and merging a PDF into a .docx is a different
    problem entirely — so those get a clearly marked reference instead,
    naming the file and where it lives. A book that silently skipped them
    would print with holes in it and nothing to explain why.
    """
    from docx.shared import Inches, Pt

    name = record.get("originalName") or "File"
    _add_bar_heading(doc, name, DOCX_HEADER_DARK, size=title_size)

    bits = [b for b in [record.get("category"), record.get("note")] if b]
    if bits:
        para = doc.add_paragraph()
        run = para.add_run("   ".join(bits))
        run.italic = True
        run.font.size = Pt(10)

    stored = record.get("storedName") or ""
    path = os.path.join(documents_dir(), stored)
    if stored.lower().endswith(BOOK_IMAGE_EXTS) and os.path.exists(path):
        try:
            doc.add_picture(path, width=Inches(5.8))
            doc.add_paragraph("")
            return
        except Exception:
            pass          # unreadable image falls through to the reference

    para = doc.add_paragraph()
    run = para.add_run(
        f"Kept in the document library as “{name}”"
        + (f" ({stored})" if stored else "")
        + ". Open it from Coaching — it cannot be printed inside the book.")
    run.italic = True
    run.font.size = Pt(10)
    doc.add_paragraph("")


def _document_html(record, title_size=18):
    name = record.get("originalName") or "File"
    bits = [b for b in [record.get("category"), record.get("note")] if b]
    parts = [_html_bar(name, DOCX_HEADER_DARK, title_size)]
    if bits:
        parts.append("<p style='font-family:sans-serif;font-size:12px;"
                     f"color:#555'><i>{_he('   '.join(bits))}</i></p>")

    stored = record.get("storedName") or ""
    path = os.path.join(documents_dir(), stored)
    if stored.lower().endswith(BOOK_IMAGE_EXTS) and os.path.exists(path):
        try:
            import base64
            with open(path, "rb") as f:
                raw = base64.b64encode(f.read()).decode("ascii")
            kind = "jpeg" if stored.lower().endswith((".jpg", ".jpeg")) else "png"
            parts.append(f"<img src='data:image/{kind};base64,{raw}' "
                         "style='max-width:100%;margin:8px 0'>")
            return "".join(parts)
        except OSError:
            pass

    parts.append("<p style='font-family:sans-serif;font-size:12px;color:#777'>"
                 f"<i>Kept in the document library as “{_he(name)}”"
                 + (f" ({_he(stored)})" if stored else "")
                 + ". Open it from Coaching — it cannot be printed inside "
                   "the book.</i></p>")
    return "".join(parts)


def _append_exercise_docx_content(doc, exercise, title_size=16):
    """Exercises had no document of their own until books needed one."""
    from docx.shared import Pt

    _add_bar_heading(doc, exercise.get("name") or "Exercise", DOCX_HEADER_DARK,
                     size=title_size)
    bits = [b for b in [exercise.get("category"),
                        ", ".join(exercise.get("bodyParts") or [])] if b]
    if bits:
        para = doc.add_paragraph()
        run = para.add_run("   ".join(bits))
        run.italic = True
        run.font.size = Pt(10)
    if exercise.get("instructions"):
        doc.add_paragraph(exercise["instructions"])
    doc.add_paragraph("")


def _exercise_html(exercise, title_size=18):
    bits = [b for b in [exercise.get("category"),
                        ", ".join(exercise.get("bodyParts") or [])] if b]
    parts = [_html_bar(exercise.get("name") or "Exercise", DOCX_HEADER_DARK,
                       title_size)]
    if bits:
        parts.append("<p style='font-family:sans-serif;font-size:12px;"
                     f"color:#555'><i>{_he('   '.join(bits))}</i></p>")
    if exercise.get("instructions"):
        parts.append("<p style='font-family:sans-serif;font-size:13px'>"
                     f"{_he(exercise['instructions'])}</p>")
    return "".join(parts)


#: How each kind of book entry renders. Built on demand rather than at import
#: time, because several of these are defined further down the file and a
#: module-level dict would capture them before they exist.
def _book_docx_renderers():
    return {
        "circuit": _append_circuit_docx_content,
        "session": _append_session_docx_content,
        "guide": _append_guide_docx_content,
        "exercise": _append_exercise_docx_content,
        "program": _append_program_docx_content,
        "document": _append_document_docx_content,
    }


def _book_html_renderers():
    return {
        "circuit": _circuit_html,
        "session": _session_html,
        "guide": _guide_html,
        "exercise": _exercise_html,
        "program": _program_html,
        "document": _document_html,
    }


def _add_paragraph_rule(paragraph, width_pct=28):
    """A short horizontal rule, drawn as a paragraph bottom border. Word has
    no rule element, and a row of dashes would be text that wraps."""
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    pPr = paragraph._p.get_or_add_pPr()
    # Indent from both sides so the border reads as a short centred divider
    # rather than a full-width line.
    ind = OxmlElement("w:ind")
    side = str(int(4500 * (100 - width_pct) / 200))  # twentieths of a point
    ind.set(qn("w:left"), side)
    ind.set(qn("w:right"), side)
    pPr.append(ind)

    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), DOCX_HEADER_DARK)
    borders.append(bottom)
    pPr.append(borders)


def _set_section_vertical_center(section):
    """Vertically centre everything in a section.

    Word has no way to centre a single page vertically — the setting lives on
    the section. So the cover gets a section of its own, centred, and the
    content that follows gets another, aligned normally.
    """
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    sectPr = section._sectPr
    existing = sectPr.find(qn("w:vAlign"))
    if existing is not None:
        sectPr.remove(existing)
    v = OxmlElement("w:vAlign")
    v.set(qn("w:val"), "center")
    sectPr.append(v)


def build_book_docx(book):
    from docx.enum.section import WD_SECTION
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt

    doc = _new_document()

    # ---- cover -------------------------------------------------------
    _set_section_vertical_center(doc.sections[0])

    logo = _book_logo_bytes(book)
    if logo:
        import io
        try:
            para = doc.add_paragraph()
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            para.add_run().add_picture(io.BytesIO(logo), width=Inches(1.1))
        except Exception:
            pass  # a missing or unreadable image must never stop an export

    brand = doc.add_paragraph()
    brand.alignment = WD_ALIGN_PARAGRAPH.CENTER
    brand_run = brand.add_run(_book_brand(book))
    brand_run.bold = True
    brand_run.font.size = Pt(15)

    # The divider: a short centred rule between the mark and the title.
    rule = doc.add_paragraph()
    rule.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_paragraph_rule(rule)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title.add_run(book.get("name") or "Book")
    title_run.bold = True
    title_run.font.size = Pt(28)

    if book.get("subtitle"):
        sub = doc.add_paragraph()
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub_run = sub.add_run(book["subtitle"])
        sub_run.italic = True
        sub_run.font.size = Pt(12)

    # ---- contents ----------------------------------------------------
    entries = book.get("entries") or []
    if entries:
        body = doc.add_section(WD_SECTION.NEW_PAGE)
        # The cover's centring must not follow the content through.
        from docx.oxml.ns import qn
        existing = body._sectPr.find(qn("w:vAlign"))
        if existing is not None:
            body._sectPr.remove(existing)

        for index, entry in enumerate(entries):
            render = _book_docx_renderers().get(entry.get("type"))
            record = entry.get("record")
            if not render or not record:
                continue
            if index:
                doc.add_page_break()
            render(doc, record)

    return doc


def _book_html(book):
    entries = book.get("entries") or []
    logo = _book_logo_data_uri(book)
    mark = (f"<img src='{logo}' alt='' "
            "style='display:block;margin:0 auto 14px;max-width:120px;"
            "max-height:120px;border-radius:18px'>"
            ) if logo else ""

    cover = (
        "<div style='min-height:92vh;display:flex;flex-direction:column;"
        "align-items:center;justify-content:center;text-align:center;"
        "page-break-after:always'>"
        f"{mark}"
        "<div style='font-family:sans-serif;font-size:17px;font-weight:700;"
        f"letter-spacing:.02em'>{_he(_book_brand(book))}</div>"
        "<div style='width:110px;height:2px;background:#"
        + DOCX_HEADER_DARK + ";margin:16px auto'></div>"
        "<div style='font-family:sans-serif;font-size:34px;font-weight:700'>"
        f"{_he(book.get('name') or 'Book')}</div>"
        + (f"<div style='font-family:sans-serif;font-size:14px;color:#555;"
           f"margin-top:8px'><i>{_he(book['subtitle'])}</i></div>"
           if book.get("subtitle") else "")
        + "</div>")

    parts = [cover]
    for index, entry in enumerate(entries):
        render = _book_html_renderers().get(entry.get("type"))
        record = entry.get("record")
        if not render or not record:
            continue
        style = "page-break-before:always" if index else ""
        parts.append(f"<div style='{style}'>{render(record)}</div>")
    return "".join(parts)


def build_book_xlsx(book):
    """A book is a printed document; a spreadsheet of it is just its
    contents list, which is the only part that maps onto rows."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Contents"
    ws.append(["#", "Type", "Name"])
    for i, entry in enumerate((book.get("entries") or []), start=1):
        record = entry.get("record") or {}
        ws.append([i, entry.get("type", ""), record.get("name", "")])
    return wb

def build_session_docx(session):
    doc = _new_document()
    _add_print_header_docx(doc, KIND_LABELS["session"])
    _append_session_docx_content(doc, session)
    _add_post_session_notes_docx(doc, session)
    return doc


def _add_circuit_table(doc, stations):
    """Deliberately not _add_exercise_table: circuits are an ordered
    list of stations, not Block/Sets groupings, so there's no
    superset concept to color-code here at all — a plain table,
    same header styling as everywhere else for visual consistency,
    just without the coloring that only makes sense where a block
    letter actually exists."""
    if not stations:
        doc.add_paragraph("No stations in this circuit.")
        return
    cols = _visible_columns(stations, [("name", "Exercise", True),
        ("workTime", "Work", False), ("reps", "Reps", False),
        ("load", "Load", False), ("rest", "Rest", False)])
    table = doc.add_table(rows=1, cols=len(cols))
    table.style = "Table Grid"
    _docx_widths(table, cols)
    hdr = table.rows[0].cells
    for i, (key, label) in enumerate(cols):
        _set_cell_text(hdr[i], label.upper(), bold=True, color="FFFFFF")
        _set_cell_fill(hdr[i], DOCX_HEADER_MED)
    for st in stations:
        row = table.add_row().cells
        for i, (key, label) in enumerate(cols):
            val = st.get(key, "")
            _set_cell_text(row[i], val if val else "\u2014")
    _docx_widths(table, cols)


def _append_circuit_docx_content(doc, circuit, title_size=16):
    _add_bar_heading(doc, circuit.get("name") or "Circuit", DOCX_HEADER_DARK,
                     size=title_size)
    bits = []
    if circuit.get("type"):
        bits.append(f"Type: {circuit['type']}")
    if circuit.get("rounds"):
        bits.append(f"Rounds: {circuit['rounds']}")
    if circuit.get("timeCap"):
        bits.append(f"Time cap: {circuit['timeCap']}")
    if bits:
        doc.add_paragraph("   ".join(bits))
    for label, value in _record_context_lines(circuit):
        para = doc.add_paragraph()
        run = para.add_run(f"{label}: ")
        run.bold = True
        para.add_run(value)
    if circuit.get("notes"):
        doc.add_paragraph(circuit["notes"])
    doc.add_paragraph("")
    parts = circuit.get("parts") or []
    for part, group_stations in _group_by_parts(circuit.get("stations") or [], parts):
        if part:
            heading = doc.add_paragraph()
            run = heading.add_run(part["name"] + (f" \u2014 {part['goal']}"
                if part.get("goal") else ""))
            run.bold = True
        elif parts:
            doc.add_paragraph("General")
        _add_circuit_table(doc, group_stations)
        doc.add_paragraph("")


def build_circuit_docx(circuit):
    doc = _new_document()
    _add_print_header_docx(doc, KIND_LABELS["circuit"])
    _append_circuit_docx_content(doc, circuit)
    _add_post_session_notes_docx(doc, circuit)
    return doc


def _rte_color_to_hex(color):
    """Handles both #rrggbb (and #rgb shorthand) and rgb(r,g,b) —
    execCommand's foreColor can produce either depending on browser,
    and Coach Cam's own toolbar always passes hex, but a pasted-in
    color from elsewhere could still arrive as rgb()."""
    color = (color or "").strip()
    if color.startswith("#"):
        hexval = color[1:]
        if len(hexval) == 3:
            hexval = "".join(c * 2 for c in hexval)
        return hexval.upper() if len(hexval) == 6 else None
    m = re.match(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", color)
    if m:
        r, g, b = (int(x) for x in m.groups())
        return f"{r:02X}{g:02X}{b:02X}"
    return None


class _RichHtmlToDocx(HTMLParser):
    """Cam: "rich text formatting with bold, italic, underline, text
    size, list and color." Converts the HTML from Coach Cam's own
    guide editor into real docx runs and paragraphs \u2014 deliberately
    narrow: handles exactly what that editor's toolbar produces
    (b/i/u, styled spans or legacy <font> tags for color/size, ul/li),
    not general-purpose HTML-to-docx conversion, plus tables, which the
    guides use for session run-downs.

    Tables are handled by collecting cell text while parsing and building the
    docx table on the closing </table> — python-docx wants the grid up front,
    and a streaming parser does not know the column count until the first row
    is done."""
    def __init__(self, doc):
        super().__init__(convert_charrefs=True)
        self.doc = doc
        self.para = None
        self.bold = 0
        self.italic = 0
        self.underline = 0
        self.color_stack = []
        self.size_stack = []
        # Table state. `self.table` is None outside a table; inside one it is
        # a list of rows, each a list of cell strings.
        self.table = None
        self.row = None
        self.cell = None
        self.header_row = False
        self.header_rows = 0

    def _ensure_para(self, style=None):
        if self.para is None:
            self.para = self.doc.add_paragraph(style=style)
        return self.para

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        tag = tag.lower()

        # --- tables ---
        if tag == "table":
            self.table = []
            self.header_rows = 0
            return
        if self.table is not None:
            if tag == "tr":
                self.row = []
                self.header_row = False
                return
            if tag in ("td", "th"):
                self.cell = []
                if tag == "th":
                    self.header_row = True
                return
            if tag == "br" and self.cell is not None:
                self.cell.append("\n")
                return
            # Anything else inside a table contributes only its text.
            if tag in ("thead", "tbody", "tfoot"):
                return

        if tag in ("div", "p"):
            self.para = self.doc.add_paragraph()
        elif tag == "br":
            self._ensure_para().add_run().add_break()
        elif tag in ("b", "strong"):
            self.bold += 1
        elif tag in ("i", "em"):
            self.italic += 1
        elif tag == "u":
            self.underline += 1
        elif tag == "li":
            self.para = self.doc.add_paragraph(style="List Bullet")
        elif tag in ("span", "font"):
            style = attrs.get("style", "")
            color = None
            m = re.search(r"color:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))", style)
            if m:
                color = m.group(1)
            elif attrs.get("color"):
                color = attrs["color"]
            size = None
            m = re.search(r"font-size:\s*([\d.]+)px", style)
            if m:
                size = float(m.group(1))
            elif attrs.get("size"):
                size = None  # legacy 1-7 scale, not a real size — ignore
            self.color_stack.append(color)
            self.size_stack.append(size)

    def handle_endtag(self, tag):
        tag = tag.lower()

        # --- tables ---
        if self.table is not None:
            if tag in ("td", "th"):
                if self.row is not None:
                    self.row.append("".join(self.cell or []).strip())
                self.cell = None
                return
            if tag == "tr":
                if self.row:
                    self.table.append(self.row)
                    if self.header_row:
                        self.header_rows += 1
                self.row = None
                return
            if tag == "table":
                self._flush_table()
                return
            if tag in ("thead", "tbody", "tfoot"):
                return

        if tag in ("b", "strong"):
            self.bold = max(0, self.bold - 1)
        elif tag in ("i", "em"):
            self.italic = max(0, self.italic - 1)
        elif tag == "u":
            self.underline = max(0, self.underline - 1)
        elif tag in ("span", "font"):
            if self.color_stack:
                self.color_stack.pop()
            if self.size_stack:
                self.size_stack.pop()
        elif tag in ("div", "p", "li"):
            self.para = None

    def _flush_table(self):
        """Build the docx table from the collected rows."""
        rows, self.table = self.table, None
        self.para = None
        if not rows:
            return
        columns = max(len(r) for r in rows)
        table = self.doc.add_table(rows=0, cols=columns)
        table.style = "Table Grid"
        for index, row in enumerate(rows):
            cells = table.add_row().cells
            for column in range(columns):
                text = row[column] if column < len(row) else ""
                # A fresh cell already holds one empty paragraph. Assigning
                # cell.text would add an empty run in front of every value.
                para = cells[column].paragraphs[0]
                for line_number, line in enumerate(text.split("\n")):
                    run = para.add_run(line)
                    # A header row is bold, matching how it reads on screen.
                    if index < self.header_rows:
                        run.bold = True
                    if line_number < len(text.split("\n")) - 1:
                        run.add_break()
        self.doc.add_paragraph("")

    def handle_data(self, data):
        if not data:
            return
        # Inside a table cell, text is collected rather than written out.
        if self.cell is not None:
            self.cell.append(data)
            return
        if self.table is not None:
            return
        from docx.shared import Pt, RGBColor
        run = self._ensure_para().add_run(data)
        run.bold = self.bold > 0
        run.italic = self.italic > 0
        run.underline = self.underline > 0
        color = next((c for c in reversed(self.color_stack) if c), None)
        if color:
            hexval = _rte_color_to_hex(color)
            if hexval:
                run.font.color.rgb = RGBColor.from_string(hexval)
        size = next((s for s in reversed(self.size_stack) if s), None)
        if size:
            run.font.size = Pt(size * 0.75)  # px -> pt, approx


def _append_rich_html_docx(doc, html_body):
    if html_body and html_body.strip():
        _RichHtmlToDocx(doc).feed(html_body)


def _append_guide_docx_content(doc, guide, title_size=16):
    _add_bar_heading(doc, guide.get("name") or "Guide", DOCX_HEADER_DARK,
                     size=title_size)
    body_html = guide.get("bodyHtml") or ""
    if body_html.strip():
        _append_rich_html_docx(doc, body_html)
        doc.add_paragraph("")
    entries = guide.get("entries") or []
    for entry in entries:
        _add_bar_heading(doc, entry.get("name") or "Exercise",
                         DOCX_SESSION_BAR, size=12)
        tags = entry.get("bodyParts") or []
        if entry.get("category") or tags:
            bits = [entry["category"]] if entry.get("category") else []
            bits.extend(tags)
            doc.add_paragraph(" \u00b7 ".join(bits))
        doc.add_paragraph(entry.get("instructions") or "No instructions "
                          "on file.")
        doc.add_paragraph("")


def build_guide_docx(guide):
    """Cam: "a guide builder feature... where i choose exercises to
    add them to a list of exercises i can name and then export
    later." Deliberately not a table like sessions/circuits \u2014 a
    guide is reference material, not a prescription, so each
    exercise gets its own name, tags, and full instructions written
    out, the same shape as the exercise detail dialog already shows
    in the library."""
    doc = _new_document()
    _append_guide_docx_content(doc, guide)
    return doc


def _append_questionnaire_docx_content(doc, questionnaire, title_size=16):
    _add_bar_heading(doc, questionnaire.get("name") or "Questionnaire",
                     DOCX_HEADER_DARK, size=title_size)
    doc.add_paragraph("Name: _______________________     "
                      "Date: _______________")
    doc.add_paragraph("")
    for q in questionnaire.get("questions") or []:
        p = doc.add_paragraph()
        run = p.add_run(q.get("text") or "")
        run.bold = True
        if q.get("type") == "rating":
            doc.add_paragraph("1     2     3     4     5     6     7"
                              "     8     9     10")
        else:
            doc.add_paragraph("_" * 60)
        doc.add_paragraph("")


def build_questionnaire_docx(questionnaire):
    """Cam confirmed this covers both readiness check-ins and intake
    forms, the same builder either way \u2014 so the export is built as
    an actual fillable paper form (blank lines for short answer, a
    1\u201310 scale to circle for rating), the same "print it, hand it
    to someone, they fill it in" spirit as Cashbox's own print
    feature, not a reference document or a data table like the other
    three exports."""
    doc = _new_document()
    _append_questionnaire_docx_content(doc, questionnaire)
    return doc


def build_athlete_docx(athlete):
    """Cam: "will export the athletes details and all the programs
    been assigned to them" \u2014 now brought up to the same Word/Print/
    Excel treatment as every other export, rather than staying the
    odd one out on plain JSON. Reuses the program/session appenders
    directly so an assigned program's full mesocycle/session content
    (with its own coloring) shows up embedded here exactly as it
    would in a standalone program export, not a simplified summary."""
    doc = _new_document()
    _add_bar_heading(doc, athlete.get("name") or "Athlete", DOCX_HEADER_DARK,
                     size=18)
    if athlete.get("email"):
        doc.add_paragraph(f"Email: {athlete['email']}")
    if athlete.get("groups"):
        doc.add_paragraph("Groups: " + ", ".join(athlete["groups"]))
    if athlete.get("notes"):
        doc.add_paragraph("")
        _add_bar_heading(doc, "Notes", DOCX_HEADER_MED, size=13)
        doc.add_paragraph(athlete["notes"])
    doc.add_paragraph("")

    assignments = athlete.get("assignments") or []
    if not assignments:
        doc.add_paragraph("Nothing assigned yet.")
    for asn in assignments:
        if asn.get("type") == "program" and asn.get("program"):
            _append_program_docx_content(doc, asn["program"], title_size=16)
        elif asn.get("type") == "circuit" and asn.get("circuit"):
            _append_circuit_docx_content(doc, asn["circuit"], title_size=16)
        elif asn.get("type") == "session" and asn.get("session"):
            _append_session_docx_content(doc, asn["session"], title_size=16)
        doc.add_paragraph("")
    return doc


def build_lessonplan_docx(plan):
    """Cam: "exported to word doc, excell and print." Reuses the
    session/circuit appenders for attached sessions (full tables,
    same superset coloring as everywhere else) and the rich-html
    converter for the overview and each text box \u2014 the same
    building blocks every other export in this file already uses,
    not a bespoke formatter."""
    doc = _new_document()
    _add_bar_heading(doc, plan.get("name") or "Lesson Plan", DOCX_HEADER_DARK,
                     size=18)
    bits = []
    if plan.get("date"):
        bits.append(f"Date: {plan['date']}")
    if plan.get("location"):
        bits.append(f"Location: {plan['location']}")
    if plan.get("stores"):
        bits.append(f"Equipment: {plan['stores']}")
    if bits:
        doc.add_paragraph("   ".join(bits))
    overview_html = plan.get("overviewHtml") or ""
    if overview_html.strip():
        _append_rich_html_docx(doc, overview_html)
    doc.add_paragraph("")

    layout_photo = plan.get("layoutPhoto")
    if layout_photo and layout_photo.get("storedName"):
        photo_path = os.path.join(photos_dir(), layout_photo["storedName"])
        if os.path.isfile(photo_path):
            _add_bar_heading(doc, "Class Layout", DOCX_HEADER_MED, size=14)
            try:
                from docx.shared import Inches
                doc.add_picture(photo_path, width=Inches(5.5))
            except Exception:
                doc.add_paragraph("(Couldn't embed the class layout image)")
            doc.add_paragraph("")

    refs = plan.get("refs") or []
    if refs:
        _add_bar_heading(doc, "Sessions", DOCX_HEADER_MED, size=14)
        for ref in refs:
            if ref.get("type") == "session" and ref.get("session"):
                _append_session_docx_content(doc, ref["session"], title_size=13)
                doc.add_paragraph("")
            elif ref.get("type") == "circuit" and ref.get("circuit"):
                _append_circuit_docx_content(doc, ref["circuit"], title_size=13)
                doc.add_paragraph("")

    for tb in plan.get("textBoxes") or []:
        _add_bar_heading(doc, tb.get("title") or "Note", DOCX_SESSION_BAR,
                         size=13)
        body_html = tb.get("bodyHtml") or ""
        if body_html.strip():
            _append_rich_html_docx(doc, body_html)
        doc.add_paragraph("")
    return doc


OVERVIEW_FIELD_LABELS = [
    ("sessionBreakdown", "Session breakdown"),
    ("objective", "Objective"),
    ("outcome", "Intended outcome"),
    ("experienceLevel", "Experience level"),
    ("usageGuidelines", "Usage guidelines"),
    ("coachingNotes", "Coaching notes"),
]


def _append_program_docx_content(doc, program, title_size=18):
    _add_bar_heading(doc, program.get("name") or "Program", DOCX_HEADER_DARK,
                     size=title_size)
    months = program.get("durationMonths")
    if months:
        doc.add_paragraph(f"Duration: {months} month{'s' if months != 1 else ''}")
    doc.add_paragraph("")

    overview = program.get("overview") or {}
    filled = [(label, overview.get(key, "")) for key, label in
             OVERVIEW_FIELD_LABELS if (overview.get(key) or "").strip()]
    if filled:
        _add_bar_heading(doc, "OVERVIEW", DOCX_HEADER_MED, size=13)
        for label, value in filled:
            p = doc.add_paragraph()
            run = p.add_run(f"{label}: ")
            run.bold = True
            p.add_run(value)
        doc.add_paragraph("")

    for meso in program.get("mesocycles") or []:
        _add_bar_heading(doc, meso.get("name") or "Mesocycle",
                         DOCX_HEADER_DARK, size=14)
        week_bits = []
        for w in meso.get("weeks") or []:
            parts = []
            if w.get("rpe"):
                parts.append(f"RPE {w['rpe']}")
            if w.get("rir"):
                parts.append(f"RIR {w['rir']}")
            if w.get("loadPercent"):
                parts.append(f"{w['loadPercent']}% load")
            if parts:
                week_bits.append(f"Week {w.get('weekNum', '?')}: "
                                 + ", ".join(parts))
        if week_bits:
            doc.add_paragraph("   ".join(week_bits))
        doc.add_paragraph("")

        for group in meso.get("sessionGroups") or []:
            for sess in group.get("sessions") or []:
                # each session as fully as its own sheet: its notes and tags
                # from the library copy, and its own page (2026-10-05)
                full = _program_session(program, sess)
                doc.add_page_break()
                _add_bar_heading(doc, full.get("name") or "Session",
                                 DOCX_SESSION_BAR, size=13)
                for label, value in _record_context_lines(full):
                    para = doc.add_paragraph()
                    para.add_run(f"{label}: ").bold = True
                    para.add_run(value)
                if full.get("notes"):
                    doc.add_paragraph(full["notes"])
                _add_exercise_table(doc, full.get("items") or [])
                doc.add_paragraph("")


def build_program_docx(program):
    doc = _new_document()
    _append_program_docx_content(doc, program)
    return doc


# -------------------------------------------------------------- html ---
"""Print. Follows Cashbox's own open_print_document pattern exactly —
write a complete, self-contained HTML file to a temp path, open it in
the system's REAL browser rather than the embedded pywebview window,
since window.print() reliability through pywebview's GTK backend on
Cam's exact Wayland/Hyprland stack was never something to trust (see
Cashbox's own reasoning for the same choice). One real difference from
Cashbox: there, the HTML itself was built in app.js; here it's built
in Python, reusing the exact same nested traversal logic and color
constants already proven for the docx builders above, rather than
re-implementing that traversal a second time in JavaScript."""


def _he(s):
    """html.escape() itself throws on None (a question with no text,
    a field left blank) — this coerces first, same defensive shape
    as every other formatting helper in this file."""
    return _html_escape(str(s) if s is not None else "")


def _html_bar(text, color, size=18):
    """A heading. Big ones (a record's own name) are a title; the rest are section
    heads -- a coloured rule and small capitals rather than a heavy filled bar."""
    if size >= 18:
        return (f'<h1 class="nn-title" style="border-bottom-color:#{color}">'
                f'{_he(text)}</h1>')
    return f'<h2 style="border-left-color:#{color}">{_he(text)}</h2>'


def _title_block(kind, name, meta=None, color=None):
    """The top of a printed record: what it is, its name, then a line of facts
    (tags, equipment, how many exercises) as small labelled chips."""
    color = color or DOCX_HEADER_DARK
    chips = "".join(f'<span class="nn-chip"><b>{_he(k)}</b> {_he(v)}</span>'
                    for k, v in (meta or []) if str(v or "").strip())
    return (f'<div class="nn-title-block"><div class="nn-kicker">{_he(kind)}</div>'
            f'<h1 class="nn-title" style="border-bottom-color:#{color}">'
            f'{_he(name)}</h1>'
            + (f'<div class="nn-chips">{chips}</div>' if chips else "")
            + '</div>')


def _notes_panel(text, label="Coach's notes"):
    """Free text in a quiet panel, its paragraphs kept (a blank line between)."""
    paras = [p.strip() for p in str(text or "").split("\n\n") if p.strip()]
    if not paras:
        return ""
    body = "".join("<p>" + _he(p).replace("\n", "<br>") + "</p>" for p in paras)
    return (f'<div class="nn-panel"><div class="nn-panel-label">{_he(label)}</div>'
            f'{body}</div>')


def _html_exercise_table(items):
    if not items:
        return '<p>No exercises in this session.</p>'
    cols = _visible_columns(items, [("block", "Block", False),
        ("name", "Exercise", True), ("sets", "Sets", False),
        ("reps", "Reps", False), ("load", "Load", False),
        ("rest", "Rest", False)])
    head = "".join(f'<th style="background:#{DOCX_HEADER_MED}">{_he(label)}'
        f'</th>' for key, label in cols)
    rows = []
    for it in items:
        color = _color_for_block(it.get("block", ""))
        style = f'background:#{color}' if color else ''
        cell_values = []
        for key, label in cols:
            if key == "name":
                cell_values.append(_exercise_name_cell(it))
            else:
                cell_values.append(_he(it.get(key, "")) if it.get(key) else "&mdash;")
        cells = "".join(f'<td class="c-{key}">{v}</td>'
                        for (key, label), v in zip(cols, cell_values))
        rows.append(f'<tr style="{style}">{cells}</tr>')
    return (f'<table class="ex"><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>')


def _exercise_name_cell(st):
    """Cam: "When printing a circuit these will appear in brackets
    next to the primiary exercises." Originally built for circuits,
    now shared with sessions too \u2014 both are plain dicts with a name
    and an optional alternates list, so nothing here needs to know
    which builder produced it. Alternates carry no sets/reps/
    rest of their own by design (only a name), so there's nothing
    else to show for them \u2014 folded into the same cell as the
    primary exercise's own name rather than given a column of their
    own, matching how Cam described wanting the printed page to
    actually read."""
    name = st.get("name", "")
    if not name:
        return "&mdash;"
    alts = [_he(a.get("name", "")) for a in (st.get("alternates") or [])
            if a.get("name")]
    if not alts:
        return _he(name)
    return f'{_he(name)} <span class="alt">or {", ".join(alts)}</span>'


def _html_circuit_table(stations):
    if not stations:
        return '<p>No stations in this circuit.</p>'
    cols = _visible_columns(stations, [("name", "Exercise", True),
        ("workTime", "Work", False), ("reps", "Reps", False),
        ("load", "Load", False), ("rest", "Rest", False)])
    head = "".join(f'<th style="background:#{DOCX_HEADER_MED}">{_he(label)}'
        f'</th>' for key, label in cols)
    rows = []
    for st in stations:
        cell_values = []
        for key, label in cols:
            if key == "name":
                cell_values.append(_exercise_name_cell(st))
            else:
                cell_values.append(_he(st.get(key, "")) if st.get(key) else "&mdash;")
        cells = "".join(f'<td class="c-{key}">{v}</td>'
                        for (key, label), v in zip(cols, cell_values))
        rows.append(f'<tr>{cells}</tr>')
    return (f'<table class="ex"><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>')


#: The printed page's styles (2026-10-05 refresh). One sheet for every training printout,
#: so a session, a program and a guide come off the printer as one family. The block
#: colours stay on the rows as inline fills (Cam: "the colors for exercise groupings").
PRINT_CSS = """
h3.sub { font-size: 14px; font-weight: 700; margin: 16px 0 6px; break-after: avoid; }
.sub-goal { font-weight: 400; color: #5d665f; }
td.c-block { font-weight: 700; width: 56px; white-space: nowrap; }
td.c-name { font-weight: 600; }
td.c-sets { width: 52px; }
.alt { display: block; font-weight: 400; font-size: 11.5px; color: #5d665f; }
.week-cells td, .week-cells th { text-align: center; }
.index { list-style: none; padding: 0; margin: 6px 0 14px; border: 0; }
.index li { display: flex; gap: 10px; align-items: baseline; padding: 6px 0;
  border-bottom: 1px dashed #d6d9d3; margin: 0; }
.index .n { font-weight: 700; color: #2E6B38; min-width: 30px; }
.index .meta { margin-left: auto; color: #5d665f; font-size: 11.5px; }
.log td.date { white-space: nowrap; width: 110px; color: #5d665f; }
.log .log-title { font-weight: 700; margin-bottom: 2px; }
.rules { margin-top: 6px; }
.rules div { height: 28px; }
"""


def _house_css():
    """The house style every NeuroNet printout shares (print_header.HOUSE_CSS)."""
    import print_header
    return print_header.HOUSE_CSS


def _html_document(title, body_html):
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{_he(title)}</title>
<style>{_house_css()}{PRINT_CSS}</style></head>
<body>
{body_html}
</body></html>"""


def _equipment_summary_html(equipment):
    """Mirrors the JS-side equipmentSummaryHtml exactly \u2014 same
    comma-joined "Name (amount)" format, same empty-string no-op when
    there's genuinely no equipment, so a session/circuit with none
    doesn't print a stray empty "Equipment" label."""
    if not equipment:
        return ""
    bits = []
    for e in equipment:
        name = e.get("name", "")
        if not name:
            continue
        amount = e.get("amount", "")
        bits.append(f"{_he(name)} ({_he(amount)})" if amount else _he(name))
    if not bits:
        return ""
    return f'<p><b>Equipment:</b> {", ".join(bits)}</p>'


def _equipment_text(equipment):
    bits = []
    for e in equipment or []:
        name = (e.get("name") or "").strip()
        if name:
            amount = (e.get("amount") or "").strip()
            bits.append(f"{name} ({amount})" if amount else name)
    return ", ".join(bits)


def _block_count(items):
    return len({_block_letter(i.get("block")) for i in items or []
                if _block_letter(i.get("block"))})


def _session_html(session, title_size=18, kicker="Training session",
                  write_on=False):
    """A session sheet: title block (tags, equipment, how much is in it), the
    coach's notes, the exercises by block. `write_on` adds the post-session notes
    area -- the top-level print adds its own, a program adds one per session."""
    items = session.get("items") or []
    meta = [("Tags", ", ".join(t for t in session.get("tags") or [] if str(t).strip())),
            ("Read first", ", ".join(session.get("guideNames") or [])),
            ("Equipment", _equipment_text(session.get("equipment"))),
            ("Exercises", f"{len(items)} in {_block_count(items)} block"
                          f"{'' if _block_count(items) == 1 else 's'}" if items else "")]
    if title_size >= 18:
        html_parts = [_title_block(kicker, session.get("name") or "Session", meta)]
    else:
        html_parts = [_html_bar(session.get("name") or "Session", DOCX_SESSION_BAR, title_size)]
    html_parts.append(_notes_panel(session.get("notes")))
    session_parts = session.get("parts") or []
    if items or not session_parts:
        html_parts.append(_html_bar("Exercises", DOCX_SESSION_BAR, 14))
    for part, group_items in _group_by_parts(items, session_parts):
        if part:
            goal = (f' <span class="sub-goal">\u2014 {_he(part["goal"])}</span>'
                    if part.get("goal") else "")
            html_parts.append(f'<h3 class="sub">{_he(part["name"])}{goal}</h3>')
        elif session_parts:
            html_parts.append('<h3 class="sub">General</h3>')
        html_parts.append(_html_exercise_table(group_items))
    if write_on:
        html_parts.append(_post_session_notes_html(session))
    return "".join(html_parts)


def _circuit_html(circuit, title_size=18):
    meta = [("Type", circuit.get("type")), ("Rounds", circuit.get("rounds")),
            ("Time cap", circuit.get("timeCap")),
            ("Tags", ", ".join(circuit.get("tags") or [])),
            ("Equipment", _equipment_text(circuit.get("equipment"))),
            ("Stations", str(len(circuit.get("stations") or [])) if circuit.get("stations") else "")]
    if title_size >= 18:
        html_parts = [_title_block("Circuit", circuit.get("name") or "Circuit", meta)]
    else:
        html_parts = [_html_bar(circuit.get("name") or "Circuit", DOCX_SESSION_BAR, title_size)]
    html_parts.append(_notes_panel(circuit.get("notes")))
    html_parts.append(_html_bar("Stations", DOCX_SESSION_BAR, 14))
    circuit_parts = circuit.get("parts") or []
    for part, group_stations in _group_by_parts(circuit.get("stations") or [],
                                                 circuit_parts):
        if part:
            goal = (f' <span class="sub-goal">\u2014 {_he(part["goal"])}</span>'
                    if part.get("goal") else "")
            html_parts.append(f'<h3 class="sub">{_he(part["name"])}{goal}</h3>')
        elif circuit_parts:
            html_parts.append('<h3 class="sub">General</h3>')
        html_parts.append(_html_circuit_table(group_stations))
    return "".join(html_parts)


def _guide_html(guide, title_size=18):
    entries = guide.get("entries") or []
    parts = [_html_bar(guide.get("name") or "Guide", DOCX_HEADER_DARK,
                       title_size)]
    body_html = guide.get("bodyHtml") or ""
    if body_html.strip():
        parts.append(f'<div style="line-height:1.6">{body_html}</div>')
    for entry in entries:
        parts.append(_html_bar(entry.get("name") or "Exercise",
                               DOCX_SESSION_BAR, 14))
        tags = entry.get("bodyParts") or []
        bits = ([entry["category"]] if entry.get("category") else []) + tags
        if bits:
            parts.append(f'<p>{" &middot; ".join(_he(b) for b in bits)}</p>')
        parts.append(f'<p>{_he(entry.get("instructions") or "No instructions on file.")}</p>')
    return "".join(parts)


def _questionnaire_html(questionnaire, title_size=18):
    parts = [_html_bar(questionnaire.get("name") or "Questionnaire",
                       DOCX_HEADER_DARK, title_size),
             '<p>Name: ________________________&nbsp;&nbsp;&nbsp;'
             'Date: ________________</p>']
    for q in questionnaire.get("questions") or []:
        parts.append(f'<p style="font-weight:700;margin-bottom:4px">'
                     f'{_he(q.get("text"))}</p>')
        if q.get("type") == "rating":
            parts.append('<p style="letter-spacing:14px">1 2 3 4 5 6 7 8 9 10</p>')
        else:
            parts.append('<p>' + "_" * 60 + '</p>')
    return "".join(parts)


def _program_session(program, sess):
    """A session as the program holds it (its name and exercises), filled in from
    the library's copy when the app sent one (`sessionDetails`, by name): notes,
    tags, equipment, guides and the log -- so the program prints each session as
    fully as the session's own sheet. The program's exercises always win."""
    full = dict((program.get("sessionDetails") or {}).get(sess.get("name") or "") or {})
    full.update({k: v for k, v in sess.items() if v not in (None, "", [])})
    return full


def _week_table(weeks):
    cols = [(k, label) for k, label in (("rir", "RIR"), ("rpe", "RPE"), ("loadPercent", "Load %"))
            if any(str(w.get(k) or "").strip() for w in weeks)]
    if not weeks or not cols:
        return ""
    head = ('<th style="background:#' + DOCX_HEADER_MED + '"></th>'
            + "".join(f'<th style="background:#{DOCX_HEADER_MED}">Week {_he(w.get("weekNum", "?"))}</th>'
                      for w in weeks))
    rows = "".join(
        f'<tr><td class="c-name">{_he(label)}</td>'
        + "".join(f'<td>{_he(w.get(k)) if str(w.get(k) or "").strip() else "&mdash;"}</td>' for w in weeks)
        + '</tr>' for k, label in cols)
    return (f'<table class="info week-cells"><thead><tr>{head}</tr></thead>'
            f'<tbody>{rows}</tbody></table>')


def _program_html(program, title_size=22, write_on=True):
    """A program as a workbook: the overview, then each block's week-by-week
    progression and a list of its sessions, then every session on its own page,
    laid out like a session sheet (notes, exercises, a place to write).
    (Cam, 2026-10-05: "program printouts do not look fleshed out like session
    printouts".) `write_on` is off when a program is printed inside an athlete pack."""
    mesos = program.get("mesocycles") or []
    sessions = [(meso, _program_session(program, sess))
                for meso in mesos for group in meso.get("sessionGroups") or []
                for sess in group.get("sessions") or []]
    weeks = sum(len(m.get("weeks") or []) for m in mesos)
    months = program.get("durationMonths")
    meta = [("Duration", f'{months} month{"s" if str(months) != "1" else ""}' if months else
             (f"{weeks} week{'s' if weeks != 1 else ''}" if weeks else "")),
            ("Blocks", str(len(mesos)) if mesos else ""),
            ("Sessions", str(len(sessions)) if sessions else "")]
    parts = [_title_block("Training program", program.get("name") or "Program", meta)]
    overview = program.get("overview") or {}
    filled = [(label, overview.get(key, "")) for key, label in
              OVERVIEW_FIELD_LABELS if (overview.get(key) or "").strip()]
    if filled:
        parts.append(_html_bar("Overview", DOCX_SESSION_BAR, 14))
        cards = []
        for label, value in filled:
            wide = " wide" if len(value) > 140 else ""
            cards.append(f'<div class="nn-panel{wide}"><div class="nn-panel-label">{_he(label)}</div>'
                         f'<p>{_he(value)}</p></div>')
        parts.append(f'<div class="nn-grid">{"".join(cards)}</div>')
    n = 0
    for meso in mesos:
        parts.append(_html_bar(meso.get("name") or "Block", DOCX_SESSION_BAR, 14))
        parts.append(_week_table(meso.get("weeks") or []))
        mine = [sess for m, sess in sessions if m is meso]
        if mine:
            items = []
            for sess in mine:
                n += 1
                count = len(sess.get("items") or [])
                items.append(f'<li><span class="n">S{n}</span><span>{_he(sess.get("name") or "Session")}</span>'
                             f'<span class="meta">{count} exercise{"" if count == 1 else "s"}</span></li>')
            parts.append(f'<ol class="index">{"".join(items)}</ol>')
    total = len(sessions)
    for i, (meso, sess) in enumerate(sessions, 1):
        kicker = f"Session {i} of {total}" + (f" \u00b7 {meso.get('name')}" if meso.get("name") else "")
        parts.append('<div class="nn-page-break"></div>' if write_on else "")
        if write_on:
            parts.append(_session_html(sess, title_size=20, kicker=kicker, write_on=True))
        else:
            parts.append(_session_html(sess, title_size=15))
    return "".join(parts)


def _athlete_html(athlete):
    parts = [_html_bar(athlete.get("name") or "Athlete", DOCX_HEADER_DARK, 22)]
    if athlete.get("email"):
        parts.append(f'<p>Email: {_he(athlete["email"])}</p>')
    if athlete.get("groups"):
        parts.append(f'<p>Groups: {_he(", ".join(athlete["groups"]))}</p>')
    if athlete.get("notes"):
        parts.append(_html_bar("Notes", DOCX_HEADER_MED, 15))
        parts.append(f'<p>{_he(athlete["notes"])}</p>')
    assignments = athlete.get("assignments") or []
    if not assignments:
        parts.append("<p>Nothing assigned yet.</p>")
    for asn in assignments:
        if asn.get("type") == "program" and asn.get("program"):
            parts.append(_program_html(asn["program"], title_size=18, write_on=False))
        elif asn.get("type") == "circuit" and asn.get("circuit"):
            parts.append(_circuit_html(asn["circuit"], title_size=18))
        elif asn.get("type") == "session" and asn.get("session"):
            parts.append(_session_html(asn["session"], title_size=18))
    return "".join(parts)


def _lessonplan_html(plan, title_size=22):
    parts = [_html_bar(plan.get("name") or "Lesson Plan", DOCX_HEADER_DARK,
                       title_size)]
    bits = []
    if plan.get("date"):
        bits.append(f"Date: {_he(plan['date'])}")
    if plan.get("location"):
        bits.append(f"Location: {_he(plan['location'])}")
    if plan.get("stores"):
        bits.append(f"Equipment: {_he(plan['stores'])}")
    if bits:
        parts.append(f'<p>{"   ".join(bits)}</p>')
    overview_html = plan.get("overviewHtml") or ""
    if overview_html.strip():
        parts.append(f'<div style="line-height:1.6">{overview_html}</div>')

    layout_photo = plan.get("layoutPhoto")
    if layout_photo and layout_photo.get("storedName"):
        photo_path = os.path.join(photos_dir(), layout_photo["storedName"])
        if os.path.isfile(photo_path):
            try:
                import base64
                import mimetypes
                with open(photo_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                mime = mimetypes.guess_type(photo_path)[0] or "image/jpeg"
                parts.append(_html_bar("Class Layout", DOCX_HEADER_MED, 16))
                parts.append(f'<img src="data:{mime};base64,{b64}" '
                             f'style="max-width:100%;border-radius:6px" />')
            except OSError:
                pass

    refs = plan.get("refs") or []
    if refs:
        parts.append(_html_bar("Sessions", DOCX_HEADER_MED, 16))
        for ref in refs:
            if ref.get("type") == "session" and ref.get("session"):
                parts.append(_session_html(ref["session"], title_size=15))
            elif ref.get("type") == "circuit" and ref.get("circuit"):
                parts.append(_circuit_html(ref["circuit"], title_size=15))

    for tb in plan.get("textBoxes") or []:
        parts.append(_html_bar(tb.get("title") or "Note", DOCX_SESSION_BAR, 15))
        body_html = tb.get("bodyHtml") or ""
        if body_html.strip():
            parts.append(f'<div style="line-height:1.6">{body_html}</div>')
    return "".join(parts)


_MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November",
                "December"]


def _calendar_day_line(item):
    t = item.get("type")
    if t == "session" and item.get("session"):
        return _he(item["session"].get("name") or "Session")
    if t == "circuit" and item.get("circuit"):
        return _he(item["circuit"].get("name") or "Circuit")
    if t == "exercise":
        name = _he(item.get("name") or "Exercise")
        reps = item.get("reps")
        return f"{name} \u00d7 {_he(reps)}" if reps else name
    return None


def _calendar_html(cal):
    """Cam: "A print feature also where i can print the selected
    months of the calander." One section per chosen month, each
    scheduled day listed with what's on it \u2014 a day-by-day agenda
    rather than trying to reproduce the visual grid on paper, which
    print layouts handle far more reliably than a CSS grid would."""
    parts = [_html_bar(cal.get("name") or "Calendar", DOCX_HEADER_DARK, 22)]
    entries = cal.get("entries") or {}
    print_months = cal.get("printMonths") or []
    for pm in print_months:
        y, m = pm.get("y"), pm.get("m")
        if not y or not m:
            continue
        parts.append(_html_bar(f"{_MONTH_NAMES[m - 1]} {y}",
                                DOCX_HEADER_MED, 16))
        prefix = f"{y:04d}-{m:02d}-"
        month_dates = sorted(k for k in entries if k.startswith(prefix))
        if not month_dates:
            parts.append("<p>Nothing scheduled this month.</p>")
            continue
        for date_key in month_dates:
            day_items = entries.get(date_key) or []
            if not day_items:
                continue
            parts.append(f"<p><b>{_he(date_key)}</b></p>")
            lines = []
            for item in day_items:
                if item.get("type") == "log":
                    for logitem in item.get("items") or []:
                        bits = [_he(logitem.get("name") or "")]
                        if logitem.get("weight"):
                            bits.append(_he(logitem["weight"]))
                        if logitem.get("reps"):
                            bits.append(f"{_he(logitem['reps'])} reps")
                        lines.append(" \u2014 ".join(b for b in bits if b))
                else:
                    line = _calendar_day_line(item)
                    if line:
                        lines.append(line)
            if lines:
                parts.append("<ul>" + "".join(f"<li>{l}</li>" for l in lines)
                             + "</ul>")
    return "".join(parts)


def open_print_document(html_body):
    """Hands the finished page to KinCrux's shared printer, so a training
    sheet opens exactly the way a recipe or a money sheet already does --
    one temp-file-and-browser path for the whole app instead of three."""
    import crux_print
    return crux_print.open_html(html_body, prefix="kincrux-training-")


# -------------------------------------------------------------- xlsx ---
"""Excel. Same color scheme and same data traversal as the docx/html
builders, one more time via openpyxl \u2014 deliberately a single sheet
per export (matching this app's own docx/html shape) rather than the
multi-sheet Overview/Mesocycle-per-tab layout Cam's own reference
file (A_McIntosh - Phase_1.xlsx) used. That's a real scope
simplification worth knowing about, not an oversight \u2014 the
multi-sheet structure is a bigger, separate piece of work if it turns
out to matter.

Every _xlsx_* content function here takes a starting row and returns
the next free row, the same "where did I leave off" composability the
docx appenders already have, which is what lets the athlete workbook
embed a full program's content without duplicating any of this."""


def _xlsx_cell(ws, row, col, value, bold=False, fill=None, font_color=None,
              size=11):
    from openpyxl.styles import Font, PatternFill
    cell = ws.cell(row=row, column=col, value=value if value not in (None, "")
                   else None)
    cell.font = Font(bold=bold, color=font_color, size=size)
    if fill:
        cell.fill = PatternFill(start_color=fill, end_color=fill,
                                fill_type="solid")
    return cell


def _xlsx_bar(ws, row, text, fill, span=6, size=14):
    ws.merge_cells(start_row=row, start_column=1, end_row=row,
                   end_column=span)
    _xlsx_cell(ws, row, 1, text, bold=True, fill=fill, font_color="FFFFFF",
              size=size)
    ws.row_dimensions[row].height = size + 8
    return row + 2


def _xlsx_exercise_table(ws, row, items):
    if not items:
        ws.cell(row=row, column=1, value="No exercises in this session.")
        return row + 1
    cols = _visible_columns(items, [("block", "Block", False),
        ("name", "Exercise", True), ("sets", "Sets", False),
        ("reps", "Reps", False), ("load", "Load", False),
        ("rest", "Rest", False)])
    for i, (key, label) in enumerate(cols):
        _xlsx_cell(ws, row, i + 1, label.upper(), bold=True,
                  fill=DOCX_HEADER_MED, font_color="FFFFFF")
    row += 1
    for it in items:
        color = _color_for_block(it.get("block", ""))
        for i, (key, label) in enumerate(cols):
            _xlsx_cell(ws, row, i + 1, it.get(key, ""), fill=color)
        row += 1
    return row + 1


def _xlsx_circuit_table(ws, row, stations):
    if not stations:
        ws.cell(row=row, column=1, value="No stations in this circuit.")
        return row + 1
    cols = _visible_columns(stations, [("name", "Exercise", True),
        ("workTime", "Work", False), ("reps", "Reps", False),
        ("load", "Load", False), ("rest", "Rest", False)])
    for i, (key, label) in enumerate(cols):
        _xlsx_cell(ws, row, i + 1, label.upper(), bold=True,
                  fill=DOCX_HEADER_MED, font_color="FFFFFF")
    row += 1
    for st in stations:
        for i, (key, label) in enumerate(cols):
            _xlsx_cell(ws, row, i + 1, st.get(key, ""))
        row += 1
    return row + 1


def _xlsx_set_widths(ws, widths):
    from openpyxl.utils import get_column_letter
    for i, w in enumerate(widths):
        ws.column_dimensions[get_column_letter(i + 1)].width = w


def _xlsx_session_content(ws, row, session, title_size=16):
    row = _xlsx_bar(ws, row, session.get("name") or "Session",
                    DOCX_HEADER_DARK, size=title_size)
    if session.get("notes"):
        ws.cell(row=row, column=1, value=session["notes"])
        row += 1
    parts = session.get("parts") or []
    for part, group_items in _group_by_parts(session.get("items") or [], parts):
        if part:
            label = part["name"] + (f" \u2014 {part['goal']}"
                if part.get("goal") else "")
            _xlsx_cell(ws, row, 1, label, bold=True)
            row += 1
        elif parts:
            _xlsx_cell(ws, row, 1, "General", bold=True)
            row += 1
        row = _xlsx_exercise_table(ws, row, group_items)
    return row


def _xlsx_circuit_content(ws, row, circuit, title_size=16):
    row = _xlsx_bar(ws, row, circuit.get("name") or "Circuit",
                    DOCX_HEADER_DARK, size=title_size)
    bits = []
    if circuit.get("type"):
        bits.append(f"Type: {circuit['type']}")
    if circuit.get("rounds"):
        bits.append(f"Rounds: {circuit['rounds']}")
    if circuit.get("timeCap"):
        bits.append(f"Time cap: {circuit['timeCap']}")
    if bits:
        ws.cell(row=row, column=1, value="   ".join(bits))
        row += 1
    if circuit.get("notes"):
        ws.cell(row=row, column=1, value=circuit["notes"])
        row += 1
    parts = circuit.get("parts") or []
    for part, group_stations in _group_by_parts(circuit.get("stations") or [], parts):
        if part:
            label = part["name"] + (f" \u2014 {part['goal']}"
                if part.get("goal") else "")
            _xlsx_cell(ws, row, 1, label, bold=True)
            row += 1
        elif parts:
            _xlsx_cell(ws, row, 1, "General", bold=True)
            row += 1
        row = _xlsx_circuit_table(ws, row, group_stations)
    return row


def _xlsx_program_content(ws, row, program, title_size=18):
    row = _xlsx_bar(ws, row, program.get("name") or "Program",
                    DOCX_HEADER_DARK, size=title_size)
    months = program.get("durationMonths")
    if months:
        ws.cell(row=row, column=1,
               value=f"Duration: {months} month{'s' if months != 1 else ''}")
        row += 2
    overview = program.get("overview") or {}
    filled = [(label, overview.get(key, "")) for key, label in
             OVERVIEW_FIELD_LABELS if (overview.get(key) or "").strip()]
    if filled:
        row = _xlsx_bar(ws, row, "OVERVIEW", DOCX_HEADER_MED, size=13)
        for label, value in filled:
            _xlsx_cell(ws, row, 1, f"{label}:", bold=True)
            ws.cell(row=row, column=2, value=value)
            row += 1
        row += 1
    for meso in program.get("mesocycles") or []:
        row = _xlsx_bar(ws, row, meso.get("name") or "Mesocycle",
                        DOCX_HEADER_DARK, size=14)
        week_bits = []
        for w in meso.get("weeks") or []:
            wp = []
            if w.get("rpe"):
                wp.append(f"RPE {w['rpe']}")
            if w.get("rir"):
                wp.append(f"RIR {w['rir']}")
            if w.get("loadPercent"):
                wp.append(f"{w['loadPercent']}% load")
            if wp:
                week_bits.append(f"Week {w.get('weekNum', '?')}: " + ", ".join(wp))
        if week_bits:
            ws.cell(row=row, column=1, value="   ".join(week_bits))
            row += 2
        for group in meso.get("sessionGroups") or []:
            for sess in group.get("sessions") or []:
                row = _xlsx_session_content(ws, row, sess, title_size=13)
    return row


def _new_workbook():
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    _xlsx_set_widths(ws, [20, 26, 10, 10, 12, 10])
    return wb, ws


def build_session_xlsx(session):
    wb, ws = _new_workbook()
    ws.title = (session.get("name") or "Session")[:31]
    _xlsx_session_content(ws, 1, session)
    return wb


def build_circuit_xlsx(circuit):
    wb, ws = _new_workbook()
    ws.title = (circuit.get("name") or "Circuit")[:31]
    _xlsx_circuit_content(ws, 1, circuit)
    return wb


def build_program_xlsx(program):
    wb, ws = _new_workbook()
    ws.title = (program.get("name") or "Program")[:31]
    _xlsx_program_content(ws, 1, program)
    return wb


class _RichHtmlToPlainText(HTMLParser):
    """XLSX cells don't support mixed rich formatting the way docx
    runs or HTML do, so this strips it down to readable plain text \u2014
    paragraph breaks preserved as newlines, list items prefixed with
    a bullet. A deliberate simplification, not an oversight, same
    spirit as this app's existing single-sheet-per-export scope."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines = [""]

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ("div", "p") and self.lines[-1]:
            self.lines.append("")
        elif tag == "br":
            self.lines.append("")
        elif tag == "li":
            self.lines.append("\u2022 ")

    def handle_endtag(self, tag):
        if tag.lower() in ("div", "p", "li") and self.lines[-1]:
            self.lines.append("")

    def handle_data(self, data):
        if data:
            self.lines[-1] += data

    def text(self):
        return "\n".join(l for l in self.lines if l.strip()) or ""


def _html_to_plain_text(html_body):
    if not html_body or not html_body.strip():
        return ""
    parser = _RichHtmlToPlainText()
    parser.feed(html_body)
    return parser.text()


def build_guide_xlsx(guide):
    wb, ws = _new_workbook()
    ws.title = (guide.get("name") or "Guide")[:31]
    _xlsx_set_widths(ws, [30, 90])
    row = _xlsx_bar(ws, 1, guide.get("name") or "Guide", DOCX_HEADER_DARK,
                    span=2, size=16)
    body_text = _html_to_plain_text(guide.get("bodyHtml"))
    if body_text:
        cell = ws.cell(row=row, column=1, value=body_text)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        cell.alignment = cell.alignment.copy(wrap_text=True)
        ws.row_dimensions[row].height = min(15 * (body_text.count("\n") + 1), 400)
        row += 2
    for entry in guide.get("entries") or []:
        _xlsx_cell(ws, row, 1, entry.get("name") or "Exercise", bold=True,
                  fill=DOCX_SESSION_BAR, font_color="FFFFFF")
        tags = entry.get("bodyParts") or []
        bits = ([entry["category"]] if entry.get("category") else []) + tags
        text = (" \u00b7 ".join(bits) + "\n" if bits else "") + \
            (entry.get("instructions") or "No instructions on file.")
        cell = ws.cell(row=row, column=2, value=text)
        cell.alignment = cell.alignment.copy(wrap_text=True)
        row += 1
    return wb


def build_questionnaire_xlsx(questionnaire):
    wb, ws = _new_workbook()
    ws.title = (questionnaire.get("name") or "Questionnaire")[:31]
    _xlsx_set_widths(ws, [50, 20])
    row = _xlsx_bar(ws, 1, questionnaire.get("name") or "Questionnaire",
                    DOCX_HEADER_DARK, span=2, size=16)
    _xlsx_cell(ws, row, 1, "Question", bold=True, fill=DOCX_HEADER_MED,
              font_color="FFFFFF")
    _xlsx_cell(ws, row, 2, "Type", bold=True, fill=DOCX_HEADER_MED,
              font_color="FFFFFF")
    row += 1
    for q in questionnaire.get("questions") or []:
        ws.cell(row=row, column=1, value=q.get("text") or "")
        ws.cell(row=row, column=2, value="Rating 1-10"
               if q.get("type") == "rating" else "Short answer")
        row += 1
    return wb


def build_athlete_xlsx(athlete):
    wb, ws = _new_workbook()
    ws.title = (athlete.get("name") or "Athlete")[:31]
    row = _xlsx_bar(ws, 1, athlete.get("name") or "Athlete", DOCX_HEADER_DARK,
                    size=18)
    if athlete.get("email"):
        ws.cell(row=row, column=1, value=f"Email: {athlete['email']}")
        row += 1
    if athlete.get("groups"):
        ws.cell(row=row, column=1, value="Groups: " + ", ".join(athlete["groups"]))
        row += 2
    if athlete.get("notes"):
        row = _xlsx_bar(ws, row, "Notes", DOCX_HEADER_MED, size=13)
        ws.cell(row=row, column=1, value=athlete["notes"])
        row += 2
    assignments = athlete.get("assignments") or []
    if not assignments:
        ws.cell(row=row, column=1, value="Nothing assigned yet.")
    for asn in assignments:
        if asn.get("type") == "program" and asn.get("program"):
            row = _xlsx_program_content(ws, row, asn["program"], title_size=16)
        elif asn.get("type") == "circuit" and asn.get("circuit"):
            row = _xlsx_circuit_content(ws, row, asn["circuit"], title_size=16)
        elif asn.get("type") == "session" and asn.get("session"):
            row = _xlsx_session_content(ws, row, asn["session"], title_size=16)
    return wb


def build_lessonplan_xlsx(plan):
    """Deliberately doesn't embed the layout photo \u2014 same scope
    decision as everywhere else in this file: Excel flattens rich
    content (here, an image) rather than trying to replicate a
    visual layout a spreadsheet was never meant to hold."""
    wb, ws = _new_workbook()
    ws.title = (plan.get("name") or "Lesson Plan")[:31]
    _xlsx_set_widths(ws, [20, 90])
    row = _xlsx_bar(ws, 1, plan.get("name") or "Lesson Plan", DOCX_HEADER_DARK,
                    span=2, size=18)
    bits = []
    if plan.get("date"):
        bits.append(f"Date: {plan['date']}")
    if plan.get("location"):
        bits.append(f"Location: {plan['location']}")
    if plan.get("stores"):
        bits.append(f"Equipment: {plan['stores']}")
    if bits:
        ws.cell(row=row, column=1, value="   ".join(bits))
        row += 1
    overview_text = _html_to_plain_text(plan.get("overviewHtml"))
    if overview_text:
        cell = ws.cell(row=row, column=1, value=overview_text)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        cell.alignment = cell.alignment.copy(wrap_text=True)
        row += 2

    refs = plan.get("refs") or []
    if refs:
        row = _xlsx_bar(ws, row, "Sessions", DOCX_HEADER_MED, size=14)
        for ref in refs:
            if ref.get("type") == "session" and ref.get("session"):
                row = _xlsx_session_content(ws, row, ref["session"], title_size=13)
            elif ref.get("type") == "circuit" and ref.get("circuit"):
                row = _xlsx_circuit_content(ws, row, ref["circuit"], title_size=13)

    for tb in plan.get("textBoxes") or []:
        row = _xlsx_bar(ws, row, tb.get("title") or "Note", DOCX_SESSION_BAR,
                        span=2, size=13)
        text = _html_to_plain_text(tb.get("bodyHtml"))
        if text:
            cell = ws.cell(row=row, column=1, value=text)
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
            cell.alignment = cell.alignment.copy(wrap_text=True)
            row += 2
    return wb


def _try_save(build_fn, path):
    """Shared by every docx/xlsx export method — build_fn is a
    zero-arg callable (a closure over whatever data the caller has)
    that returns a Document or Workbook with a .save() method."""
    try:
        build_fn().save(path)
        return {"ok": True}
    except Exception as e:
        return {"error": f"Couldn't create the document: {e}"}


# ---------------------------------------------------------------- pdf ---
"""Cam: "an export button which will export a PDF of the session...
have a selection feature where i can select multiple then export and
it will collate all selected." reportlab is the pure-Python choice
here on purpose — no external binary (wkhtmltopdf etc) that would
need separate installation on whatever machine this app ends up
running on, unlike the html-to-browser "Print" path above. Same
color scheme (DOCX_HEADER_DARK/MED, BLOCK_COLORS) as every other
export for visual consistency, built from scratch against reportlab's
own Platypus API rather than reusing the docx/xlsx table helpers,
since neither's cell/row model translates directly."""


def _try_save_pdf(build_fn, path):
    """Deliberately separate from _try_save: reportlab's
    SimpleDocTemplate takes its output path at construction, then
    .build(story) writes it — there's no .save(path) to call
    afterward, so the two helpers can't share one contract."""
    try:
        build_fn(path)
        return {"ok": True}
    except Exception as e:
        return {"error": f"Couldn't create the PDF: {e}"}


def _pdf_doc(path):
    from reportlab.platypus import SimpleDocTemplate
    from reportlab.lib.pagesizes import letter
    return SimpleDocTemplate(path, pagesize=letter,
        topMargin=40, bottomMargin=40, leftMargin=48, rightMargin=48)


def _pdf_base_style():
    from reportlab.lib.styles import getSampleStyleSheet
    return getSampleStyleSheet()["Normal"]


def _pdf_bar(text, hex_color, size=16):
    """A colored title bar flowable, matching _html_bar/_add_bar_heading's
    look — a full-width filled table with one white bold cell, not a
    styled Paragraph, since Paragraph alone can't carry a background."""
    from reportlab.platypus import Table, TableStyle
    from reportlab.platypus import Paragraph
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.styles import ParagraphStyle
    style = ParagraphStyle("CCBar", fontName="Helvetica-Bold", fontSize=size,
        textColor=white, leading=size + 4)
    t = Table([[Paragraph(_he(text), style)]], colWidths=[468])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(f"#{hex_color}")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def _pdf_subheading(text, goal=None):
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    style = ParagraphStyle("CCSub", fontName="Helvetica-Bold", fontSize=12,
        spaceBefore=10, spaceAfter=4)
    label = _he(text) + (f" \u2014 {_he(goal)}" if goal else "")
    return Paragraph(label, style)


def _pdf_table(rows, columns, color_fn=None):
    """rows: list of dicts (items/stations). columns: same
    [(key, label, always_show), ...] shape _visible_columns already
    uses elsewhere. color_fn(row) -> hex string or None, for the
    block-coloring sessions get and circuits deliberately don't."""
    from reportlab.platypus import Table, TableStyle, Paragraph
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.styles import ParagraphStyle
    base = _pdf_base_style()
    if not rows:
        return Paragraph("Nothing here yet.", base)
    cols = _visible_columns(rows, columns)
    header_style = ParagraphStyle("CCTh", fontName="Helvetica-Bold",
        fontSize=9, textColor=white)
    name_key = next((k for k, l in cols if l == "Exercise"), None)
    data = [[Paragraph(label.upper(), header_style) for key, label in cols]]
    row_colors = []
    for r in rows:
        cells = []
        for key, label in cols:
            val = r.get(key, "")
            cells.append(Paragraph(_he(val) if val else "\u2014", base))
        data.append(cells)
        row_colors.append(color_fn(r) if color_fn else None)

    n = len(cols)
    name_idx = next((i for i, (k, l) in enumerate(cols) if l == "Exercise"), 0)
    widths = [468 / n] * n
    widths[name_idx] = 468 - sum(w for i, w in enumerate(widths) if i != name_idx)

    table = Table(data, colWidths=widths, repeatRows=1)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HexColor(f"#{DOCX_HEADER_MED}")),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#BBBBBB")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for i, color in enumerate(row_colors):
        if color:
            cmds.append(("BACKGROUND", (0, i + 1), (-1, i + 1), HexColor(f"#{color}")))
    table.setStyle(TableStyle(cmds))
    return table


def _session_pdf_story(session, title_size=16):
    from reportlab.platypus import Spacer, Paragraph
    base = _pdf_base_style()
    story = [_pdf_bar(session.get("name") or "Session", DOCX_HEADER_DARK,
                      size=title_size), Spacer(1, 8)]
    if session.get("notes"):
        story.append(Paragraph(_he(session["notes"]), base))
        story.append(Spacer(1, 8))
    parts = session.get("parts") or []
    for part, group_items in _group_by_parts(session.get("items") or [], parts):
        if part:
            story.append(_pdf_subheading(part["name"], part.get("goal")))
        elif parts:
            story.append(_pdf_subheading("General"))
        story.append(_pdf_table(group_items, [("block", "Block", False),
            ("name", "Exercise", True), ("sets", "Sets", False),
            ("reps", "Reps", False), ("load", "Load", False),
            ("rest", "Rest", False)], color_fn=lambda it: _color_for_block(it.get("block", ""))))
        story.append(Spacer(1, 10))
    return story


def _circuit_pdf_story(circuit, title_size=16):
    from reportlab.platypus import Spacer, Paragraph
    base = _pdf_base_style()
    story = [_pdf_bar(circuit.get("name") or "Circuit", DOCX_HEADER_DARK,
                      size=title_size), Spacer(1, 8)]
    bits = []
    if circuit.get("type"):
        bits.append(f"Type: {circuit['type']}")
    if circuit.get("rounds"):
        bits.append(f"Rounds: {circuit['rounds']}")
    if circuit.get("timeCap"):
        bits.append(f"Time cap: {circuit['timeCap']}")
    if bits:
        story.append(Paragraph(_he("   ".join(bits)), base))
        story.append(Spacer(1, 4))
    if circuit.get("notes"):
        story.append(Paragraph(_he(circuit["notes"]), base))
        story.append(Spacer(1, 8))
    parts = circuit.get("parts") or []
    for part, group_stations in _group_by_parts(circuit.get("stations") or [], parts):
        if part:
            story.append(_pdf_subheading(part["name"], part.get("goal")))
        elif parts:
            story.append(_pdf_subheading("General"))
        story.append(_pdf_table(group_stations, [("name", "Exercise", True),
            ("workTime", "Work", False), ("reps", "Reps", False),
            ("load", "Load", False), ("rest", "Rest", False)]))
        story.append(Spacer(1, 10))
    return story


def _guide_pdf_story(guide, title_size=16):
    """A guide as PDF flowables.

    Guides are rich HTML, and reportlab's Paragraph understands only a small
    subset of tags. So the HTML is walked and converted: headings become
    subheadings, list items get a bullet, tables become real tables, and
    everything else becomes a paragraph with the inline tags reportlab does
    handle (<b>, <i>, <u>, <br/>) left intact. Anything unrecognised is
    stripped rather than printed as angle brackets.
    """
    from reportlab.platypus import Spacer, Paragraph
    base = _pdf_base_style()
    story = [_pdf_bar(guide.get("name") or "Guide", DOCX_HEADER_DARK,
                      size=title_size), Spacer(1, 8)]

    html = guide.get("bodyHtml") or ""
    for kind, text, rows in _walk_rich_html(html):
        if kind == "heading":
            story.append(_pdf_subheading(text))
        elif kind == "table" and rows:
            story.append(_pdf_raw_table(rows))
            story.append(Spacer(1, 8))
        elif text.strip():
            story.append(Paragraph(text, base))
            story.append(Spacer(1, 5))
    return story


#: Inline tags reportlab's Paragraph understands. Everything else goes.
_PDF_KEEP_INLINE = ("b", "i", "u", "strong", "em", "br", "super", "sub")


def _walk_rich_html(html):
    """Yield (kind, text, rows) for each block in a guide's HTML."""
    import re as _re

    # Tables first, so their contents are not also emitted as paragraphs.
    position = 0
    for match in _re.finditer(r"<table[^>]*>(.*?)</table>", html,
                              _re.S | _re.I):
        before = html[position:match.start()]
        for block in _rich_blocks(before):
            yield block
        rows = []
        for row in _re.findall(r"<tr[^>]*>(.*?)</tr>", match.group(1),
                               _re.S | _re.I):
            cells = _re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row,
                                _re.S | _re.I)
            rows.append([_strip_to_plain(c) for c in cells])
        yield ("table", "", rows)
        position = match.end()
    for block in _rich_blocks(html[position:]):
        yield block


def _rich_blocks(html):
    import re as _re
    for match in _re.finditer(
            r"<(h[1-6]|p|li|blockquote)[^>]*>(.*?)</\1>", html, _re.S | _re.I):
        tag = match.group(1).lower()
        inner = _clean_inline(match.group(2))
        if not inner.strip():
            continue
        if tag.startswith("h"):
            yield ("heading", _strip_to_plain(match.group(2)), None)
        elif tag == "li":
            yield ("para", "&bull; " + inner, None)
        else:
            yield ("para", inner, None)


def _clean_inline(fragment):
    """Keep the handful of inline tags reportlab understands; drop the rest."""
    import re as _re
    keep = "|".join(_PDF_KEEP_INLINE)
    out = _re.sub(rf"</?(?!(?:{keep})\b)[a-zA-Z][^>]*>", "", fragment)
    return out.replace("&nbsp;", " ").strip()


def _strip_to_plain(fragment):
    import re as _re
    return _he(_re.sub(r"<[^>]+>", "", fragment).replace("&nbsp;", " ").strip())


def _pdf_raw_table(rows):
    """A table of already-plain strings, with the first row as the header."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Table, TableStyle

    base = _pdf_base_style()
    head = _pdf_base_style()
    head.fontName = "Helvetica-Bold"
    width = 170 * mm
    columns = max(len(r) for r in rows) if rows else 1
    data = [[Paragraph(cell, head if i == 0 else base) for cell in row]
            for i, row in enumerate(rows)]
    table = Table(data, colWidths=[width / columns] * columns, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#" + DOCX_HEADER_DARK)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#BBBBBB")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def _program_pdf_story(program, title_size=16):
    from reportlab.platypus import Spacer, Paragraph
    base = _pdf_base_style()
    story = [_pdf_bar(program.get("name") or "Program", DOCX_HEADER_DARK,
                      size=title_size), Spacer(1, 8)]

    for key, value in (program.get("overview") or {}).items():
        if value:
            story.append(Paragraph(f"<b>{_he(str(key).title())}:</b> "
                                   f"{_he(str(value))}", base))
            story.append(Spacer(1, 3))

    for block in program.get("mesocycles") or []:
        story.append(Spacer(1, 6))
        story.append(_pdf_subheading(block.get("name") or "Block",
                                     block.get("goal")))
        rows = [["Week", "RPE", "RIR", "Load", "Sessions"]]
        for i, week in enumerate(block.get("weeks") or [], start=1):
            rows.append([
                str(week.get("label") or f"Week {i}"),
                str(week.get("rpe") or ""),
                str(week.get("rir") or ""),
                f"{week.get('load')}%" if week.get("load") else "",
                str(len(week.get("sessionIds") or week.get("sessions") or [])),
            ])
        if len(rows) > 1:
            story.append(_pdf_raw_table(rows))
            story.append(Spacer(1, 8))
    return story


#: Every kind that can go into a collated PDF, and how to draw one.
PDF_STORIES = {
    "session": _session_pdf_story,
    "circuit": _circuit_pdf_story,
    "guide": _guide_pdf_story,
    "program": _program_pdf_story,
}


def build_mixed_pdf_collated(path, entries):
    """One PDF from a mixed selection, each record starting a new page.

    `entries` is [{"kind": ..., "record": {...}}, ...] in the order chosen.
    A kind with no story is skipped rather than raising — one unsupported
    record should not cost the export.
    """
    from reportlab.platypus import PageBreak

    story = []
    drawn = 0
    for entry in entries or []:
        builder = PDF_STORIES.get(entry.get("kind"))
        record = entry.get("record")
        if not builder or not record:
            continue
        if drawn:
            story.append(PageBreak())
        story.extend(builder(record))
        drawn += 1
    if not drawn:
        raise ValueError("Nothing in that selection can be put in a PDF.")
    _pdf_doc(path).build(story)
    return drawn


def build_session_pdf(path, session):
    _pdf_doc(path).build(_session_pdf_story(session))


def build_circuit_pdf(path, circuit):
    _pdf_doc(path).build(_circuit_pdf_story(circuit))


def build_sessions_pdf_collated(path, sessions):
    """Cam: "select multiple then export and it will collate all
    selected." One PDF, each session starting on its own page."""
    from reportlab.platypus import PageBreak
    story = []
    for i, s in enumerate(sessions):
        if i > 0:
            story.append(PageBreak())
        story.extend(_session_pdf_story(s))
    _pdf_doc(path).build(story)


def build_circuits_pdf_collated(path, circuits):
    from reportlab.platypus import PageBreak
    story = []
    for i, c in enumerate(circuits):
        if i > 0:
            story.append(PageBreak())
        story.extend(_circuit_pdf_story(c))
    _pdf_doc(path).build(story)


# --------------------------------------------------------------- Api ---


# ---------------------------------------------------------------- log ---
"""The training log (Cam, 2026-10-05): "when i select a session or program the 3 dots
should have an option for log which will allow me to print a stylised log that has the
sessions broken into the lifts then it has the selected amount of weeks 1-10 which allow
me to enter the weight of the exercise each week to track. Provide a guide at the top of
the log which tells you that the middle set is the best one to record for the lift. For
program it will be different where it uses the programs durations as a guide to how much
weeks they use."

The record is a session or a program with `logWeeks` (how many week columns) added by
the app; a program also brings `sessionDetails`. Warm-up (W) and cool-down (Z) blocks are
left off -- they're not lifts to track."""

LOG_MAX_WEEKS = 52
#: week columns that fit one table: up to six stay portrait, more turn the page landscape,
#: and past ten a lift's weeks carry on in a second table below
LOG_PORTRAIT_WEEKS = 6
LOG_WEEKS_PER_TABLE = 10

LOG_GUIDE = [
    "Record the weight of your <b>middle set</b> for each lift (set 2 of 3, set 3 of 5; "
    "with an even number, either middle one). The first sets are still warming you up and "
    "the last ones are shaped by fatigue, so the middle set is the truest picture of your "
    "working weight. For bodyweight or timed work, record the reps or the time instead.",
    "Write it in that week's box after the session. Use the same set every week, so the "
    "numbers can be compared.",
    "Aim to add a little load week to week while keeping the reps on target. If the reps "
    "drop, hold the weight until they come back.",
]


def program_weeks(program):
    """How long a program runs, in weeks: its blocks' weeks, or else its length in
    months (four weeks each). 0 when it says neither."""
    weeks = sum(len(m.get("weeks") or []) for m in program.get("mesocycles") or [])
    if weeks:
        return weeks
    try:
        return int(round(float(program.get("durationMonths") or 0) * 4))
    except (TypeError, ValueError):
        return 0


def _log_week_targets(record, weeks):
    """Per week, the target to print under its number ("RIR 3"), from a program's
    blocks in order. Empty for a session."""
    flat = [w for m in record.get("mesocycles") or [] for w in m.get("weeks") or []]
    out = []
    for i in range(weeks):
        w = flat[i] if i < len(flat) else {}
        bits = []
        if str(w.get("rir") or "").strip():
            bits.append(f"RIR {w['rir']}")
        if str(w.get("rpe") or "").strip():
            bits.append(f"RPE {w['rpe']}")
        if str(w.get("loadPercent") or "").strip():
            bits.append(f"{w['loadPercent']}%")
        out.append(" · ".join(bits))
    return out


def _log_sessions(record):
    """[(kicker, session)] -- one for a session, each of a program's in order."""
    if record.get("mesocycles") is None:
        return [("", record)]
    out = []
    for meso in record.get("mesocycles") or []:
        for group in meso.get("sessionGroups") or []:
            for sess in group.get("sessions") or []:
                out.append((meso.get("name") or "", _program_session(record, sess)))
    return out


def _log_lifts(session):
    return [it for it in session.get("items") or []
            if (it.get("name") or "").strip()
            and (_block_letter(it.get("block")) or "")[:1] not in NEUTRAL_BLOCKS]


def middle_set(sets):
    """Which set to record: "Set 2" of 3, "Set 2 or 3" of 4; "" if sets isn't a number."""
    m = re.match(r"^\s*(\d+)", str(sets or ""))
    if not m:
        return ""
    n = int(m.group(1))
    if n <= 1:
        return "Set 1"
    if n % 2:
        return f"Set {(n + 1) // 2}"
    return f"Set {n // 2} or {n // 2 + 1}"


def _log_target(it):
    bits = []
    if it.get("sets") and it.get("reps"):
        bits.append(f"{it['sets']} × {it['reps']}")
    elif it.get("reps"):
        bits.append(str(it["reps"]))
    elif it.get("sets"):
        bits.append(f"{it['sets']} sets")
    if it.get("load"):
        bits.append(str(it["load"]))
    return " · ".join(bits)


LOG_CSS = """
.log-fields { display: flex; gap: 18px; margin: 4px 0 12px; font-size: 12px; color: #5d665f; }
.log-fields span { flex: 1; border-bottom: 1px solid #9aa39b; padding-bottom: 3px; }
.log-fields b { color: #1F2A24; margin-right: 6px; }
.log-fields .units { flex: 0 0 auto; border: 0; }
.log-fields .units i { font-style: normal; border: 1px solid #9aa39b; border-radius: 999px;
  padding: 1px 9px; margin-left: 4px; color: #1F2A24; }
.nn-panel ol { margin: 2px 0 0; padding-left: 18px; }
.nn-panel li { margin-bottom: 3px; }
.log-session { margin-bottom: 8px; }
table.logt tr { break-inside: avoid; page-break-inside: avoid; }
table.logt thead { display: table-header-group; }
table.logt { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed;
  border: 1px solid #d6d9d3; border-radius: 6px; overflow: hidden; margin: 4px 0 12px;
  font-size: 11.5px; }
table.logt th { background: #33473B; color: #fff; font-size: 9.5px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; padding: 7px 6px; text-align: left;
  vertical-align: bottom; }
table.logt th.wk { text-align: center; }
table.logt th.wk small { display: block; font-size: 8.5px; font-weight: 600; letter-spacing: 0;
  text-transform: none; color: #cfe3d2; margin-top: 2px; }
table.logt td { border-top: 1px solid #d6d9d3; padding: 6px; vertical-align: middle; }
table.logt td.blk { font-weight: 700; text-align: center; }
table.logt td.lift { font-weight: 600; }
table.logt td.lift small { display: block; font-weight: 400; color: #5d665f; font-size: 10.5px; }
table.logt td.rec { color: #2E6B38; font-weight: 600; font-size: 10.5px; }
table.logt td.wk { height: 34px; border-left: 1px solid #e3e6e0; background: #fff;
  position: relative; }
table.logt td.wk::after { content: ""; position: absolute; left: 6px; right: 6px; bottom: 8px;
  border-bottom: 1px dotted #b9c0b8; }
table.logt tr:nth-child(even) td.wk { background: #fafbf9; }
.log-cont { font-size: 10.5px; color: #5d665f; margin: -4px 0 4px; }
"""


def _log_table(lifts, first, last, targets):
    cols = (f'<col style="width:9%"><col style="width:30%"><col style="width:13%">'
            + "".join('<col>' for _ in range(first, last + 1)))
    head = ('<th>Block</th><th>Lift &middot; target</th><th>Record set</th>'
            + "".join(f'<th class="wk">Week {w}'
                      + (f'<small>{_he(targets[w - 1])}</small>' if targets[w - 1] else "")
                      + '</th>' for w in range(first, last + 1)))
    rows = []
    for it in lifts:
        color = _color_for_block(it.get("block", ""))
        fill = f' style="background:#{color}"' if color else ""
        target = _log_target(it)
        rows.append(
            f'<tr><td class="blk"{fill}>{_he(it.get("block") or "")}</td>'
            f'<td class="lift">{_exercise_name_cell(it)}'
            + (f'<small>{_he(target)}</small>' if target else "") + '</td>'
            f'<td class="rec">{_he(middle_set(it.get("sets"))) or "&mdash;"}</td>'
            + "".join('<td class="wk"></td>' for _ in range(first, last + 1)) + '</tr>')
    return (f'<table class="logt"><colgroup>{cols}</colgroup><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>')


def _log_html(record, title_size=22):
    """The printed log: who and when, the guide, then each session's lifts with a box a week."""
    try:
        weeks = int(record.get("logWeeks") or 0)
    except (TypeError, ValueError):
        weeks = 0
    is_program = record.get("mesocycles") is not None
    if weeks <= 0:
        weeks = (program_weeks(record) if is_program else 0) or 6
    weeks = max(1, min(LOG_MAX_WEEKS, weeks))
    targets = _log_week_targets(record, weeks)
    sessions = _log_sessions(record)
    parts = []
    if weeks > LOG_PORTRAIT_WEEKS:
        parts.append('<style>@page { size: A4 landscape; } body { max-width: 1120px; }</style>')
    parts.append(f'<style>{LOG_CSS}</style>')
    meta = [("Weeks", str(weeks)),
            ("Sessions", str(len(sessions)) if is_program else ""),
            ("Lifts", str(sum(len(_log_lifts(s)) for _, s in sessions)))]
    parts.append(_title_block("Program log" if is_program else "Session log",
                              record.get("name") or "Training log", meta))
    parts.append('<div class="log-fields"><span><b>Athlete</b></span><span><b>Start date</b></span>'
                 '<span class="units"><b>Units</b><i>kg</i><i>lb</i></span></div>')
    guide = "".join(f"<li>{g}</li>" for g in LOG_GUIDE)
    if is_program and any(targets):
        guide += ("<li>Each week's target from the program (RIR, RPE or load) is under its "
                  "number.</li>")
    parts.append(f'<div class="nn-panel"><div class="nn-panel-label">How to use this log</div>'
                 f'<ol>{guide}</ol></div>')
    total = len(sessions)
    for i, (meso, sess) in enumerate(sessions, 1):
        lifts = _log_lifts(sess)
        if not lifts:
            continue
        block = ['<div class="log-session">']
        if is_program:
            kicker = f"Session {i} of {total}" + (f" · {meso}" if meso else "")
            block.append(f'<div class="nn-kicker" style="margin-top:14px">{_he(kicker)}</div>')
            block.append(_html_bar(sess.get("name") or "Session", DOCX_SESSION_BAR, 14))
        else:
            block.append(_html_bar("Lifts", DOCX_SESSION_BAR, 14))
        for first in range(1, weeks + 1, LOG_WEEKS_PER_TABLE):
            last = min(weeks, first + LOG_WEEKS_PER_TABLE - 1)
            if first > 1:
                block.append(f'<div class="log-cont">Weeks {first}–{last}</div>')
            block.append(_log_table(lifts, first, last, targets))
        block.append('</div>')
        parts.append("".join(block))
    if not any(_log_lifts(s) for _, s in sessions):
        parts.append('<p>There are no lifts to log here yet -- add exercises (outside the '
                     'warm-up and cool-down) first.</p>')
    return "".join(parts)


def build_log_xlsx(record):
    """The same log as a spreadsheet, to type the weights in: a section per session,
    a column per week, the record set beside each lift. Frozen headings."""
    from openpyxl.styles import Alignment, Border, Side
    try:
        weeks = int(record.get("logWeeks") or 0)
    except (TypeError, ValueError):
        weeks = 0
    is_program = record.get("mesocycles") is not None
    if weeks <= 0:
        weeks = (program_weeks(record) if is_program else 0) or 6
    weeks = max(1, min(LOG_MAX_WEEKS, weeks))
    targets = _log_week_targets(record, weeks)
    wb, ws = _new_workbook()
    ws.title = "Log"
    _xlsx_set_widths(ws, [8, 34, 20, 12] + [11] * weeks)
    thin = Side(style="thin", color="D6D9D3")
    box = Border(left=thin, right=thin, top=thin, bottom=thin)
    span = 4 + weeks
    row = _xlsx_bar(ws, 1, record.get("name") or "Training log", DOCX_HEADER_DARK, span=span, size=14)
    ws.cell(row=row, column=1, value="Record the weight of your middle set for each lift, in that week's column.")
    row += 2
    for meso, sess in _log_sessions(record):
        lifts = _log_lifts(sess)
        if not lifts:
            continue
        if is_program:
            row = _xlsx_bar(ws, row, sess.get("name") or "Session", DOCX_SESSION_BAR, span=span, size=12)
        heads = ["Block", "Lift", "Target", "Record"] + [
            f"Week {w}" + (f"\n{targets[w - 1]}" if targets[w - 1] else "") for w in range(1, weeks + 1)]
        for c, h in enumerate(heads, 1):
            cell = _xlsx_cell(ws, row, c, h, bold=True, fill=DOCX_HEADER_MED, font_color="FFFFFF")
            cell.alignment = Alignment(wrap_text=True, vertical="center",
                                       horizontal="center" if c > 4 else "left")
        row += 1
        for it in lifts:
            color = _color_for_block(it.get("block", ""))
            vals = [it.get("block") or "", it.get("name") or "", _log_target(it), middle_set(it.get("sets"))]
            for c, v in enumerate(vals, 1):
                cell = _xlsx_cell(ws, row, c, v, bold=c == 2, fill=color if c == 1 else None)
                cell.border = box
            for c in range(5, 5 + weeks):
                cell = ws.cell(row=row, column=c)
                cell.border = box
                cell.number_format = "0.0"
            row += 1
        row += 1
    ws.freeze_panes = "C1"
    return wb
