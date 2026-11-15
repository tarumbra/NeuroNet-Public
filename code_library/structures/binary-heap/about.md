---
title: Binary heap (priority queue)
blurb: Always hands you the smallest item next. Schedulers, Dijkstra, top-k.
category: Trees
order: 31
---

## What it is

A tree with one rule -- **every parent is no bigger than its children** --
stored flat in an array. The children of index *i* are at *2i + 1* and
*2i + 2*; its parent is at *(i − 1) // 2*. No node objects, no pointers:
the shape is implied by the arithmetic.

The smallest item is always at index 0. To add, put the item at the end and
*sift it up* past bigger parents. To remove the smallest, move the last
item to the top and *sift it down* below smaller children.

## Cost of each operation

| Operation | Time |
| --- | --- |
| peek at the smallest | O(1) |
| push | O(log n) |
| pop the smallest | O(log n) |
| build from n items (heapify) | O(n) |

## The design lesson: weaker promises, faster code

A heap is *not* sorted -- it only promises the minimum is on top. Promising
less than a sorted list makes every operation cheaper. When designing an
API, ask what callers actually need; a smaller promise is easier to keep
fast and correct.

## In practice

- Python: `heapq` (functions over a plain list -- the same layout as here).
- JavaScript: no built-in; use this.
- To get the *largest* first, push negated priorities, or flip the
  comparison.
- Tie-breaking: push `(priority, counter, item)` so equal priorities come
  out in insertion order and items never need comparing.
