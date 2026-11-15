---
title: Binary search tree
blurb: Sorted data you can search, insert into and walk in order.
category: Trees
order: 30
---

## What it is

Every node has up to two children, and one rule holds everywhere:
**everything in the left subtree is smaller, everything in the right is
larger.** Searching is then a series of left/right decisions, halving the
problem each step -- binary search, but on a structure you can insert into.

```
        8
      /   \
     3     10
    / \      \
   1   6      14
```

Walking it *in order* (left, node, right) visits the keys sorted.

## Cost of each operation

| Operation | Balanced | Unbalanced (worst) |
| --- | --- | --- |
| search / insert / delete | O(log n) | O(n) |
| min / max | O(log n) | O(n) |
| in-order walk | O(n) | O(n) |

## The design lesson: the worst case is real

Insert 1, 2, 3, 4, 5 in order and every node only has a right child: the
"tree" is a linked list and every operation is O(n). Sorted input is not an
edge case -- it's what you get from a database or a file. Production trees
(red-black, AVL, B-trees in every database) rebalance themselves. When you
choose a structure, ask what its *worst* case is and whether your real data
will trigger it.

## Deleting, the fiddly case

A node with two children is replaced by its *in-order successor* (the
smallest key in its right subtree), which is then deleted from there. Read
`_delete` slowly -- it's a good example of reducing a hard case to an easy
one.
