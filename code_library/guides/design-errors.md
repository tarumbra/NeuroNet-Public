---
title: Errors that help
blurb: Fail loudly, early, and with a message a person can act on.
topic: Software design
order: 33
---

## Fail early

The further an error travels from its cause, the harder it is to find. A
bad value caught when it enters the program points straight at the problem;
the same value caught three modules later points at nothing.

## Never swallow an error silently

```python
try:
    save(settings)
except Exception:
    pass            # the save failed, and nobody will ever know
```

If you catch it, do something: retry, use a sensible fallback *and log it*,
or tell the person. "Don't crash" is not the same as "work".

## Catch what you expect, where you can handle it

```python run
import json

def load_settings(text):
    """Settings from JSON text; the defaults if it's damaged."""
    defaults = {"theme": "dark", "volume": 50}
    try:
        loaded = json.loads(text)
    except json.JSONDecodeError as e:          # the error we expect -- not all of them
        print(f"settings damaged ({e.msg} at line {e.lineno}); using defaults")
        return defaults
    return {**defaults, **loaded}

print(load_settings('{"volume": 80}'))
print(load_settings('{"volume": 80'))
```

`except Exception` would also have hidden a typo in the code.

## Messages for people

A good error message says **what happened, why, and what to do**:

- *Bad:* `Error 13`
- *Better:* `PermissionError: /mnt/data`
- *Good:* `Can't save to /mnt/data -- the drive is read-only. Choose another
  folder in Settings -> Data folder.`

## Errors are part of the interface

Decide what a function does when it can't do its job, and say so -- raise,
return `None`, or return a result object -- then be consistent. NeuroNet's
own back end returns `{"error": "..."}` from every call, so the interface
has exactly one shape to handle.
