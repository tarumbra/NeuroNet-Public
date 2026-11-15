---
title: Names that tell the truth
blurb: The cheapest design improvement there is.
topic: Software design
order: 30
---

You read code far more often than you write it, and most of reading is
reading names. A good name removes the need for a comment; a wrong name is
worse than a meaningless one, because it's believed.

## Rules of thumb

- **Say what it is, not how it's stored.** `customers`, not `customer_list`
  or `data`.
- **Functions are verbs, values are nouns.** `load_settings()`, `settings`.
- **Booleans read as questions.** `is_open`, `has_unsaved`, `can_retry`.
- **Include the unit.** `timeout_seconds`, `width_px`, `price_cents`. A lot
  of real crashes were a number in the wrong unit.
- **Length follows scope.** `i` is fine in a three-line loop; a module-level
  value deserves a full name.
- **One word per idea.** If it's `fetch` in one place, don't make it
  `get`, `load` and `retrieve` elsewhere for the same thing.

## Before and after

```python
# before
def proc(d, f=False):
    r = []
    for x in d:
        if x[2] > 0 or f:
            r.append(x)
    return r
```

```python run
# after
def sessions_to_show(sessions, include_empty=False):
    return [s for s in sessions if s["minutes"] > 0 or include_empty]

week = [{"day": "Mon", "minutes": 45}, {"day": "Tue", "minutes": 0}]
print(sessions_to_show(week))
print(sessions_to_show(week, include_empty=True))
```

Nothing about the logic changed. Everything about how quickly you can trust
it did.

## When you can't name it

If you can't find a good name for a function, it's usually doing two
things. Split it, and the names appear.
