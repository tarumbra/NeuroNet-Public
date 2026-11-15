---
title: Python essentials
blurb: The idioms that make Python read like Python.
topic: Python
level: Beginner
order: 10
---

## Loop over things, not indexes

```python run
names = ["ada", "grace", "linus"]
for i, name in enumerate(names, start=1):     # the position, when you need it
    print(i, name.title())

ages = [36, 85, 54]
for name, age in zip(names, ages):            # two lists side by side
    print(f"{name} is {age}")
```

## Comprehensions: build a list from a list

```python run
nums = range(10)
evens = [n for n in nums if n % 2 == 0]
squares = {n: n * n for n in evens}           # a dict comprehension
print(evens)
print(squares)
```

Keep them to one line of thought. If you need two `for`s and an `if`, a
plain loop is clearer.

## Unpacking

```python run
first, *rest = [1, 2, 3, 4]
x, y = 3, 4
x, y = y, x                                   # swap, no temp variable
print(first, rest, x, y)
```

## Dictionaries without KeyError

```python run
counts = {}
for word in "the cat and the hat".split():
    counts[word] = counts.get(word, 0) + 1    # .get with a default
print(counts)

from collections import Counter, defaultdict
print(Counter("the cat and the hat".split()).most_common(1))
groups = defaultdict(list)
for word in ["apple", "avocado", "banana"]:
    groups[word[0]].append(word)
print(dict(groups))
```

## Files: `with` and `pathlib`

```python
from pathlib import Path

folder = Path.home() / "notes"               # paths join with /
for path in folder.glob("*.md"):
    text = path.read_text(encoding="utf-8")
    print(path.stem, len(text.split()))

with open("log.txt", "a", encoding="utf-8") as f:   # closed even on error
    f.write("done\n")
```

Always pass `encoding="utf-8"` -- the default differs between machines.

## f-strings

```python run
price, qty = 4.5, 3
print(f"{qty} x ${price:.2f} = ${price * qty:,.2f}")
print(f"{'left':<8}|{'right':>8}|")
value = 42
print(f"{value=}")                            # shows the expression too
```
