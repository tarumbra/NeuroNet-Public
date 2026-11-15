"""Every Fleeting note in one PDF.

Cam (2026-10-02): "I want the ability to be able to export all the fleeting
notes into a pdf. Then i can provide this to you, so you have all the changes
that i require in the one document. It will also fit my work flow. I use the
system, identify bugs then write them into a fleeting note be in with the
desktop or top bar widget."

So the notes come out in queue order, each under its number and when it was
written, the text exactly as typed (line breaks kept, nothing read as
markup), under NeuroNet's letterhead with the Vault's mark. The page is
built here and rendered by guidebook_pdf.html_to_pdf -- Chromium headless,
or the Qt web engine NeuroNet already has -- so there is one PDF engine.
"""
import datetime
import html


def _e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def _when(ts):
    if not ts:
        return ""
    try:
        return datetime.datetime.fromtimestamp(float(ts)).strftime("%-d %B %Y, %-I:%M %p")
    except (TypeError, ValueError, OverflowError, OSError):
        return ""


def build_html(notes, header="", today=None):
    """notes: Api.fleeting_list() -- [{n, text, written}], in queue order.
    header: the shared letterhead (print_header.header_html)."""
    today = today or datetime.date.today()
    count = len(notes)
    rows = []
    for n in notes:
        text = str(n.get("text") or "").strip()
        rows.append(
            '<section class="note">'
            f'<div class="nh"><span class="n">#{_e(n.get("n"))}</span>'
            f'<span class="when">{_e(_when(n.get("written")))}</span></div>'
            + (f'<div class="tx">{_e(text)}</div>' if text else '<div class="tx empty">Empty</div>')
            + "</section>")
    body = "".join(rows) or '<p class="none">There are no fleeting notes.</p>'
    import print_header as ph          # the house style every printout shares (2026-10-05)
    house = ph.HOUSE_CSS
    title_block = ph.title_block_html("Scribe", "Fleeting notes",
                                      [("Notes", str(count)), ("Exported", today.strftime("%-d %B %Y"))],
                                      sub="In queue order")
    foot = ph.footer_html("Fleeting notes", "Scribe")
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Fleeting notes</title>
<style>{house}
  .sum {{ color: #6b6a66; font-size: 9.5pt; margin: 10px 0 14px; }}
  .note {{ border-top: 1px solid #d6d9d3; padding: 10px 0 12px; break-inside: avoid; }}
  .nh {{ display: flex; gap: 12px; align-items: baseline; margin-bottom: 4px; }}
  .n {{ color: #2E6B38; font-weight: 700; font-size: 11.5pt; }}
  .when {{ color: #8a877f; font-size: 9pt; }}
  .tx {{ white-space: pre-wrap; overflow-wrap: anywhere; }}
  .empty, .none {{ color: #8a877f; font-style: italic; }}
</style></head><body>
{header}
{title_block}
{body}
{foot}
</body></html>"""
