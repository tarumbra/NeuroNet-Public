import re, sys
src = open('music/chords.css').read()
text = re.sub(r'/\*.*?\*/', ' ', src, flags=re.S)       # comments out, incl. ones inside selectors

def parse(t, i=0):
    """[(prelude, body_or_children)] -- children for @media, text otherwise."""
    out = []
    while i < len(t):
        j = t.find('{', i)
        if j < 0: break
        prelude = ' '.join(t[i:j].split())
        depth, k = 1, j + 1
        while depth:
            if t[k] == '{': depth += 1
            elif t[k] == '}': depth -= 1
            k += 1
        body = t[j + 1:k - 1]
        if prelude.startswith('@media') or prelude.startswith('@supports'):
            out.append((prelude, parse(body)))
        else:
            out.append((prelude, body))
        i = k
    return out

# \.ccq- is the queue popover's INSIDES -- its now-playing row, its seek
# bar, its controls, its up-next list. "cc-queue" alone matched only the
# popover's own box, so when the popover moved into the bar it arrived
# with its glass panel and none of its contents: unstyled grey rows in a
# cramped column. Caught by looking at it, not by reading this.
BAR = re.compile(r'#ch-top-bar|#cc-mini|\.cc-mini|\.chord-btn|cc-queue|\.ccq-'
                 r'|#ch-menu-toggle|#ch-panel-toggle')
def rescope(sel):
    parts = []
    for p in sel.split(','):
        p = p.strip()
        if not BAR.search(p): continue
        if '#ch-shell' in p: parts.append(p.replace('#ch-shell', '#ss-topbar'))
        else: parts.append('#ss-topbar ' + p if not p.startswith('#ch-top-bar') else '#ss-topbar ' + p)
    return ', '.join(parts)

tokens, rules = {}, []
def walk(items, media=None):
    for prelude, body in items:
        if isinstance(body, list):
            walk(body, prelude); continue
        if prelude.startswith('@'): continue
        # the section's own tokens, wherever they were defined on the shell
        if prelude.strip() in ('#ch-shell',):
            for name, val in re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', body):
                tokens[name] = val.strip()
        sel = rescope(prelude)
        if sel:
            rules.append((media, sel, ' '.join(body.split())))
walk(parse(text))

out = ['''/* ==========================================================================
   The app-wide top bar -- GENERATED from music/chords.css by
   make_topbar_css.py. Re-run it if the bar's music styles change.

   Cam: "make that top bar the default for the entire app ... Think of
   NeuroNet as one complete app with multiple tools."

   The bar moved out of the music section into #ss-topbar, above every tool.
   Its styles all lived in chords.css scoped to #ch-shell, and it used the
   music section's own colour and size tokens, so neither followed it. This
   file re-applies exactly those rules and tokens at the new location. It is
   generated rather than copied by hand so the two cannot drift apart, and
   test_topbar.py checks the bar looks identical in both places.
   ========================================================================== */
''']
out.append('#ss-topbar {\n' + ''.join(f'  {k}: {v};\n' for k, v in tokens.items()) + '}\n')
current = None
for media, sel, body in rules:
    if media != current:
        if current: out.append('}\n')
        if media: out.append(media + ' {\n')
        current = media
    out.append(('  ' if media else '') + f'{sel} {{ {body} }}\n')
if current: out.append('}\n')
open('topbar.css', 'w').write(''.join(out))
print(f"tokens: {len(tokens)} | rules: {len(rules)} ({sum(1 for r in rules if r[0])} inside screen-size blocks)")
