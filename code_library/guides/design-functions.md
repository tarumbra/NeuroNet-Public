---
title: Small functions, pure core
blurb: Separate deciding from doing, and both get easier.
topic: Software design
order: 31
---

## One job each

A function should do one thing you can describe in a sentence without
"and". Short functions are easier to name, to test and to reuse -- but the
real test is *one level of abstraction*: a function that talks about
"invoices" shouldn't also be fiddling with string padding.

## Pure core, imperative shell

A **pure** function only computes: same inputs, same output, and it touches
nothing outside itself -- no files, no clock, no network, no printing. Pure
code is trivially testable and can't surprise you.

The trick is to push all the *doing* (reading files, the current time,
saving) to the outside, and keep the *deciding* in the middle, pure:

```python run
from datetime import date

# The core: pure. Easy to test with any date you like.
def streak(days_trained, today):
    """How many days in a row, ending today or yesterday."""
    trained = set(days_trained)
    day = today if today in trained else date.fromordinal(today.toordinal() - 1)
    count = 0
    while day in trained:
        count += 1
        day = date.fromordinal(day.toordinal() - 1)
    return count

# The shell: does the I/O, then hands plain values to the core.
def main():
    # (really this would read a file and call date.today())
    log = [date(2026, 9, 28), date(2026, 9, 29), date(2026, 9, 30)]
    print("streak:", streak(log, today=date(2026, 10, 1)))

main()
assert streak([], date(2026, 1, 1)) == 0
assert streak([date(2026, 1, 1)], date(2026, 1, 1)) == 1
```

Notice `today` is a *parameter*. A function that calls `date.today()`
inside can only be tested on today. Passing the clock in is the single most
useful testing habit there is.

## Signs a function wants splitting

- It has a comment heading each section ("# validate", "# save").
- It takes a boolean that switches between two behaviours.
- You have to scroll to see it all.
- Its test needs a lot of setup.
