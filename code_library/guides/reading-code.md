---
title: Reading a codebase
blurb: How to find your way round code -- yours from last year included.
topic: Fundamentals
order: 41
---

Reading code is a skill of its own, and **Research** is built for it.

## A method

1. **Start at the edges.** Find where the program starts (`main`, the
   first script the page loads) and where data comes in and goes out. The
   middle makes sense once you know what flows through it.
2. **Follow one thing all the way through.** Pick a single action -- "what
   happens when I press Save?" -- and trace it from the button to the disk.
   Draw a **box** round each step in Research and number them in the labels.
3. **Find the data.** What are the main records, and where do they live?
   Most of a program is moving and checking its data.
4. **Note the surprises.** Anything that made you go "why?" deserves a
   **note** -- that's usually where the design decision (or the bug) is.
5. **Write the overview last.** A few paragraphs on how it hangs together,
   in your own words. If you can't write it, you haven't found the shape yet.

## Questions to ask of any code

- What would break if I deleted this?
- Where else is this called from?
- What does it assume about its inputs?
- What happens when it fails?
- If I had to explain it in one sentence, what would it be?

## Using Research

Open **Research**, choose a folder, and select some code: highlight it,
write a note on it, or box it with a label. The list on the right shows
every note in the file; **Export** writes the whole study as one markdown
review you can keep in Notes.
