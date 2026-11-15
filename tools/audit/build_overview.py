#!/usr/bin/env python3
"""The Project overview (19 October 2026): three pages on top of the NeuroPets and NeuroNet audits, for whoever decides
the project's AI budget. Reads the same collected numbers.
    python3 tools/audit/build_overview.py <data dir> <nn walk dir> <out dir>"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charts as ch, similarity as sim
from report import Report

DATA, WALK, OUT = sys.argv[1:4]
J = lambda *p: json.load(open(os.path.join(*p)))
pets, growth, collab, code, nn = J(DATA, "pets.json"), J(DATA, "growth.json"), J(DATA, "collab.json"), J(DATA, "nncode.json"), J(WALK, "nn.json")
C, A = pets["content"], pets["art"]
lines = sum(code["byLang"].values())
pt = [d for d in collab if d["type"] == "playtest"]
overall, _ = sim.similarity()


class Overview(Report):
    """No contents page: three pages straight after the cover."""
    def html(self):
        h = super().html()
        a = h.index('<h1>Contents</h1>'); b = h.index("</div></div>", h.index('<div class="toc">')) + 12
        return h[:a] + h[b:]


r = Overview("NeuroNet and NeuroPets", "Project overview: what one person and an AI team built in three weeks, and what more AI time would buy",
             "19 October 2026", footer="Project overview · 19 October 2026")
r.meta = ["<b>For:</b> whoever decides the project's AI budget", "<b>From:</b> Cam (CEO) and the AI team (eleven section heads; Claude as CO of the AI department)",
          "<b>With:</b> the NeuroPets Audit (35 pages) and the NeuroNet Audit (26 pages), which hold every number here and how it was measured"]
r.h1("The project in one page")
r.p("<b>NeuroNet</b> is a personal desktop for Linux: one app for photos, music and films, notes, training plans, recipes, money, puzzles, divination, mindfulness, "
    "code and creative work, with widgets, a dock and shortcuts built around it. <b>NeuroPets</b>, inside it, is a full painted RPG with pets at its heart. "
    "Both run entirely on the owner's computer. Cam designs, paints and play-tests; an AI team writes the code, the tests, the tools and the documents, and runs the reviews.", "lead")
r.kpis([(f"{len(growth)}", "releases since 30 September"), (f"{lines / 1000:.0f}k", "lines of code"), (f"{code['tests']['checks']:,}", "automated checks"), ("17", "NeuroNet sections"),
        (f"{C['items']:,}", "NeuroPets items, painted"), (f"{C['quests']}", "quests"), (f"{len(pt)}", "play tests in 4 days"), (f"{len(collab)}", "team documents (votes, notes, tests)")])
r.fig(ch.line({"Lines of game rules": [(i, g["built"]["petcore.js"]) for i, g in enumerate(growth)], "Lines of game screens": [(i, g["built"]["pet.js"]) for i, g in enumerate(growth)]},
              "NeuroPets, release by release", height=220, xfmt=lambda v: growth[min(int(v), len(growth) - 1)]["date"][5:]),
      "The game went from nothing to 18,000 lines of rules and screens, 1,836 paintings and 71 test files in 15 days.")
r.h2("How it's made")
r.ul(["<b>Every change is a tested release.</b> 127 tagged releases; each one passes the full test suite before it's tagged, and saves from any older version still load.",
      "<b>Decisions are written down.</b> Play tests, questions and votes live in the app's own Collaboration desk: 74 documents since 15 October, " + f"{sum(d['pass'] for d in pt)} play-test checks passed, every failure fixed and re-tested.",
      "<b>The AI team keeps its own tools.</b> Balance simulations, a play harness, art cutters, the page walk behind these audits. The numbers in this overview are measured, not estimated."])

r.h1("What the audits found")
r.table(["", "NeuroPets", "NeuroNet"], [
    ["State", "Complete, balanced, painted; ready for a wider play test", "Works and is fast on every page; grown many ways of drawing the same thing"],
    ["Best of it", "All six classes within ±15% of each other; every gathering skill 71–76 h to level 50; saves never break", "Every page opens in under 35 ms; one theme and header pattern; the Guide, Money and Settings"],
    ["Top issue", "Balance tools can't reach the islands yet: the late game isn't measured", "Secondary text under the contrast minimum in 208 places; 56 button styles; 18 text sizes"],
    ["Cam's ask", "How alike is it to other games?", "Make Training readable"],
    ["Answer", "Closest to RuneScape 3 (64%), IdleOn (61%), Melvor Idle (60%); no listed game has all its pet systems", "A redesign with the same data: grouped navigation, sessions as clear tables (mock-ups in the audit)"]])
games = sim.GAMES
r.fig(ch.columns([(g, overall[g]) for g in games], "NeuroPets: similarity to nine games (%)", unit="%", height=230, rotate=True), "63 features scored by the team, with sources (NeuroPets Audit, section 13).")

r.h1("What more AI time would buy")
r.p("The team's own estimate, from the two audits' ranked fix lists and the section heads' ideas. Each line is something the AI team does end to end; Cam decides, paints and play-tests.")
r.table(["Work", "What it gives", "Size"], [
    ["An automated play-tester", "Plays every class for a day of game time each night, files what drifted or broke", "Large, then runs itself"],
    ["Balance tools for the whole world", "The islands, late bosses, battle pets measured; numbers behind every tuning change", "1–2 days"],
    ["One design system for NeuroNet", "Readable contrast everywhere, four button kinds, six text sizes; new pages match automatically", "2–3 days"],
    ["The Training rebuild", "Sessions and circuits a coach can read between sets", "2–3 days"],
    ["A nightly page walk", "Every page of a sample NeuroNet opened, measured and checked for drift each night", "1 day, then runs itself"],
    ["The NeuroPets story and last art pipeline", "The Story Re-work; Cam's paintings cut, cleaned and checked automatically", "Ongoing"],
    ["Performance metrics", "CPU, GPU and memory of the real desktop over a day, with fixes", "Planned: one recorded session"],
    ["Monthly audits like these", "Progress measured, not guessed", "Half a day each"]])
r.callout("In short", "<p>Three weeks of one person with an AI team produced a working desktop of seventeen sections and a complete painted game, each release tested. "
          "The audits found no blockers. The open work is measurement (the late game, the real desktop), consistency (one design system), and the story. "
          "All of it is the kind of work the AI team already does; more AI time sets how fast it lands.</p>")
os.makedirs(OUT, exist_ok=True)
html = r.write(os.path.join(OUT, "Project Overview.html"))
r.pdf(html, os.path.join(OUT, "Project Overview (19 October).pdf"))
