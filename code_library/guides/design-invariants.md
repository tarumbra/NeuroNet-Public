---
title: Make wrong states impossible
blurb: Design data so the bugs can't be written down.
topic: Software design
order: 32
---

Most bugs are data in a state that "can't happen". The best fix isn't
checking for it everywhere -- it's shaping the data so it *can't be
represented*.

## Two booleans that can't both be true

```python
# Four combinations, but only three make sense. Which code handles
# is_loading=True, has_error=True?
class Request:
    is_loading: bool
    has_error: bool
    data: dict | None
```

```python run
from enum import Enum

class Status(Enum):
    LOADING = "loading"
    FAILED = "failed"
    READY = "ready"

def describe(status, data=None):
    match status:
        case Status.LOADING: return "Loading..."
        case Status.FAILED: return "Couldn't load it."
        case Status.READY: return f"{len(data)} items"

print(describe(Status.LOADING))
print(describe(Status.READY, data=[1, 2, 3]))
```

One field with three values: exactly the three states that exist.

## Parse, don't validate

Check input **once, at the edge**, and turn it into a type that can only
hold good values. After that, the rest of the program never has to wonder.

```python run
from dataclasses import dataclass

@dataclass(frozen=True)
class Email:
    address: str

    def __post_init__(self):
        if "@" not in self.address or self.address.startswith("@"):
            raise ValueError(f"not an email address: {self.address!r}")

def send_welcome(to: Email):          # can't be handed a bad address
    print("sending to", to.address)

send_welcome(Email("cam@example.com"))
try:
    Email("nope")
except ValueError as e:
    print(e)
```

## Invariants

An **invariant** is a fact that's always true about your data: "the
balance equals the sum of the transactions", "the tail is the last node".
Write them down. Keep the data that must agree *inside one class*, change it
only through methods that keep the invariant, and check it in tests. The
Linked list and LRU cache in Data Structures both do this.
