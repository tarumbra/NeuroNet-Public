---
title: LRU cache
blurb: A hash map and a linked list working together. Design by composition.
category: Design in practice
order: 50
---

## What it is

A cache with a fixed capacity that, when full, throws out the
**least recently used** entry. Both reading and writing count as "using".

The requirement is: *get* and *put* in O(1). No single structure does it --
a hash map finds a key in O(1) but has no idea of order; a linked list
keeps order and moves a node in O(1) but can't find one. So you use
**both**:

- a hash map from key to the list node, and
- a doubly linked list in recency order: most recent at the front, least
  recent at the back.

*get* looks the node up in the map and moves it to the front. *put* adds at
the front; if over capacity, it removes the back node and its map entry.

## Cost of each operation

| Operation | Time |
| --- | --- |
| get | O(1) |
| put | O(1) |

## The design lesson: composition

This is the most useful pattern in this whole section. Real requirements
rarely match one textbook structure; they match a *combination*, each part
covering what the other can't. The two must be kept in step (an invariant:
every list node is in the map, and nothing else is), and the class exists to
make that impossible to get wrong from outside.

The **sentinel** nodes at both ends are a second lesson: with a dummy head
and tail, there's never a "but what if it's the first node?" branch. Removing
special cases by changing the data is better than handling them in code.

## In practice

- Python: `functools.lru_cache` for functions, or `OrderedDict` with
  `move_to_end()` -- which is this exact design.
- JavaScript: a `Map` remembers insertion order, so delete-then-set moves
  a key to the end; the JS version shows both.
