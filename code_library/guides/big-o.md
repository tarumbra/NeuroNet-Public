---
title: Big-O in practice
blurb: How cost grows with size, and when it actually matters.
topic: Fundamentals
order: 40
---

Big-O describes how the work grows as the input grows -- not how fast
something is, but how it *scales*.

| Name | Example | 1,000 items | 1,000,000 items |
| --- | --- | --- | --- |
| O(1) | dict lookup | 1 | 1 |
| O(log n) | binary search | ~10 | ~20 |
| O(n) | scan a list | 1,000 | 1,000,000 |
| O(n log n) | sort | ~10,000 | ~20,000,000 |
| O(n²) | compare every pair | 1,000,000 | 1,000,000,000,000 |

## The everyday O(n²) bug

```python run
import time

items = list(range(20_000))
wanted = list(range(0, 40_000, 2))

t = time.perf_counter()
found = [w for w in wanted if w in items]          # `in` on a list: O(n) each
slow = time.perf_counter() - t

t = time.perf_counter()
item_set = set(items)                              # one O(n) pass...
found2 = [w for w in wanted if w in item_set]      # ...then O(1) each
fast = time.perf_counter() - t

assert found == found2
print(f"list: {slow:.3f}s   set: {fast:.4f}s   ({slow / fast:.0f}x faster)")
```

Same answer. A loop with an `in` (or `.includes()`, or `.index()`) on a list
inside it is the most common accidental O(n²) there is.

## When it doesn't matter

For 50 items, anything is fast -- write the clearest code. Big-O matters
when *n* can grow: everything you've ever recorded, every file on a disk,
every photo. Ask "how big can this get?" and design for that.
