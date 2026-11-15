---
title: Writing your own guides
blurb: The markdown a guide understands, and how to make a snippet runnable.
topic: Start here
order: 2
---

A guide is markdown. Click **New guide**, fill in the title, a one-line
blurb and a topic (guides are grouped by topic), and write.

## What you can use

| You type | You get |
| --- | --- |
| `# Heading`, `## Smaller` | headings |
| `**bold**`, `*italic*` | **bold**, *italic* |
| `` `code` `` | `code` |
| `- item` or `1. item` | lists |
| `> text` | a callout |
| `[words](https://...)` | a link (shown, not followed) |
| a line of `---` | a rule |
| a table like this one | a table |

## Code blocks

Fence code with three backticks and name the language, so it's coloured:

````
```python
for n in range(3):
    print(n)
```
````

Add the word `run` after the language -- `python run` or `js run` -- and the
block gets a **Run** button. It runs in a fresh, empty folder, so it can't
touch anything, and it's stopped after 15 seconds.

```js run
const squares = [1, 2, 3].map((n) => n * n);
console.log("squares:", squares.join(", "));
```

## Good guide habits

- **One idea per guide.** "Python list comprehensions", not "Python".
- **Show the smallest example that works**, then a real one.
- **Write the why.** The syntax is a search away; the reason you'd choose it
  is what you'll forget.
