---
title: Dynamic array
blurb: A list that grows. The structure under Python's list and JavaScript's Array.
category: Linear
order: 10
---

## What it is

A block of memory holding items side by side, plus a count of how many slots
are used. When it fills up it allocates a bigger block (usually double),
copies everything across, and carries on.

Because items sit next to each other, item *i* is at `start + i × size` --
one multiplication, no searching. That is why indexing is O(1).

## Cost of each operation

| Operation | Time | Why |
| --- | --- | --- |
| Get / set by index | O(1) | address arithmetic |
| Append | O(1) amortised | an occasional O(n) copy, spread over many appends |
| Insert / remove at the front or middle | O(n) | everything after it shifts |
| Search for a value | O(n) | has to look at each item |

## The design lesson: amortised cost

Doubling the capacity means a copy of *n* items happens only after *n*
cheap appends, so the average cost per append stays constant. Growing by a
fixed amount (say +10) instead would make appends O(n) on average -- a
small-looking choice with a huge effect. When you design a buffer, a cache
or a queue, ask "what happens when it's full, and how often?"

## Use it when

- You mostly add to the end and read by position.
- You iterate a lot -- items next to each other are cache-friendly, which in
  practice often beats "better" structures on paper.

## Avoid it when

- You insert or remove at the front a lot (use a deque).
- You need to look things up by value (use a hash map or set).
