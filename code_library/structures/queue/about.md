---
title: Queue (ring buffer)
blurb: First in, first out -- built on a circular array so both ends are O(1).
category: Linear
order: 13
---

## What it is

A line: items join at the back (*enqueue*) and leave from the front
(*dequeue*). First in, first out (FIFO).

## The trap, and the fix

The obvious queue is a list where you append to the end and `pop(0)` from
the front. It works and it's O(n) per dequeue, because every item shifts
left. With a million jobs that's a disaster that only shows up in
production.

A **ring buffer** keeps a fixed array plus a `head` index and a `size`.
The back is at `(head + size) % capacity`. Dequeue just moves `head`
forward; nothing shifts. When the array is full it doubles, unrolling the
ring so the oldest item lands at index 0.

```
capacity 4, head 2:   [ c, d, a, b ]   ->  order is a, b, c, d
                             ^head
```

## Cost of each operation

| Operation | Time |
| --- | --- |
| enqueue | O(1) amortised |
| dequeue | O(1) |
| peek | O(1) |

## In practice

- Python: `collections.deque` is exactly this (as linked blocks), and
  `queue.Queue` adds thread safety.
- JavaScript has no built-in queue; `array.shift()` is O(n). For big queues,
  use something like this.
- Breadth-first search (see Graph) is a queue; depth-first is a stack. That
  single swap changes the whole traversal.
