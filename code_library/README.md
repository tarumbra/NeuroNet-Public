# NeuroNet's code library

The built-in half of Code -> Guides and Code -> Data Structures
(code_library.py). Cam's own guides and structures, and his edits of these,
live in his data folder (neuronet_data/code/library/) and win over these by
name, so an update never overwrites his work.

* `guides/<name>.md` -- one guide: front matter (title, blurb, topic, level,
  order), then markdown. A fenced block tagged `python run` or `js run` is
  run by test/test_code_library.py, and has to work.
* `structures/<name>/` -- `about.md` (front matter: title, blurb, category,
  order) and one file per language (`python.py`, `javascript.js`, ...).
  Every implementation checks itself when run, and the test runs them all.
