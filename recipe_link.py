"""Kitchen → Add Recipe → "From a web link" (14 Nov 2026, team vote V30).

Brought across from Cam's Collective's Cookery when it was retired: give it a
recipe page's address and the recipe comes back ready to check and save. Most
recipe sites embed the recipe as schema.org JSON-LD for search engines; that
is what is read, never the page's own layout.

SAFE BY CONSTRUCTION (the v286 security audit's rules, kept):
- only public web pages: an address (or any redirect) that resolves to this
  computer, the home network, link-local/cloud-metadata or reserved ranges is
  refused, so a link can't make NeuroNet poke the router or a local service;
- only http and https, every redirect checked again;
- at most 5 MB read, so a page can't run NeuroNet out of memory;
- the page's text is only ever data: tags are stripped, entities decoded, and
  the Kitchen escapes everything it shows, as it does for typed recipes.
"""
import html as html_mod
import ipaddress
import json
import re
import socket
import urllib.parse
import urllib.request

MAX_BYTES = 5_000_000
_JSONLD = re.compile(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                     re.DOTALL | re.IGNORECASE)


def not_public(url, resolve=None):
    """'' when url is a public http(s) page, else the reason it isn't."""
    resolve = resolve or socket.getaddrinfo
    try:
        parts = urllib.parse.urlsplit(url)
    except ValueError:
        return "That isn't a web address."
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return "Only web pages (http or https) can be read."
    try:
        infos = resolve(parts.hostname, parts.port or None)
    except OSError as e:
        return "Couldn't reach that page (%s)." % e
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0].split("%")[0])
        except ValueError:
            return "That address can't be checked."
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                or ip.is_multicast or ip.is_unspecified):
            return "Recipes can only come from public websites."
    return ""


class _PublicRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        bad = not_public(newurl)
        if bad:
            raise ValueError(bad)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, opener=None):
    """The page's text, or raises ValueError with a sentence for Cam."""
    url = (url or "").strip()
    if not re.match(r"(?i)^https?://", url):
        url = "https://" + url
    bad = not_public(url)
    if bad:
        raise ValueError(bad)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) NeuroNet-Kitchen/1.0 (personal recipe book)"})
    opener = opener or urllib.request.build_opener(_PublicRedirects)
    try:
        with opener.open(req, timeout=15) as resp:
            raw = resp.read(MAX_BYTES + 1)
    except ValueError:
        raise
    except Exception as e:                                        # noqa: BLE001
        raise ValueError("Couldn't reach that page (%s)." % e)
    if len(raw) > MAX_BYTES:
        raise ValueError("That page is too big to be a recipe.")
    return url, raw.decode("utf-8", errors="replace")


def _clean(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html_mod.unescape(str(text)))).strip()


def _recipe_node(node):
    if isinstance(node, dict):
        t = node.get("@type", "")
        if any(str(x).lower() == "recipe" for x in (t if isinstance(t, list) else [t])):
            return node
        for v in node.values():
            hit = _recipe_node(v)
            if hit:
                return hit
    elif isinstance(node, list):
        for v in node:
            hit = _recipe_node(v)
            if hit:
                return hit
    return None


def extract(page, url):
    """A NeuroNet recipe draft from a page's JSON-LD, or ValueError."""
    node = None
    for block in _JSONLD.findall(page or ""):
        try:
            node = _recipe_node(json.loads(block.strip()))
        except json.JSONDecodeError:
            continue
        if node:
            break
    if not node:
        raise ValueError("That page has no recipe NeuroNet can read. You can still paste it in by hand.")
    ingredients = [_clean(i) for i in (node.get("recipeIngredient") or []) if _clean(i)]
    steps, raw = [], node.get("recipeInstructions") or []
    if isinstance(raw, str):
        steps = [s.strip() for s in re.split(r"\n+|(?<=\.)\s{2,}", html_mod.unescape(re.sub(r"<[^>]+>", "\n", raw))) if s.strip()]
    else:
        for item in raw if isinstance(raw, list) else [raw]:
            if isinstance(item, dict) and str(item.get("@type", "")).lower() == "howtosection":
                subs = item.get("itemListElement") or []
            else:
                subs = [item]
            for sub in subs:
                txt = _clean(sub.get("text", "") if isinstance(sub, dict) else sub)
                if txt:
                    steps.append(txt)
    if not ingredients or not steps:
        raise ValueError("That page's recipe is missing its ingredients or method. You can still paste it in by hand.")
    servings = node.get("recipeYield", "")
    if isinstance(servings, list):
        servings = servings[0] if servings else ""
    cat = node.get("recipeCategory", "")
    if isinstance(cat, list):
        cat = cat[0] if cat else ""
    host = re.sub(r"^www\.", "", urllib.parse.urlsplit(url).hostname or "")
    return {"name": _clean(node.get("name") or "Imported recipe")[:200],
            "source": host, "servings": _clean(servings)[:40],
            "description": _clean(node.get("description") or "")[:2000],
            "ingredients": [i[:500] for i in ingredients[:200]],
            "steps": [s[:3000] for s in steps[:200]],
            "category": _clean(cat)[:60]}
