#!/usr/bin/env python3
"""A made-up household's NeuroNet, for the Neuro Guide's screenshots.

Cam: the manual's pictures are to be made "from sample data" -- never hers.
This fills an EMPTY, throwaway data folder with a believable NeuroNet:
recipes, bills and savings, training sessions, notes, a DVD shelf, photos,
albums, a calendar and a journal. Everything is invented; the pictures and
the music are generated here (the "music" is a few seconds of quiet tone).

It goes through NeuroNet's own save functions (Api.kc_save_data,
kc_save_money, training_save, effects_save, journal_save, fleeting_add, the
notes and photo stores), so what it writes is exactly what the app writes.

    NEURONET_SAMPLE=1 HOME=<temp home> XDG_CONFIG_HOME=... python3 tools/make_sample_data.py

SAFETY: it refuses unless NEURONET_SAMPLE=1 is set, paths.json names the data
folder, that folder is not
the app's own neuronet_data, and the folder holds no photos, music or notes
yet. It never deletes anything.
"""
import datetime as dt
import json
import math
import os
import random
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
sys.argv = sys.argv[:1]

import neuronet  # noqa: E402
import media_shelf  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

TODAY = dt.date.today()
R = random.Random(29092026)
SANS = "/usr/share/fonts/noto/NotoSans-Bold.ttf"
SERIF = "/usr/share/fonts/noto/NotoSerif-Bold.ttf"


def refuse(why):
    sys.exit("make_sample_data: refusing -- " + why)


def iso(d):
    return d.isoformat()


def stamp(days_ago=0, hour=9):
    return dt.datetime.combine(TODAY - dt.timedelta(days=days_ago), dt.time(hour, 12)).isoformat()


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


# ---------------------------------------------------------------- pictures
def landscape(palette, seed, w=1200, h=800):
    """A calm generated landscape: sky, sun, layered hills, sometimes water."""
    r = random.Random(seed)
    sky_top, sky_bottom, sun, hills, water = palette
    im = Image.new("RGB", (w, h))
    px = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        px.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(sky_top, sky_bottom)))
    sx, sy, sr = r.randint(200, w - 200), r.randint(140, 330), r.randint(50, 90)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([sx - sr * 3, sy - sr * 3, sx + sr * 3, sy + sr * 3], fill=sun + (70,))
    im.paste(glow.filter(ImageFilter.GaussianBlur(60)), (0, 0), glow.filter(ImageFilter.GaussianBlur(60)))
    px.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=sun)
    horizon = int(h * (0.62 if water else 0.9))
    for i, col in enumerate(hills):
        base = int(h * (0.45 + 0.1 * i))
        amp, freq, ph = r.randint(30, 80), r.uniform(1.2, 3.2), r.uniform(0, 6)
        pts = [(x, base + amp * math.sin(ph + freq * x / w * math.pi) + 18 * math.sin(x / 37.0 + i)) for x in range(0, w + 10, 10)]
        if water:
            pts = [(x, min(y, horizon)) for x, y in pts]
        px.polygon(pts + [(w, h), (0, h)], fill=col)
    if water:
        for y in range(horizon, h):
            t = (y - horizon) / (h - horizon)
            c = tuple(int(a * (1 - t) + b * t) for a, b in zip(water, tuple(max(0, v - 50) for v in water)))
            px.line([(0, y), (w, y)], fill=c)
        for _ in range(40):
            y = r.randint(horizon + 5, h - 5)
            ww = r.randint(20, 140) * (1 - (y - horizon) / h)
            px.line([(sx - ww, y), (sx + ww, y)], fill=tuple(min(255, v + 30) for v in sun), width=2)
    return im.filter(ImageFilter.GaussianBlur(0.6))


