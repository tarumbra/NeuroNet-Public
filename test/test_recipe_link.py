"""Kitchen → Add Recipe → From a web link (recipe_link.py), 14 Nov 2026, V30.
No network: addresses are "resolved" by a stand-in, pages are strings.

Run: python3 test/test_recipe_link.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import io  # noqa: E402
import json  # noqa: E402
import sys  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import recipe_link as rl  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def resolver(ip):
    return lambda host, port: [(None, None, None, None, (ip, 0))]


print("\nOnly public web pages\n")
for ip, what in (("127.0.0.1", "this computer"), ("192.168.1.1", "the home router"), ("10.0.0.7", "a LAN address"),
                 ("169.254.169.254", "cloud metadata"), ("::1", "this computer (IPv6)"), ("0.0.0.0", "nowhere")):
    ok("a link to %s is refused" % what, rl.not_public("http://x.example/r", resolve=resolver(ip)) != "")
ok("a public site is fine", rl.not_public("https://www.example.com/r", resolve=resolver("93.184.216.34")) == "")
ok("ftp and file links are refused", rl.not_public("ftp://example.com/") != "" and rl.not_public("file:///etc/passwd") != "")


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Opener:
    def __init__(self, body):
        self.body = body

    def open(self, req, timeout=None):
        return FakeResp(self.body)


real = rl.not_public
rl.not_public = lambda url, resolve=None: ""          # the fetch below needs no DNS
try:
    try:
        rl.fetch("https://big.example/r", opener=Opener(b"x" * (rl.MAX_BYTES + 10)))
        ok("a page over 5 MB is refused", False)
    except ValueError as e:
        ok("a page over 5 MB is refused", "too big" in str(e))
    url, page = rl.fetch("example.com/r", opener=Opener(b"<html>hi</html>"))
    ok("an address without https:// gets it", url == "https://example.com/r" and page == "<html>hi</html>")
finally:
    rl.not_public = real

print("\nReading the recipe\n")
graph = {"@context": "https://schema.org", "@graph": [
    {"@type": "WebPage", "name": "Site"},
    {"@type": ["Recipe"], "name": "Lemon &amp; Herb Chicken", "recipeYield": ["4", "4 servings"],
     "description": "<p>Bright and quick.</p>", "recipeCategory": ["Dinner"],
     "recipeIngredient": ["1 kg chicken thighs", " 2 lemons ", ""],
     "recipeInstructions": [
         {"@type": "HowToSection", "name": "Prep", "itemListElement": [
             {"@type": "HowToStep", "text": "Zest the lemons."}]},
         {"@type": "HowToStep", "text": "Roast at <b>200C</b> for 35 min."}]}]}
page = '<html><script type="application/ld+json">%s</script></html>' % json.dumps(graph)
r = rl.extract(page, "https://www.example.com/lemon-chicken")
ok("the recipe is found inside a @graph", r["name"] == "Lemon & Herb Chicken")
ok("ingredients, trimmed, blanks dropped", r["ingredients"] == ["1 kg chicken thighs", "2 lemons"], r["ingredients"])
ok("steps from sections and plain steps, tags stripped",
   r["steps"] == ["Zest the lemons.", "Roast at 200C for 35 min."], r["steps"])
ok("servings, description and the site's name", r["servings"] == "4" and r["description"] == "Bright and quick."
   and r["source"] == "example.com")
plain = '<script type="application/ld+json">{"@type":"Recipe","name":"Toast","recipeIngredient":["bread"],' \
        '"recipeInstructions":"Toast it.\\nButter it."}</script>'
ok("a method given as one block of text splits into steps",
   rl.extract(plain, "https://t.example/")["steps"] == ["Toast it.", "Butter it."])
for bad, why in (("<html>no data</html>", "no recipe data"),
                 ('<script type="application/ld+json">{"@type":"Recipe","name":"x"}</script>', "no ingredients")):
    try:
        rl.extract(bad, "https://e.example/")
        ok("a page with %s says so" % why, False)
    except ValueError:
        ok("a page with %s says so" % why, True)
ok("broken JSON-LD blocks are skipped, not fatal",
   rl.extract('<script type="application/ld+json">{oops</script>' + plain, "https://t.example/")["name"] == "Toast")

print("\nThe page\n")
src = open(os.path.join(HERE, "..", "ui", "cookery.js"), encoding="utf-8").read()
ok("Add Recipe has the link box (new recipes only)", 'id="rc-link"' in src and "${editing ? \"\" : `<div class=\"cc-row\"" in src)
ok("it fills the form; nothing saves until Save",
   "recipeBuilder = {...recipeBuilder" in src and "renderAddRecipe(page);" in src)
ok("a picture can be pasted in (button, or Ctrl+V outside text boxes)", 'id="rc-paste-photo"' in src
   and "navigator.clipboard.read()" in src and 'page.addEventListener("paste"' in src)
ok("  it goes into Photos first, tagged, and onto the recipe as a placeholder",
   'add(dataUrl, (recipe.name || "Recipe") + " (placeholder)", ["Recipe placeholder"])' in src
   and "placeholder: true" in src and 'class="rc-ph-badge"' in src)
api = open(os.path.join(HERE, "..", "api", "kitchen.py"), encoding="utf-8").read()
ok("the backend reads it through recipe_link (public-only fetch)", "recipe_link.fetch(url)" in api)

print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
