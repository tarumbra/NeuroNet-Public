---
title: Stack
blurb: Last in, first out. Undo, the call stack, matching brackets.
category: Linear
order: 12
---

## What it is

A pile: you can only add to the top (*push*) and take from the top (*pop*).
The last thing in is the first thing out (LIFO).

A dynamic array makes a perfect stack, because its end is the cheap end --
which is why both implementations here just wrap one. That is a design
choice worth noticing: **a stack is an interface, not a layout.** Wrapping
the list behind three methods means callers *can't* reach into the middle,
so the "only the top" rule is enforced by the code, not by discipline.

## Cost of each operation

| Operation | Time |
| --- | --- |
| push | O(1) amortised |
| pop | O(1) |
| peek | O(1) |

## Where you meet it

- **Undo.** Each action is pushed; undo pops the most recent.
- **The call stack.** Each function call pushes a frame; `return` pops it.
  Recursion that goes too deep is a stack overflow -- literally.
- **Parsing.** Matching brackets, evaluating expressions, walking a tree
  depth-first without recursion.

The example in the code checks balanced brackets, a classic interview
question that is really a lesson in choosing the right structure.