PALETTES = {
    "dawn": ((250, 196, 160), (255, 236, 205), (255, 244, 214), [(173, 140, 150), (122, 98, 118), (74, 62, 86)], None),
    "coast": ((120, 180, 225), (214, 236, 247), (255, 250, 225), [(96, 140, 110), (60, 104, 80)], (58, 126, 170)),
    "forest": ((160, 205, 190), (230, 240, 222), (255, 247, 220), [(96, 150, 104), (60, 112, 72), (34, 76, 48)], None),
    "dusk": ((58, 48, 110), (240, 140, 110), (255, 214, 150), [(110, 70, 110), (70, 44, 80), (38, 26, 52)], None),
    "lake": ((150, 190, 230), (240, 230, 214), (255, 238, 200), [(132, 150, 176), (90, 110, 140)], (84, 120, 160)),
    "autumn": ((230, 180, 120), (250, 226, 180), (255, 240, 200), [(196, 120, 60), (150, 80, 40), (96, 52, 32)], None),
    "night": ((14, 20, 48), (52, 60, 110), (236, 236, 214), [(36, 46, 80), (22, 28, 54)], (30, 40, 76)),
    "meadow": ((170, 214, 240), (235, 246, 240), (255, 252, 230), [(150, 196, 110), (104, 160, 80)], None),
}


