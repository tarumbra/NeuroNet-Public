# NeuroPets screens, in parts

`ui/pet/pet.js` (every page of the game) is **built** from these files, joined in name order -- the same as the rules
(`ui/pet/core/`, built into `petcore.js`). One function wraps every page: it opens in `00-…` and closes in `26-…`, so a
part on its own isn't a whole script; only the joined file is.

- **Edit a part here, never `pet.js`.** Then run `python3 tools/build_screens.py`, then the tests.
- `test/test_pet_content.js` fails if `pet.js` isn't exactly its parts joined (`python3 tools/build_screens.py --check`).
- A new page goes in the part for its place in the game, or a new numbered part before `26-developer-tools-and-the-api.js`
  (which closes the wrapper and lists what the shell can call).
- Many tests read `pet.js`'s text; they read the built file, so they don't care which part a line is in.
