"""App stats: what is in NeuroNet, and how it is used.

Cam: "In Settings menu an application stats panel that breaks down what is in
the app and how much ... this will help me collect data on most used features
and help direct future adaptations of the app. This data should also be able
to be exported into excel, a doc or imported into the in app boards feature
with a chart."

TWO KINDS OF NUMBER, and the difference matters when they go on a slide.

  * WHAT IS IN THE APP -- recipes, tracks, photos, sessions -- is counted
    fresh from the data files every time the panel opens. It is always
    exactly right, including for everything made before this existed.

  * HOW THE APP IS USED -- time in the app and in each section, time music
    played, things printed -- was never written down anywhere before. It is
    recorded from the day this shipped, in usage.json, and the panel says
    which day that was rather than letting a week of data pass for a year.

Puzzles completed is the exception that proves the rule: Cranium has always
kept a history of every game, so that one goes back as far as Cranium does.

The usage file is only ever changed by adding to it, under a lock: pywebview
answers calls on more than one thread, and two flushes racing a
read-modify-write would each throw the other's minutes away.
"""
import datetime
import io
import json
import os
import threading

_lock = threading.Lock()

EMPTY = {"since": None, "launches": 0, "seconds": 0, "musicSeconds": 0,
         "sections": {}, "days": {}, "counts": {}}


def _now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _clean(doc):
    """A usage document with every field present and the right type, so a
    hand-edited or half-written file can never break the stats panel."""
    out = json.loads(json.dumps(EMPTY))
    if not isinstance(doc, dict):
        return out
    for k in ("launches", "seconds", "musicSeconds"):
        v = doc.get(k)
        out[k] = v if isinstance(v, (int, float)) and v >= 0 else 0
    out["since"] = doc.get("since") if isinstance(doc.get("since"), str) else None
    for k in ("sections", "days", "counts"):
        v = doc.get(k)
        if isinstance(v, dict):
            out[k] = {str(a): b for a, b in v.items()
                      if isinstance(b, (int, float)) and b >= 0}
    return out


def read_usage(path):
    try:
        with open(path, encoding="utf-8") as f:
            return _clean(json.load(f))
    except (OSError, ValueError):
        return _clean(None)


def _write(path, doc):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, sort_keys=True)
    os.replace(tmp, path)


def update_usage(path, change):
    """Read, change, write -- the only way the usage file is ever altered."""
    with _lock:
        doc = read_usage(path)
        if not doc["since"]:
            doc["since"] = _now_iso()
        change(doc)
        _write(path, doc)
        return doc


# Largest believable chunk of time one flush can carry. The app flushes about
# once a minute; a figure far beyond that is a bug or a clock jump, and one
# bad flush must not add a day to "time in app".
MAX_FLUSH_SECONDS = 15 * 60


