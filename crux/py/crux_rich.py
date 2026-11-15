"""crux.rich — turning pasted website HTML into something safe to print.

MOVED, NOT REWRITTEN. This allowlist was attacked with 22 XSS vectors in
Cheffo and the output parsed with a real HTML parser rather than pattern-
matched, because a string can contain the text `onclick=` without that
being an attribute. Nothing executable survived any of them.

THE PROPERTY THAT MAKES A REGEX SANITISER DEFENSIBLE HERE: attributes are
dropped UNCONDITIONALLY. It never tries to filter them, which is where
regex sanitisers normally fail. If anyone ever adds "but we should keep
href" or "let's preserve style", this needs a real parser instead.

AND THE BUG IT CARRIES A FIX FOR. Cooks write "Simmer <do not boil> for
20 minutes"; coaches write "Hold <no lockout> for 3 seconds". A blanket
tag-stripper reads those as a tag named `do`/`no` with attributes and
throws the words away — the printed page read "Simmer  for 20 minutes",
losing a safety instruction with no indication anything had gone. So a
tag whose name is not a real HTML element is escaped and KEPT.
"""

import re

RICH_ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "br", "p",
                     "ul", "ol", "li", "div", "span",
                     "h1", "h2", "h3", "h4"}

# Real HTML element names that are NOT on the allowlist. These get
# unwrapped (markup dropped, inner text kept) the way they always were.
# Anything that looks like a tag but isn't in either set is prose in
# angle brackets — see the note in _rich's keep() for why that
# distinction has to exist.
HTML_ELEMENT_NAMES = {
    "a", "abbr", "address", "area", "article", "aside", "audio", "base",
    "bdi", "bdo", "blockquote", "body", "button", "canvas", "caption",
    "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del",
    "details", "dfn", "dialog", "dl", "dt", "embed", "fieldset",
    "figcaption", "figure", "font", "footer", "form", "h5", "h6", "head",
    "header", "hgroup", "hr", "html", "iframe", "img", "input", "ins",
    "kbd", "label", "legend", "link", "main", "map", "mark", "menu",
    "meta", "meter", "nav", "noscript", "object", "optgroup", "option",
    "output", "param", "picture", "pre", "progress", "q", "rp", "rt",
    "ruby", "s", "samp", "script", "section", "select", "slot", "small",
    "source", "style", "sub", "summary", "sup", "svg", "table", "tbody",
    "td", "template", "textarea", "tfoot", "th", "thead", "time",
    "title", "tr", "track", "var", "video", "wbr", "center", "strike",
    "big", "tt", "marquee", "blink", "frame", "frameset", "noframes",
    "acronym", "applet", "basefont", "dir", "isindex", "keygen", "nobr",
    "plaintext", "spacer", "xmp",
}


def rich(html):
    """v4 — Description and Notes are rich text now (Cam: "have rich
    text formatting text boxes when adding a recipe"), so they must
    NOT be run through he() the way every other field still is —
    escaping them would print visible "<b>" tags on the page instead
    of bold text.

    They still can't be trusted raw: the value originates from
    whatever Cam pasted off a website. This mirrors the JS-side
    allowlist rather than assuming the front end already cleaned it,
    so a recipe file edited by hand, restored from an old backup, or
    written by an earlier build can never inject a <script> into a
    printed document. Disallowed tags are stripped but their TEXT is
    kept, so nothing Cam actually wrote is ever lost.
    """
    if not html:
        return ""
    text = str(html)
    # drop whole dangerous elements, contents and all
    text = re.sub(r"(?is)<(script|style|iframe|object|embed)\b.*?</\1\s*>",
                  "", text)
    text = re.sub(r"(?is)<(script|style|iframe|object|embed|link|meta)\b[^>]*/?>",
                  "", text)

    def keep(m):
        closing, name, rest = m.group(1), m.group(2).lower(), m.group(3)
        if name in RICH_ALLOWED_TAGS:
            selfclose = "/" if (name == "br" or rest.strip().endswith("/")) else ""
            return f"<{closing}{name}{selfclose}>"  # attributes always dropped
        if name in HTML_ELEMENT_NAMES:
            return ""          # real markup we don't want: unwrap it
        # BUG FIX — not markup at all, just prose in angle brackets.
        # Cooks write "Simmer <do not boil> for 20 minutes" and
        # "Oven <fan forced> 160C", and the old code treated those as
        # a tag named "do"/"fan" with attributes, so the words inside
        # the brackets were thrown away: the printed page read
        # "Simmer  for 20 minutes". A safety instruction silently
        # vanishing off a recipe is the worst kind of bug for a
        # cooking app. Anything whose name isn't a real HTML element
        # is now escaped and KEPT, so it prints as Cam wrote it.
        return he(m.group(0))

    return re.sub(r"(?s)<(/?)([A-Za-z][A-Za-z0-9]*)([^>]*)>", keep, text)



def he(s):
    return (str(s or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))



def strip_html(s):
    """Rich text down to plain text, for the markdown and PDF exports.

    Only REAL html elements are stripped. A blanket <[^>]+> would take
    "Simmer <do not boil> for 20 minutes" down to "Simmer  for 20
    minutes" — the same text-loss _rich's keep() guards against, and
    every bit as bad in an exported file as on a printed page. Caught
    by a test rather than by reading the code.

    Entities are decoded last, so "&amp;" arrives in a plain-text file
    as "&" rather than as markup.
    """
    import html as _html
    text = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", "", str(s or ""))
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|ul|ol)\s*>", "\n", text)

    def drop(m):
        name = m.group(1).lower()
        if name in RICH_ALLOWED_TAGS or name in HTML_ELEMENT_NAMES:
            return ""
        return m.group(0)      # prose in angle brackets — keep it

    text = re.sub(r"</?([A-Za-z][A-Za-z0-9]*)[^>]*>", drop, text)
    text = _html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


