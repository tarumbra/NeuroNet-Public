---
title: Trie (prefix tree)
blurb: Words stored letter by letter. Autocomplete and prefix search.
category: Trees
order: 32
---

## What it is

A tree where each edge is one character. A word is a path from the root;
a flag on the last node marks "a word ends here". Words that share a
beginning share nodes:

```
(root) - c - a - t*
               \ r*
          \ o - w*
```

holds *cat*, *car* and *cow*.

## Cost of each operation

*m* is the length of the word or prefix -- the size of the dictionary
doesn't appear at all.

| Operation | Time |
| --- | --- |
| insert | O(m) |
| contains | O(m) |
| starts with prefix | O(m) |
| all words with a prefix | O(m + size of the answer) |

## The design lesson: shape the data like the question

A hash set answers "is *cart* a word?" just as fast. What it can't do is
"which words start with *ca*?" without checking every word. The trie
answers that by *construction*: the prefix is a place in the tree, and the
answer is everything below it. When a question is slow, the fix is often
not a faster algorithm but data organised the way the question is asked.

## In practice

Autocomplete, spell checkers, IP routing tables (a trie over bits), and the
search box in NeuroNet's own menus would all suit one. Each node's children
here are a dict/Map; a fixed array of 26 is faster for lowercase English
but wastes memory for anything else.
