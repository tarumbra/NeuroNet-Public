---
title: Tests as a specification
blurb: A test is a promise about behaviour, written in code.
topic: Software design
order: 34
---

A good test reads like a sentence about what the code promises: "an empty
cart costs nothing", "a repeated word isn't counted twice". When it fails,
it tells you *which promise* broke.

## The shape: arrange, act, assert

```python run
def apply_discount(price_cents, percent):
    if not 0 <= percent <= 100:
        raise ValueError("percent must be 0-100")
    return round(price_cents * (100 - percent) / 100)

# arrange the inputs, act once, assert on the result
def test_ten_percent_off():
    assert apply_discount(2000, 10) == 1800

def test_no_discount_changes_nothing():
    assert apply_discount(999, 0) == 999

def test_rejects_impossible_percent():
    try:
        apply_discount(100, 120)
    except ValueError:
        return
    raise AssertionError("expected ValueError")

for test in (test_ten_percent_off, test_no_discount_changes_nothing, test_rejects_impossible_percent):
    test()
    print("ok", test.__name__)
```

(In a real project, `pytest` finds and runs `test_*` functions for you.)

## What to test

- **The edges.** Empty, one, many. Zero, negative, huge. The first and last.
- **The bug you just fixed.** Write the failing test first, then fix it --
  then it can never quietly come back.
- **Behaviour, not implementation.** Test what a function returns, not
  which helpers it calls, so you can rewrite the inside freely.

## Tests make change safe

The real value of tests isn't catching bugs today; it's letting you change
code next year without fear. Code without tests tends to get *added to*
rather than *improved*, because nobody dares touch it.

Every structure in Data Structures checks itself when you press **Run** --
open one and read the checks at the bottom.
