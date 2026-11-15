---
title: Linked list
blurb: Nodes that point to the next node. Cheap to splice, slow to index.
category: Linear
order: 11
---

## What it is

Each item lives in its own *node*, which also holds a reference to the next
node. The list itself only remembers the first node (the *head*) -- and here
the last one too (the *tail*), so appending is cheap.

```
head -> [3] -> [7] -> [1] -> None
```

## Cost of each operation

| Operation | Time | Why |
| --- | --- | --- |
| Add / remove at the head | O(1) | change one reference |
| Append at the tail | O(1) | we keep a tail reference |
| Get by index | O(n) | walk from the head |
| Remove a node you already hold the one before | O(1) | splice it out |
| Search | O(n) | walk |

## The design lesson: invariants

A linked list is a good first place to practise keeping *invariants* -- facts
that must be true after every operation. Here: `size` equals the number of
nodes, `tail` is the last node, and an empty list has both `head` and
`tail` empty. Every method's job is to leave all three true. Most linked
list bugs are a forgotten tail. Write the invariants down, then check them
in your tests (see `_check()`).

## In practice

Real code rarely needs a hand-made linked list: arrays win on speed because
of memory locality. But the idea is everywhere -- the LRU cache in this
library, undo histories, the free lists inside memory allocators, and
`collections.deque` are all built from linked nodes.
