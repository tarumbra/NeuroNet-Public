---
title: How Code works
blurb: The four rooms of Code, and how they fit together.
topic: Start here
order: 1
---

Code is a place to **write** programs, **learn** how to write them well, and
**study** programs you've already written.

## The four subsections

- **IDE** -- projects, files, a terminal and a split view. Every project is
  a real folder of real files, so anything you write here runs anywhere.
- **Guides** -- this. Snippets, tutorials and design notes. NeuroNet ships
  some; add as many of your own as you like.
- **Research** -- open a folder of code and mark it up like a code review:
  highlight, leave notes, draw labelled boxes round the parts that matter.
  Your notes never change the code.
- **Data Structures** -- the classic structures, each explained, with a
  complexity table and a working implementation in Python and JavaScript
  you can run, read and change.

## Adding your own

Every guide and data structure has **Edit**, and each list has **New**.
Editing one of NeuroNet's own saves *your* copy -- an update will never
overwrite it, and **Back to NeuroNet's** throws your copy away if you change
your mind. Deleting one of NeuroNet's hides it; **Show hidden** brings it back.

> Your guides, structures and research live in NeuroNet's data folder,
> under `code/library/`, as ordinary markdown and source files.

## Try it

A code block marked to run has a **Run** button. This one prints a greeting:

```python run
name = "Cam"
print(f"Hello, {name}. Code blocks like this one run for real.")
```
