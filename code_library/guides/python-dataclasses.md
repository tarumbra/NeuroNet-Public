---
title: Data classes and type hints
blurb: Say what your data is, once, and let Python write the boilerplate.
topic: Python
level: Intermediate
order: 11
---

A dictionary like `{"name": ..., "reps": ...}` is quick to make and easy to
get wrong: a typo in a key is a silent bug. A **data class** names the
fields once, and you get `__init__`, a readable `repr` and `==` for free.

```python run
from dataclasses import dataclass, field


@dataclass
class Exercise:
    name: str
    sets: int = 3
    reps: int = 10
    tags: list[str] = field(default_factory=list)   # never a shared [] default

    @property
    def volume(self) -> int:
        return self.sets * self.reps


squat = Exercise("Squat", reps=5, tags=["legs"])
print(squat)
print(squat.volume)
print(squat == Exercise("Squat", 3, 5, ["legs"]))
```

## Frozen: values that can't change

```python run
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Point:
    x: float
    y: float


p = Point(1, 2)
q = replace(p, y=5)          # a changed copy; p is untouched
print(p, q)
try:
    p.x = 10
except Exception as e:
    print("can't change it:", type(e).__name__)
```

Frozen objects can be dict keys and set members, and can be shared without
anyone changing them behind your back.

## Type hints

Hints don't change how Python runs; they let your editor and tools like
`mypy` catch mistakes before you do.

```python
def total_volume(exercises: list[Exercise]) -> int:
    return sum(e.volume for e in exercises)

def find(name: str, exercises: list[Exercise]) -> Exercise | None:
    return next((e for e in exercises if e.name == name), None)
```

The `| None` in the return type is the useful part: it tells every caller
"check for nothing".
