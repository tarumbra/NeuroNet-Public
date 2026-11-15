---
title: Union-find (disjoint sets)
blurb: Which group is this in? Merging groups in near-constant time.
category: Graphs
order: 41
---

## What it is

Keeps track of items split into groups, and answers two questions fast:
**which group is x in** (*find*) and **merge x's group with y's** (*union*).

Each group is a little tree; its root is the group's name. *find* walks up
to the root. Two small tricks make it astonishingly fast:

- **Path compression** -- after a find, point every node on the way
  straight at the root, so the next find is one step.
- **Union by size** -- hang the smaller tree under the bigger one, so trees
  stay shallow.

## Cost of each operation

| Operation | Time |
| --- | --- |
| find | O(α(n)) -- effectively constant |
| union | O(α(n)) |
| connected? | O(α(n)) |

α is the inverse Ackermann function: below 5 for any n that fits in the
universe.

## The design lesson: two cheap ideas beat one clever one

Neither trick alone gets you there; together they're near-perfect. Small,
independent improvements that compose are often worth more than one big
clever redesign -- and they're easier to test, because each can be checked
on its own.

## Where you meet it

Kruskal's minimum spanning tree, counting islands in a grid, "are these two
accounts the same person?", detecting a cycle as you add edges.
