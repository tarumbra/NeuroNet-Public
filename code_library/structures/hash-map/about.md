---
title: Hash map
blurb: Key -> value in O(1) on average. Python's dict, JavaScript's Map.
category: Hashing
order: 20
---

## What it is

An array of *buckets*. To store a key, run it through a **hash function**
that turns it into a number, take that number modulo the number of buckets,
and put the (key, value) pair in that bucket. To find it again, hash the key
the same way and look in just that one bucket.

Two keys can land in the same bucket (a *collision*). This implementation
uses **separate chaining**: each bucket is a short list of pairs. When the
average bucket gets too full (the *load factor* passes 0.75), it doubles the
buckets and re-files every pair.

## Cost of each operation

| Operation | Average | Worst |
| --- | --- | --- |
| get / set / delete | O(1) | O(n) -- every key in one bucket |
| iterate | O(n) | O(n) |

## The design lessons

1. **Keys must not change.** A key's hash decides its bucket. Change the key
   after inserting it and it's filed in the wrong place forever -- which is
   why Python refuses lists as dict keys and why you should treat key
   objects as immutable.
2. **Equal things must hash equally.** If you define equality for your own
   class, define the hash from the same fields (`__eq__` and `__hash__`
   together).
3. **Hashing turns search into arithmetic.** Many "make it faster" problems
   are solved by asking "can I look this up by a key instead of searching?"

## In practice

Use the built-ins (`dict`, `set`, `Map`, `Set`). They use open addressing
and many clever tricks. Build this once to understand them.