def cover(title, sub, colours, w=600, h=600, serif=False, seed=0):
    """Album art / a DVD cover: bold shapes and the title."""
    r = random.Random(seed)
    a, b, ink = colours
    im = Image.new("RGB", (w, h), a)
    px = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        px.line([(0, y), (w, y)], fill=tuple(int(x + (z - x) * t) for x, z in zip(a, b)))
    for _ in range(6):
        cx, cy, rr = r.randint(0, w), r.randint(0, h), r.randint(w // 10, w // 3)
        px.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=ink + (0,), width=r.randint(2, 9))
    f1 = font(SERIF if serif else SANS, w // (9 if len(title) < 14 else 12))
    f2 = font(SANS, w // 22)
    y = h - h // 3
    for line in wrap(title, 16):
        px.text((w // 14, y), line, font=f1, fill=ink)
        y += int(f1.size * 1.15)
    px.text((w // 14, h // 12), sub.upper(), font=f2, fill=ink)
    return im


def wrap(text, n):
    words, out, cur = text.split(), [], ""
    for wd in words:
        if len(cur) + len(wd) + 1 > n and cur:
            out.append(cur)
            cur = wd
        else:
            cur = (cur + " " + wd).strip()
    return out + [cur]


# ------------------------------------------------------------------- main
def main():
    if os.environ.get("NEURONET_SAMPLE") != "1":
        refuse("set NEURONET_SAMPLE=1 to say this is a throwaway NeuroNet")
    # the data folder must be named in paths.json: left to find its own,
    # NeuroNet takes this script's folder for the app's and guesses from there
    if not neuronet._configured_data_dir():
        refuse("name the throwaway data folder in paths.json (\"data\")")
    data = os.path.realpath(neuronet.data_dir())
    if data == os.path.realpath(os.path.join(HERE, "neuronet_data")):
        refuse("that's the app's own data folder (%s)" % data)
    for sub in ("photos", "chords/music", "notes/vault", "journal"):
        p = os.path.join(data, sub)
        if os.path.isdir(p) and any(not n.startswith(".") for n in os.listdir(p)):
            refuse("%s already has things in it -- use an empty data folder" % p)
    print("sample data ->", data)
    api = neuronet.Api()
    work = tempfile.mkdtemp(prefix="nn-sample-")

    # ---- Home + Kitchen: one document (camily.json + cookery.json)
    doc = api.kc_get_data()
    recipes = [
        ("Banana bread", ["Sweet", "Bread"], "8 slices", "Grandma's, with walnuts.",
         ["3 ripe bananas", "1/3 cup melted butter", "3/4 cup brown sugar", "1 egg", "1 tsp vanilla",
          "1 tsp bicarb soda", "1 1/2 cups plain flour", "1/2 cup walnuts"],
         ["Preheat the oven to 175°C and line a loaf tin.", "Mash the bananas; stir in the butter.",
          "Mix in the sugar, egg and vanilla.", "Fold in the bicarb, flour and walnuts.", "Bake 60 minutes."]),
        ("Lemon chicken traybake", ["Chicken"], "4", "One tray, very little washing up.",
         ["8 chicken thighs", "2 lemons", "600 g baby potatoes", "1 red onion", "4 cloves garlic",
          "2 tbsp olive oil", "Fresh thyme"],
         ["Heat the oven to 200°C.", "Halve the potatoes and toss everything in the oil.",
          "Squeeze over one lemon, slice the other on top.", "Roast 45 minutes, turning once."]),
        ("Beef and broccoli stir-fry", ["Beef"], "4", "Weeknight favourite.",
         ["500 g rump steak, sliced", "1 head broccoli", "3 tbsp soy sauce", "1 tbsp oyster sauce",
          "1 tbsp cornflour", "2 cm ginger", "Steamed rice, to serve"],
         ["Toss the beef in cornflour and half the soy.", "Sear in a hot wok; set aside.",
          "Stir-fry the broccoli and ginger 3 minutes.", "Return the beef with the sauces; toss and serve."]),
        ("Everyday sourdough", ["Bread"], "1 loaf", "",
         ["100 g active starter", "375 g water", "500 g bread flour", "10 g salt"],
         ["Mix starter, water and flour; rest 1 hour.", "Add the salt; four sets of stretch and folds.",
          "Shape, then prove overnight in the fridge.", "Bake in a hot Dutch oven: 20 min lid on, 25 off."]),
        ("Anzac biscuits", ["Sweet"], "24", "",
         ["1 cup rolled oats", "1 cup plain flour", "1 cup desiccated coconut", "3/4 cup brown sugar",
          "125 g butter", "2 tbsp golden syrup", "1/2 tsp bicarb soda"],
         ["Heat the oven to 160°C.", "Melt the butter with the syrup; add the bicarb.",
          "Stir into the dry ingredients.", "Roll into balls, flatten and bake 12 minutes."]),
        ("Chicken and corn soup", ["Chicken"], "6", "Good for cold nights.",
         ["2 chicken breasts", "1 L chicken stock", "420 g creamed corn", "2 spring onions",
          "1 egg, beaten", "1 tbsp cornflour"],
         ["Poach the chicken in the stock; shred it.", "Add the corn and bring back to a simmer.",
          "Thicken with the cornflour.", "Swirl in the egg; top with spring onion."]),
    ]
    doc["recipes"] = [{"id": "r%d" % i, "created": stamp(40 - i * 5), "name": n, "tags": t, "source": "",
                       "servings": s, "images": [], "description": d, "ingredients": ing, "steps": st,
                       "notes": ""} for i, (n, t, s, d, ing, st) in enumerate(recipes, 1)]
    doc["shoppingLists"] = [{"id": "l1", "title": "Saturday shop", "created": stamp(1),
                             "recipeNames": ["Banana bread", "Lemon chicken traybake"],
                             "items": ["Bananas", "Walnuts", "Chicken thighs", "2 lemons", "Baby potatoes",
                                       "Broccoli", "Rolled oats", "Golden syrup"]}]
    doc["contacts"] = [
        {"id": "c1", "name": "Nana June", "email": "", "phone": "0400 000 111", "address": "",
         "birthday": iso(TODAY.replace(month=10, day=14)), "notes": "Loves the banana bread.",
         "created": stamp(90), "favourite": True},
        {"id": "c2", "name": "Sam Rivers", "email": "sam@example.com", "phone": "0400 000 222", "address": "",
         "birthday": "", "notes": "Training buddy.", "created": stamp(80), "favourite": True},
        {"id": "c3", "name": "Dr Patel (dentist)", "email": "", "phone": "07 0000 3333", "address": "",
         "birthday": "", "notes": "", "created": stamp(70), "favourite": False},
        {"id": "c4", "name": "Priya Shah", "email": "priya@example.com", "phone": "", "address": "",
         "birthday": iso(TODAY.replace(month=12, day=3)), "notes": "", "created": stamp(60), "favourite": False},
    ]
    ev = [(0, "Gym with Sam", "06:30", "07:30"), (1, "Dentist", "10:00", "10:45"),
          (2, "Coaching: under-12s", "16:00", "17:30"), (4, "Farmers market", "08:00", "10:00"),
          (5, "Nana June for lunch", "12:00", "14:00"), (8, "Car service", "09:00", "11:00")]
    doc["events"] = [{"id": "e%d" % i, "created": stamp(10), "name": n,
                      "date": iso(TODAY + dt.timedelta(days=dd)), "startTime": a, "endTime": b, "notes": "",
                      "repeat": "none", "repeatUntil": "", "stamp": stamp(10)}
                     for i, (dd, n, a, b) in enumerate(ev, 1)]
    # photos: generated landscapes, stored the way "Add photos" stores them
    names = [("dawn", "Morning over the ridge"), ("coast", "Bay walk"), ("forest", "Rainforest track"),
             ("dusk", "Dusk from the balcony"), ("lake", "The lake, still"), ("autumn", "Autumn in the hills"),
             ("night", "Night swim"), ("meadow", "Picnic spot"), ("coast", "Lighthouse point"),
             ("forest", "Creek crossing"), ("dawn", "First light"), ("lake", "Boat shed"),
             ("meadow", "Spring paddock"), ("dusk", "Long weekend"), ("autumn", "Leaf fall"),
             ("coast", "Rock pools")]
    albums = [{"id": "a1", "name": "Holidays", "created": stamp(50)},
              {"id": "a2", "name": "Walks", "created": stamp(45)}]
    photos = []
    for i, (pal, cap) in enumerate(names):
        path = os.path.join(work, "IMG_%04d.jpg" % (2040 + i))
        landscape(PALETTES[pal], i * 7 + 3).save(path, quality=86)
        got = api.photo_store(path)
        if got.get("error"):
            refuse(got["error"])
        photos.append({"id": "p%d" % i, "storedName": got["storedName"], "originalName": got["originalName"],
                       "created": stamp(30 - i), "tags": [pal], "notes": "", "caption": cap,
                       "albumIds": ["a1"] if pal in ("coast", "lake", "night") else ["a2"],
                       "inFrame": i % 3 == 0, "takenDate": iso(TODAY - dt.timedelta(days=200 - i * 11)),
                       "rating": [5, 4, 3, 4, 5][i % 5], "folderId": ""})
    print("kitchen/home:", api.kc_save_data(doc))
    # the photo library is its own file (neuronet.json), saved on its own
    print("photos:", api.photo_save_data({"photos": photos, "albums": albums,
                                          "photoTagList": sorted(PALETTES), "folders": []}))

    # ---- Money
    monday = TODAY - dt.timedelta(days=TODAY.weekday())
    period = monday if ((monday - dt.date(2025, 1, 6)).days // 7) % 2 == 0 else monday - dt.timedelta(days=7)
    money = api.kc_get_money()
    money.update({
        "templates": [
            {"id": "t1", "active": True, "name": "Rent", "amount": 460, "kind": "Bill", "cycle": "Weekly",
             "anchor": "Monday", "category": "Housing", "notes": ""},
            {"id": "t2", "active": True, "name": "Pay", "amount": 2240, "kind": "Income", "cycle": "Fortnightly",
             "anchor": "Thursday", "category": "Other", "notes": "", "seed": iso(period + dt.timedelta(days=3))},
            {"id": "t3", "active": True, "name": "Electricity", "amount": 185, "kind": "Bill", "cycle": "Monthly",
             "anchor": "14", "category": "Utilities", "notes": ""},
            {"id": "t4", "active": True, "name": "Internet", "amount": 79, "kind": "Bill", "cycle": "Monthly",
             "anchor": "3", "category": "Utilities", "notes": ""},
            {"id": "t5", "active": True, "name": "Phone", "amount": 35, "kind": "Bill", "cycle": "Monthly",
             "anchor": "21", "category": "Subscriptions", "notes": ""},
            {"id": "t6", "active": True, "name": "Car insurance", "amount": 96, "kind": "Bill", "cycle": "Monthly",
             "anchor": "9", "category": "Insurance", "notes": ""},
            {"id": "t7", "active": True, "name": "Groceries", "amount": 180, "kind": "Bill", "cycle": "Weekly",
             "anchor": "Saturday", "category": "Food", "notes": ""},
            {"id": "t8", "active": True, "name": "Gym", "amount": 32, "kind": "Bill", "cycle": "Fortnightly",
             "anchor": "Wednesday", "category": "Health", "notes": "", "seed": iso(period + dt.timedelta(days=2))},
            {"id": "t9", "active": True, "name": "Streaming", "amount": 18.99, "kind": "Bill", "cycle": "Monthly",
             "anchor": "27", "category": "Fun", "notes": ""},
        ],
        "oneoffs": [{"id": "o1", "name": "Dentist", "kind": "Bill", "amount": 140,
                     "date": iso(TODAY + dt.timedelta(days=1)), "category": "Health", "notes": ""}],
        "payments": {},
        "goals": [
            {"id": "g1", "name": "Holiday fund", "target": 2500, "payFrequency": "fortnight", "method": "percent",
             "percent": 10, "notes": "Tasmania in March.", "transactions": [
                 {"id": "t%d" % i, "date": iso(TODAY - dt.timedelta(days=14 * (6 - i))), "type": "deposit",
                  "amount": 180, "method": "bank", "note": ""} for i in range(1, 6)]},
            {"id": "g2", "name": "Emergency fund", "target": 5000, "payFrequency": "fortnight", "method": "date",
             "targetDate": iso(TODAY.replace(year=TODAY.year + 1)), "notes": "", "transactions": [
                 {"id": "t1", "date": iso(TODAY - dt.timedelta(days=60)), "type": "deposit", "amount": 1500,
                  "method": "bank", "note": ""},
                 {"id": "t2", "date": iso(TODAY - dt.timedelta(days=20)), "type": "deposit", "amount": 400,
                  "method": "bank", "note": ""}]},
        ],
        "spendingLog": {"periodStart": iso(period), "entries": [
            {"id": "s%d" % i, "date": iso(min(TODAY, period + dt.timedelta(days=d))), "amount": a, "note": n}
            for i, (d, a, n) in enumerate([(0, 6.5, "coffee"), (1, 24, "lunch with Sam"), (1, 12.8, "bakery")], 1)]},
    })
    print("money:", api.kc_save_money(money))

    # ---- Training
    tr = api.training_load()
    ex = lambda text: {"instructions": text, "images": []}  # noqa: E731
    tr["exercises"] = {
        "Push": {"Pushup": ex("Hands under shoulders; body in one line; chest to the floor."),
                 "Overhead Press": ex("Brace, press straight up, finish with the bar over your ears.")},
        "Pull": {"Pull Ups": ex("Full hang to chin over the bar."), "Single Arm Row": ex("Flat back, row to the hip.")},
        "Squat": {"Goblet Squat": ex("Hold the bell at your chest; sit between your heels."),
                  "Walking Lunge": ex("Long step; back knee kisses the floor.")},
        "Hinge": {"Kettlebell Swing": ex("Hips drive the bell; arms are ropes."),
                  "Romanian Deadlift": ex("Soft knees, push the hips back.")},
        "Core": {"Plank": ex("Squeeze everything; breathe."), "Dead Bug": ex("Low back stays down.")},
        "Cardio": {"Skipping": ex("Light on the toes."), "Row (erg)": ex("Legs, body, arms.")},
        "Mobility": {"World's Greatest Stretch": ex("Lunge, elbow to instep, rotate open.")},
    }
    item = lambda n, c, b, s, reps, load="", rest="60s": {"name": n, "category": c, "block": b, "sets": s,  # noqa: E731
                                                           "reps": reps, "load": load, "rest": rest}
    tr["sessions"] = [
        {"id": "s1", "name": "Full body A", "created": stamp(20), "parts": [], "equipment": ["Kettlebell"],
         "tags": ["Strength"], "guideIds": [], "notes": "45 minutes.", "items": [
             item("World's Greatest Stretch", "Mobility", "Warm-up", "1", "5 each side", "", "0"),
             item("Goblet Squat", "Squat", "A", "4", "8", "16 kg"), item("Pushup", "Push", "A", "4", "10"),
             item("Kettlebell Swing", "Hinge", "B", "3", "15", "20 kg"),
             item("Single Arm Row", "Pull", "B", "3", "10 each", "18 kg"), item("Plank", "Core", "C", "3", "40s")]},
        {"id": "s2", "name": "Engine builder", "created": stamp(15), "parts": [], "equipment": ["Rower", "Rope"],
         "tags": ["Conditioning"], "guideIds": [], "notes": "", "items": [
             item("Row (erg)", "Cardio", "A", "5", "500 m", "", "90s"), item("Skipping", "Cardio", "B", "5", "1 min")]},
        {"id": "s3", "name": "Under-12s: games & skills", "created": stamp(9), "parts": [], "equipment": ["Cones"],
         "tags": ["Coaching"], "guideIds": [], "notes": "Keep it moving; lots of praise.", "items": [
             item("Walking Lunge", "Squat", "Warm-up", "2", "10 m"), item("Dead Bug", "Core", "A", "2", "8")]},
        {"id": "s4", "name": "Upper strength", "created": stamp(4), "parts": [], "equipment": ["Barbell"],
         "tags": ["Strength"], "guideIds": [], "notes": "", "items": [
             item("Overhead Press", "Push", "A", "5", "5", "40 kg", "2 min"), item("Pull Ups", "Pull", "A", "5", "5")]},
    ]
    tr["circuits"] = [{"id": "c1", "name": "Ten-minute finisher", "type": "EMOM", "rounds": "10", "timeCap": "10:00",
                       "created": stamp(12), "notes": "", "parts": [], "stations": [
                           {"name": "Kettlebell Swing", "category": "Hinge", "workTime": "", "reps": "12", "load": "20 kg",
                            "rest": "", "partId": None},
                           {"name": "Pushup", "category": "Push", "workTime": "", "reps": "8", "load": "", "rest": "",
                            "partId": None}]}]
    tr["equipment"] = [{"id": "q%d" % i, "name": n, "created": stamp(30)} for i, n in
                       enumerate(["Kettlebell", "Rower", "Rope", "Cones", "Barbell"], 1)]
    print("training:", api.training_save(tr))

    # ---- Notes: a few notes in folders, and Fleeting
    for folder, notes in {"Garden": [("Seedlings", "Tomatoes, basil and beans went in on the weekend.\n\n- [ ] Stake the tomatoes\n- [x] Mulch the beds\n")],
                          "Study": [("Anatomy - the shoulder", "Four rotator cuff muscles: **supraspinatus**, **infraspinatus**, teres minor, subscapularis.\n"),
                                    ("Reading list", "1. *The Body Keeps the Score*\n2. *Atomic Habits*\n3. *Born to Run*\n")],
                          "": [("Ideas", "- A herb planter for the balcony\n- Family recipe book for Nana's birthday\n"),
                               ("Welcome", "Notes are plain Markdown files: they're yours, anywhere.\n")]}.items():
        parent = api.notes_create_folder("", folder) if folder else ""
        if isinstance(parent, dict):
            parent = parent.get("path", "")
        for name, text in notes:
            rel = api.notes_create_note(parent, name)
            if isinstance(rel, dict):
                rel = rel.get("path")
            api.notes_write_note(rel, text)
    for t in ["Call Nana about Sunday lunch", "Book the car service", "Try the lemon traybake with fennel"]:
        api.fleeting_add(t)

    # ---- Stuff: a DVD shelf with covers
    films = [("The Lighthouse Keeper", "2019", "dvd", ((32, 60, 92), (12, 20, 36), (244, 226, 180))),
             ("Paper Moon Harbour", "2014", "dvd", ((222, 146, 92), (120, 48, 40), (255, 240, 220))),
             ("Northern Lights", "2021", "bluray", ((20, 70, 72), (8, 20, 30), (170, 255, 214))),
             ("A Year in the Garden", "2016", "dvd", ((120, 170, 96), (40, 80, 44), (250, 248, 230))),
             ("The Long Road Home", "2008", "dvd", ((140, 120, 96), (60, 44, 36), (250, 236, 206))),
             ("Midnight at the Diner", "1998", "vhs", ((120, 30, 60), (30, 10, 30), (255, 210, 110))),
             ("Tides", "2023", "bluray", ((60, 130, 190), (20, 40, 80), (240, 250, 255))),
             ("Salt & Pepper", "2011", "dvd", ((230, 220, 200), (160, 140, 120), (40, 34, 30)))]
    eff = api.effects_load()
    eff.setdefault("items", [])
    for i, (title, year, kind, cols) in enumerate(films, 1):
        iid = "f%d" % i
        eff["items"].append({"id": iid, "title": title, "type": kind, "year": year, "notes": "",
                             "added": stamp(60 - i), "favourite": i in (1, 3)})
        c = cover(title, {"dvd": "DVD", "bluray": "Blu-ray", "vhs": "VHS"}[kind], cols, 400, 600, serif=i % 2 == 0,
                  seed=i)
        path = os.path.join(work, iid + ".jpg")
        c.save(path, quality=88)
        media_shelf.set_cover_file(neuronet.data_dir(), iid, path)
    print("stuff:", api.effects_save(eff))

    # ---- Music: invented albums, generated art, a few seconds of quiet tone
    mdir, idir = neuronet.music_dir(), neuronet.music_images_dir()
    albums = [("The Tidelines", "Harbour Lights", "2022", ((32, 92, 120), (12, 30, 50), (240, 230, 200)),
               ["Harbour Lights", "Low Tide", "Salt in the Air", "Paper Boats", "The Long Swim"]),
              ("Juniper Vale", "Wildflower Season", "2020", ((200, 150, 180), (90, 60, 100), (255, 250, 240)),
               ["Wildflower", "Kitchen Radio", "Sunday Drive", "Honey", "Slow Morning", "Home Again"]),
              ("Northbound Static", "Signal", "2024", ((30, 30, 36), (90, 40, 60), (120, 255, 190)),
               ["Signal", "Night Bus", "Transmission", "Neon Rain"]),
              ("Mara Quill", "Letters", "2018", ((236, 222, 196), (190, 160, 120), (60, 40, 30)),
               ["Dear You", "Ink", "Postmarked", "The Last Page"])]
    ch = api.music_read_json("chords.json") or {}
    ch.setdefault("tracks", {})
    ch.setdefault("albums", [])
    ch.setdefault("playlists", [])
    added = []
    for ai, (artist, album, year, cols, songs) in enumerate(albums, 1):
        art = "sample_album_%d.jpg" % ai
        cover(album, artist, cols, 600, 600, serif=ai % 2 == 0, seed=ai + 50).save(os.path.join(idir, art), quality=88)
        files = []
        for ti, song in enumerate(songs, 1):
            fn = "%s - %02d. %s.ogg" % (artist, ti, song)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                            "sine=frequency=%d:duration=4" % (220 + 30 * ti), "-af", "volume=0.05",
                            "-metadata", "title=" + song, "-metadata", "artist=" + artist, "-metadata", "album=" + album,
                            os.path.join(mdir, fn)], check=True)
            ch["tracks"][fn] = {"title": song, "artist": artist, "album": album, "art": art,
                                "duration": 180.0 + 17 * ti + 5 * ai, "added": stamp(20 - ai), "plays": R.randint(0, 40)}
            files.append(fn)
            added.append(fn)
        ch["albums"].append({"id": "al%d" % ai, "name": album, "artist": artist, "year": year, "art": art,
                             "notes": "", "files": files, "created": stamp(20 - ai)})
    ch["playlists"].append({"id": "pl1", "name": "Cooking", "art": None, "created": stamp(5),
                            "files": [f for f in added if "Juniper" in f or "Mara" in f][:8]})
    ch["playlists"].append({"id": "pl2", "name": "Training", "art": None, "created": stamp(3),
                            "files": [f for f in added if "Northbound" in f or "Tidelines" in f]})
    print("music:", api.music_write_json("chords.json", ch))

    # ---- Journal
    for d, title, text in [(0, "A good Monday", "Early gym with Sam, then a long walk at lunch. Felt steady all day."),
                           (2, "Garden day", "Put the seedlings in. The basil already smells amazing."),
                           (5, "Nana's recipes", "Started copying Nana's recipes into the Kitchen. The banana bread first.")]:
        api.journal_save({"date": iso(TODAY - dt.timedelta(days=d)), "title": title, "text": text, "photos": []})

    # ---- Code -> IDE: a small project, and a markdown guide to open beside it
    code = os.path.join(neuronet.data_dir(), "code")
    proj = os.path.join(code, "projects", "Garden Planner")
    os.makedirs(proj, exist_ok=True)
    os.makedirs(os.path.join(code, "guides"), exist_ok=True)
    with open(os.path.join(proj, "planner.py"), "w") as f:
        f.write('''"""When to water the vegetable patch."""

BEDS = {"tomatoes": 2, "basil": 1, "lettuce": 1, "beans": 3}  # days between watering


def due(bed, days_since):
    """True when a bed is due for water."""
    return days_since >= BEDS[bed]


for bed, every in BEDS.items():
    print(f"{bed:<9} every {every} day{'s' if every > 1 else ''}")
''')
    with open(os.path.join(proj, "README.md"), "w") as f:
        f.write("# Garden Planner\n\nWhich beds need water today.\n")
    with open(os.path.join(code, "guides", "Python loops.md"), "w") as f:
        f.write("# Loops\n\nA `for` loop walks through anything you can list:\n\n"
                "```python\nfor bed in BEDS:\n    print(bed)\n```\n\n"
                "`.items()` gives each key **and** its value.\n")
    print("code: Garden Planner")
    print("done")


if __name__ == "__main__":
    main()