def _secs(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 0
    return max(0, min(MAX_FLUSH_SECONDS, v))


def record(path, delta):
    """Add a flush of time from the app: {seconds, section, musicSeconds, day}."""
    delta = delta if isinstance(delta, dict) else {}
    secs = _secs(delta.get("seconds"))
    music = _secs(delta.get("musicSeconds"))
    sections = delta.get("sections") if isinstance(delta.get("sections"), dict) else {}
    day = str(delta.get("day") or datetime.date.today().isoformat())[:10]

    def change(doc):
        doc["seconds"] += secs
        doc["musicSeconds"] += music
        if secs:
            doc["days"][day] = doc["days"].get(day, 0) + secs
        for key, s in sections.items():
            s = _secs(s)
            if s and key:
                doc["sections"][str(key)] = doc["sections"].get(str(key), 0) + s
    return update_usage(path, change)


def count(path, key, n=1):
    """One more of something: a print, an export, a dashboard puzzle solved."""
    key = str(key or "").strip()
    if not key:
        return None

    def change(doc):
        doc["counts"][key] = doc["counts"].get(key, 0) + max(1, int(n or 1))
    return update_usage(path, change)


def launched(path):
    def change(doc):
        doc["launches"] += 1
    return update_usage(path, change)


def reset(path):
    """Start the record again from now (Cam, 2026-10-02: "I want a reset
    stats feature in the app stats"). Time, music, launches, prints and
    exports go back to nothing and "since" is today. The old file is kept
    beside it, usage.json.before-reset-<when>, so a reset by mistake can be
    undone by hand. What is IN the app is counted live, so nothing to reset
    there. -> the name the old record was kept under, or "" if there was none."""
    with _lock:
        kept = ""
        if os.path.exists(path):
            kept = path + ".before-reset-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
            os.replace(path, kept)
        doc = _clean(None)
        doc["since"] = _now_iso()
        _write(path, doc)
        return os.path.basename(kept)


# ---------------------------------------------------------------- counting

def _n(v):
    return len(v) if isinstance(v, (list, dict)) else 0


def _safe(fn, default):
    """Each store is read on its own: one unreadable file costs its own
    numbers, never the whole panel."""
    try:
        v = fn()
        return default if (isinstance(v, dict) and v.get("error")) else v
    except Exception:
        return default


def puzzle_numbers(cranium):
    """Games played and completed, from Cranium's own history.

    Each game keeps a list of sessions ({won, time}) plus, for anything
    recorded before that list existed, a `legacy` running total. Both are
    counted, so nothing played before the upgrade goes missing."""
    stats = (cranium or {}).get("stats") or {}
    by_game, played, won, secs = {}, 0, 0, 0
    for key, entry in stats.items():
        if not isinstance(entry, dict):
            continue
        sessions = [s for s in entry.get("sessions") or [] if isinstance(s, dict)]
        legacy = entry.get("legacy") if isinstance(entry.get("legacy"), dict) else {}
        p = len(sessions) + int(legacy.get("plays") or 0)
        w = sum(1 for s in sessions if s.get("won")) + int(legacy.get("wins") or 0)
        t = sum(s.get("time") or 0 for s in sessions
                if isinstance(s.get("time"), (int, float)))
        if p:
            by_game[key] = {"played": p, "won": w, "seconds": t}
        played += p; won += w; secs += t
    return {"played": played, "completed": won, "seconds": secs, "byGame": by_game}


def _tree_counts(tree):
    notes = canvases = 0
    stack = list(tree or [])
    while stack:
        x = stack.pop()
        if not isinstance(x, dict):
            continue
        if x.get("type") == "note":
            notes += 1
        elif x.get("type") == "canvas":
            canvases += 1
        stack.extend(x.get("children") or [])
    return notes, canvases


def gather(api, usage_path):
    """Everything the panel shows, as plain numbers. `api` is NeuroNet's Api
    -- the same readers the app itself uses, so a count here can never
    disagree with what a screen shows."""
    photos = _safe(api.photo_get_data, {})
    music = _safe(lambda: api.music_read_json("chords.json"), {})
    kitchen = _safe(api.kc_get_data, {}) or {}
    training = _safe(api.training_load, {}) or {}
    cranium = _safe(api.cranium_get_data, {}) or {}
    cards = _safe(lambda: api.cards_read_json("celestial.json"), {}) or {}
    effects = _safe(api.effects_load, {}) or {}
    stuff = _safe(api.stuff_load, {}) if hasattr(api, "stuff_load") else {}
    invs = [i for i in ((stuff or {}).get("inventories") or []) if isinstance(i, dict)]
    notes, canvases = _tree_counts(_safe(api.notes_list_tree, []))

    exercises = training.get("exercises") or {}
    exercise_count = sum(_n(v) for v in exercises.values()) \
        if isinstance(exercises, dict) else _n(exercises)
    # Readings are journal entries now (Mindfulness -> Journal), with their cards.
    journal = _safe(lambda: api.journal_list(), []) or []
    journal = journal if isinstance(journal, list) else []
    readings = sum(1 for e in journal if isinstance(e, dict) and e.get("reading"))

    content = {
        # Home & photos
        "photos": _n((photos or {}).get("photos")),
        "albums": _n((photos or {}).get("albums")),
        "contacts": _n(kitchen.get("contacts")),
        "events": _n(kitchen.get("events")),
        "effects": _n(effects.get("items")),       # Stuff -> Media
        "inventories": len(invs),
        "inventoryItems": sum(_n(i.get("items")) for i in invs),
        # Music
        "tracks": _n((music or {}).get("tracks")),
        "playlists": _n((music or {}).get("playlists")),
        "musicAlbums": _n((music or {}).get("albums")),
        "meditations": _n(_safe(api.meditation_list, [])),
        # Kitchen
        "recipes": _n(kitchen.get("recipes")),
        "menus": _n(kitchen.get("menus")),
        "shoppingLists": _n(kitchen.get("shoppingLists")),
        "recipeBooks": _n(kitchen.get("books")),
        # Training
        "sessions": _n(training.get("sessions")),
        "circuits": _n(training.get("circuits")),
        "programs": _n(training.get("programs")),
        "exercises": exercise_count,
        "guides": _n(training.get("guides")),
        "lessonPlans": _n(training.get("lessonPlans")),
        "athletes": _n(training.get("athletes")),
        "questionnaires": _n(training.get("questionnaires")),
        "trainingBooks": _n(training.get("books")),
        # Notes
        "notes": notes,
        "canvases": canvases,
        "fleeting": _n(_safe(api.fleeting_list, [])),
        "boards": _n(_safe(api.boards_list, [])),
        "scrapbooks": _n(_safe(getattr(api, "scrapbooks_list", lambda: []), [])),
        "covers": _n(_safe(getattr(api, "covers_list", lambda: []), [])),
        "assets": _n(_safe(lambda: api.assets_list().get("assets"), [])),
        "spreadsheets": _n(_safe(api.cells_list, [])),
        "notebooks": _n(_safe(api.notebooks_list, [])),
        # Puzzles & divination
        "puzzleBooks": _n(cranium.get("books")),
        "readings": readings,
        "journalEntries": len(journal),               # Mindfulness -> Journal
        "gratitude": _n(cards.get("gratitude")),
    }
    return {
        "generated": _now_iso(),
        "content": content,
        "puzzles": puzzle_numbers(cranium),
        "usage": read_usage(usage_path),
    }


# ---------------------------------------------------------------- exports
#
# The panel hands over what it SHOWS -- titled groups of labelled rows, and
# the charts -- rather than the raw numbers. The labels and the formatting
# ("4 h 23 min") are written once, in the panel, and the Word and Excel files
# can only ever say what the screen says.

def _model_ok(model):
    return isinstance(model, dict) and isinstance(model.get("groups"), list)


def build_xlsx(model):
    """One sheet per group, plus a Charts sheet with a real Excel bar chart
    for each chart -- a chart PowerPoint takes with a paste, and one that
    stays editable there."""
    from openpyxl import Workbook
    from openpyxl.chart import BarChart, Reference
    from openpyxl.styles import Alignment, Font, PatternFill

    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    head_fill = PatternFill("solid", fgColor="E8EEF7")
    bold = Font(bold=True)

    summary.append([model.get("title") or "NeuroNet — App stats"])
    summary["A1"].font = Font(bold=True, size=14)
    for line in model.get("notes") or []:
        summary.append([line])
    summary.append([])
    for group in model["groups"]:
        summary.append([group.get("title", "")])
        summary.cell(summary.max_row, 1).font = bold
        summary.cell(summary.max_row, 1).fill = head_fill
        summary.cell(summary.max_row, 2).fill = head_fill
        summary.cell(summary.max_row, 3).fill = head_fill
        for row in group.get("rows") or []:
            label, shown, value = (list(row) + [None, None, None])[:3]
            summary.append([label, value if isinstance(value, (int, float)) else shown,
                            shown if isinstance(value, (int, float)) and str(shown) != str(value) else None])
        summary.append([])
    summary.column_dimensions["A"].width = 34
    summary.column_dimensions["B"].width = 14
    summary.column_dimensions["C"].width = 22
    for row in summary.iter_rows(min_col=2, max_col=2):
        for c in row:
            c.alignment = Alignment(horizontal="right")

    charts = [c for c in model.get("charts") or [] if c.get("labels")]
    if charts:
        ws = wb.create_sheet("Charts")
        row = 1
        for ch in charts:
            ws.cell(row, 1, ch.get("title") or "")
            ws.cell(row, 1).font = bold
            ws.cell(row, 2, ch.get("unit") or "Value")
            start = row + 1
            for i, (lab, val) in enumerate(zip(ch["labels"], ch["values"])):
                ws.cell(start + i, 1, lab)
                ws.cell(start + i, 2, val)
            end = start + len(ch["labels"]) - 1
            chart = BarChart()
            chart.type = "bar" if len(ch["labels"]) > 6 else "col"
            chart.title = ch.get("title") or None
            chart.legend = None
            chart.y_axis.title = ch.get("unit") or None
            chart.add_data(Reference(ws, min_col=2, min_row=row, max_row=end), titles_from_data=True)
            chart.set_categories(Reference(ws, min_col=1, min_row=start, max_row=end))
            chart.height = max(7.5, 0.6 * len(ch["labels"]) + 3)
            chart.width = 18
            ws.add_chart(chart, "D%d" % row)
            row = end + max(3, int(chart.height * 2) - len(ch["labels"]) + 2)
        ws.column_dimensions["A"].width = 28
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_docx(model):
    """A Word document: a title, the date the usage figures start, and one
    table per group."""
    import docx
    from docx.shared import Pt

    doc = docx.Document()
    doc.add_heading(model.get("title") or "NeuroNet — App stats", level=0)
    for line in model.get("notes") or []:
        p = doc.add_paragraph(line)
        for r in p.runs:
            r.font.size = Pt(9)
    for group in model["groups"]:
        rows = group.get("rows") or []
        if not rows:
            continue
        doc.add_heading(group.get("title", ""), level=2)
        table = doc.add_table(rows=0, cols=2)
        table.style = "Light List Accent 1"
        for row in rows:
            label, shown = (list(row) + ["", ""])[:2]
            cells = table.add_row().cells
            cells[0].text = str(label)
            cells[1].text = str(shown)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
