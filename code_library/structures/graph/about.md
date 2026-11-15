---
title: Graph
blurb: Things and the connections between them. BFS, DFS and shortest paths.
category: Graphs
order: 40
---

## What it is

A set of *vertices* (things) and *edges* (connections). Roads between
towns, imports between modules, friends, task dependencies -- any time
the relationships matter as much as the things.

This one is stored as an **adjacency list**: for each vertex, a map of its
neighbours to the edge's weight. The alternative, an adjacency *matrix* (a
V×V grid), answers "is there an edge?" in O(1) but always costs V² memory
-- fine for 100 vertices, impossible for a million sparse ones.

## The three algorithms worth knowing by heart

| Algorithm | Uses | Finds | Time |
| --- | --- | --- | --- |
| Breadth-first search | a queue | fewest-edges path, levels | O(V + E) |
| Depth-first search | a stack (or recursion) | reachability, cycles, topological order | O(V + E) |
| Dijkstra | a priority queue (heap) | cheapest path, non-negative weights | O((V + E) log V) |

BFS and DFS are the *same loop* with a different container -- which is the
best demonstration there is that choosing the data structure *is* choosing
the algorithm.

## Topological sort

Order the vertices so every edge points forward: the order to build modules
so each comes after what it imports, or tasks after their prerequisites. If
it can't be done, there's a cycle -- and finding that out is often the point.

## In practice

Python: `graphlib.TopologicalSorter` is in the standard library;
`networkx` for everything else.
