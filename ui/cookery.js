/* ==========================================================================
   COOKERY — recipes, menus, shopping lists, recipe books, calculators
   ==========================================================================
   Cam: "i would like to combine cheffo and merge into the hearth app...
   This way we remove one extra app and combine in."

   This is Cheffo's own UI, ported rather than rewritten. The scaling
   maths, the unit tables, the rich-text handling, the recipe books and
   the kitchen timer were all correct and tested where they came from;
   merging two apps is a reason to move code, never a reason to re-derive
   it.

   WHY IT ALL LIVES INSIDE ONE IIFE. Cheffo and Hearth independently
   declared `esc`, `escA`, `openDlg`, `promptText`, `newId`, `data` and
   `render` at the top level. Two top-level `const`s of the same name in
   one page is a SyntaxError, and the app would not start at all. Rather
   than rename hundreds of call sites, everything here gets its own
   scope, and the handful of things that must genuinely be SHARED come
   through CP.shared (see the bridge in app.js). The most important of
   those is `data`: one library file, one in-memory copy.

   ITS OWN LITTLE SHELL. Cheffo browsed recipes in a split pane. Rather
   than rebuild that against Hearth's layout, the cookery pages render
   #cc-main-pane and #cc-split-pane inside Hearth's main area, so the
   split-pane code carried over unchanged too.
   ========================================================================== */
"use strict";

(function () {
  /* The KITCHEN's own shared object, not the host's: CP.shared hands out the
     photo library's document, and the Kitchen works on KinCrux's (recipes,
     menus, shopping lists, books). See window.CK in app.js. */
  const S = window.CK.shared;

  /* Local copies, scoped to this file. Identical in behaviour to
     Hearth's own — duplicated deliberately so that neither file has to
     reach into the other for something this small. */
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escA = (s) => esc(s).replace(/"/g, "&quot;");
  function newId() {
    return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }
  function safeFilename(name, ext) {
    const cleaned = String(name || "Untitled").replace(/[\\/:*?"<>|]/g, "-").trim();
    return `${cleaned || "Untitled"}.${ext}`;
  }

  /* ============================================================================
     DATA
     ============================================================================ */

  /* ============================================================================
     RECIPES
     ============================================================================ */
  function newRecipeDraft() {
    return {name: "", tags: [], source: "", servings: "", images: [],
      description: "", ingredients: [""], steps: [""], notes: ""};
  }

  let recipeBuilder = newRecipeDraft();
  let recipeBuilderEditingId = null;

  /** v4 — Cam: "have rich text formatting text boxes when adding a
      recipe."

      Applied to Description and Notes only, deliberately NOT to
      ingredients or steps. Those two are real structured data, not
      just display text: the recipe scaler parses quantities straight
      out of an ingredient line ("1 1/2 cups flour"), the shopping list
      copies them verbatim, and search reads them - all of which break
      the moment a line becomes "<b>1 1/2</b> cups flour". Description
      and Notes are purely display, so formatting there is free of that
      risk, and paste-splitting (above) is what actually solves the
      line-by-line slowness Cam was hitting.

      Paste is sanitised through a real allowlist rather than dropped
      in raw: website HTML carries scripts, styles, classes and inline
      colours that would otherwise be pasted straight into Cam's own
      recipe file and then rendered back out. Only genuinely useful
      formatting tags survive; everything else is unwrapped to its own
      text, so no content is ever lost - only its markup. */
  const RICH_ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "BR", "P",
    "UL", "OL", "LI", "DIV", "SPAN", "H1", "H2", "H3", "H4"]);

  function sanitizeRichHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(html || "");
    tmp.querySelectorAll("script, style, iframe, object, embed, link, meta")
      .forEach((el) => el.remove());
    tmp.querySelectorAll("*").forEach((el) => {
      if (!RICH_ALLOWED.has(el.tagName)) {
        el.replaceWith(...el.childNodes);   // keep the text, drop the tag
        return;
      }
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
    });
    return tmp.innerHTML.trim();
  }

  /** Plain text out of a rich value — for search, which should match on
      what Cam can actually see, not on the markup around it. */
  function richToText(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(html || "");
    return (tmp.textContent || "").trim();
  }

  function richBoxHtml(id, value) {
    return `
      <div class="rich-box" style="margin-bottom:14px">
        <div class="rich-toolbar">
          <button type="button" data-rich="${id}" data-cmd="bold"
                  title="Bold"><b>B</b></button>
          <button type="button" data-rich="${id}" data-cmd="italic"
                  title="Italic"><i>I</i></button>
          <button type="button" data-rich="${id}" data-cmd="underline"
                  title="Underline"><u>U</u></button>
          <button type="button" data-rich="${id}" data-cmd="insertUnorderedList"
                  title="Bulleted list">&#8226;</button>
          <button type="button" data-rich="${id}" data-cmd="removeFormat"
                  title="Clear formatting">&#10005;</button>
        </div>
        <div class="rich-input input" id="${id}" contenteditable="true"
             spellcheck="true">${sanitizeRichHtml(value)}</div>
      </div>`;
  }

  function wireRichBox(page, id, onChange) {
    const el = page.querySelector(`#${id}`);
    if (!el) return;
    el.addEventListener("input", () => onChange(sanitizeRichHtml(el.innerHTML)));
    el.addEventListener("paste", (e) => {
      const cd = e.clipboardData || window.clipboardData;
      if (!cd) return;
      e.preventDefault();
      const html = cd.getData("text/html");
      const clean = html ? sanitizeRichHtml(html)
        : esc(cd.getData("text")).replace(/\n/g, "<br>");
      document.execCommand("insertHTML", false, clean);
      onChange(sanitizeRichHtml(el.innerHTML));
    });
    page.querySelectorAll(`[data-rich="${id}"]`).forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();     // keep the caret/selection in the box
        el.focus();
        document.execCommand(btn.dataset.cmd, false, null);
        onChange(sanitizeRichHtml(el.innerHTML));
      });
    });
  }

  /** v4 — turns a pasted block into clean, separate lines.

      Recipe sites are messy in specific, predictable ways, and each
      rule below exists for a real case rather than being defensive
      padding: they use a mix of \\r\\n and \\n; they pad with blank
      lines between items; and they very often prefix each line with a
      bullet ("•", "-", "*") or a step number ("1.", "2)") which Cam
      does NOT want carried into the field, since Cheffo already
      numbers steps and bullets ingredients itself when it renders and
      prints them - leaving them in would show "1. 1. Preheat oven".

      Deliberately NOT stripped: anything that looks like a real
      quantity. "1 1/2 cups flour" must survive completely intact, or
      the scaler and shopping list downstream get the wrong number -
      so the numeric prefix rule only fires on a number IMMEDIATELY
      followed by "." or ")" and then a space, which a quantity never
      is. */
  function splitPastedLines(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l
        .replace(/^[\u2022\u2023\u25E6\u2043\u2219*\u00B7]\s+/, "")
        .replace(/^[-\u2013\u2014]\s+/, "")
        .replace(/^\d{1,3}[.)]\s+/, "")
        .trim())
      .filter(Boolean);
  }

  /** Shared by ingredients and steps — both are just arrays of plain
      text lines, add/remove/reorder, no per-line fields the way
      Session Builder's exercises have (block/sets/reps/...). */
  function fillLineList(page, containerId, arr, placeholder, onChange) {
    const box = page.querySelector(`#${containerId}`);
    box.innerHTML = arr.map((line, i) => `
      <div class="cc-row" style="gap:8px;margin-bottom:6px">
        <input class="input" data-line-i="${i}" placeholder="${escA(placeholder)}"
               style="flex:1" value="${escA(line)}">
        <span class="build-acts">
          <button data-a="up" data-i="${i}" title="Move up">&#8593;</button>
          <button data-a="down" data-i="${i}" title="Move down">&#8595;</button>
          <button data-a="del" data-i="${i}" title="Remove">&#10006;</button>
        </span>
      </div>`).join("");
    box.querySelectorAll("[data-line-i]").forEach((inp) => {
      inp.addEventListener("input", () => {
        arr[+inp.dataset.lineI] = inp.value;
      });
      /* v4 — Cam: "This allows for copy and paste from websites and
         makes it faster. Currently i have to go line by line and it
         takes to long." Pasting a whole ingredient list from a recipe
         site used to dump every line into ONE field, leaving Cam to
         cut it apart by hand. Now a multi-line paste splits into one
         real line per item, filling this field and inserting the rest
         after it. A single-line paste is left completely alone (the
         browser's own default), so normal pasting of one value into
         one field behaves exactly as it always has. */
      inp.addEventListener("paste", (e) => {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        const lines = splitPastedLines(text);
        if (lines.length < 2) return;   // ordinary paste — leave it be
        e.preventDefault();
        const at = +inp.dataset.lineI;
        arr.splice(at, 1, ...lines);
        onChange();
      });
    });
    box.querySelectorAll("button[data-a]").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.dataset.i;
        const a = b.dataset.a;
        if (a === "up" || a === "down") {
          const j = i + (a === "up" ? -1 : 1);
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
        } else if (a === "del") {
          arr.splice(i, 1);
          if (!arr.length) arr.push("");
        }
        onChange();
      }));
  }

  /** v4 — Cam: "have rich text formatting text boxes when adding a
      recipe. This allows for copy and paste from websites and makes it
      faster." The other half of the paste fix: rather than pasting into
      one field and having it split, this is one big box to dump a whole
      list into at once, which is closer to how Cam actually copies off
      a website. Replaces the list outright when it's currently empty
      (the overwhelmingly common case - a fresh recipe), otherwise
      offers to append instead so an in-progress list is never silently
      destroyed. */
  function bulkPasteDialog(title, placeholder, arr, onDone) {
    const hasExisting = arr.some((l) => l.trim());
    const d = S.openDlg(title, `
      <p class="stamp" style="margin:0 0 10px">Paste the whole list \u2014
        one per line. Bullets and step numbers get stripped
        automatically.</p>
      <textarea class="input" id="bp-text" rows="10"
                placeholder="${escA(placeholder)}"></textarea>
      ${hasExisting ? `<label class="cc-row" style="gap:8px;margin-top:10px">
        <input type="checkbox" id="bp-append" checked>
        <span class="stamp">Add to what's already there (untick to
          replace it)</span></label>` : ""}`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Add", "btn-save", () => {
      const lines = splitPastedLines(d.body.querySelector("#bp-text").value);
      if (!lines.length) {
        S.toast("Nothing to add \u2014 paste some lines first.", "error");
        return;
      }
      const appendEl = d.body.querySelector("#bp-append");
      const append = appendEl ? appendEl.checked : false;
      const kept = append ? arr.filter((l) => l.trim()) : [];
      arr.length = 0;
      arr.push(...kept, ...lines);
      d.close();
      onDone();
      S.toast(`Added ${lines.length} line${lines.length === 1 ? "" : "s"}.`);
    });
    setTimeout(() => d.body.querySelector("#bp-text").focus(), 50);
  }

  function tagChipsHtml(selectedTags, idPrefix) {
    return `
      <div class="cc-row" id="${idPrefix}-tags" style="flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
      <button type="button" class="btn btn-quiet" id="${idPrefix}-add-tag"
              style="margin-bottom:14px">+ New tag</button>`;
  }

  function paintTagChips(page, idPrefix, selectedTags, onChange) {
    const box = page.querySelector(`#${idPrefix}-tags`);
    box.innerHTML = S.data.tagList.map((t) => `
      <button type="button" class="chip ${selectedTags.includes(t) ?
        "on" : ""}" data-tag="${escA(t)}"
        data-picked="${selectedTags.includes(t) ? "1" : "0"}">${esc(t)}</button>`).join("")
      || `<p class="stamp" style="margin:0">No tags yet \u2014 press
        "+ New tag" to add your first one.</p>`;
    box.querySelectorAll("[data-tag]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const t = btn.dataset.tag;
        const i = selectedTags.indexOf(t);
        if (i === -1) selectedTags.push(t); else selectedTags.splice(i, 1);
        onChange();
      }));
  }

  function renderAddRecipe(page) {
    const editing = !!recipeBuilderEditingId;
    page.innerHTML = `
      <h2 class="cc-page-h">${editing ? "Edit Recipe" : "Add Recipe"}</h2>
      <p class="cc-page-sub">${editing
        ? "Changes save back to this same recipe."
        : "Build out a recipe \u2014 paste a whole list straight off a "
          + "website and it splits into lines for you."}</p>
      ${editing ? "" : `<div class="cc-row" style="gap:8px;margin-bottom:14px;max-width:760px">
        <input class="input" id="rc-link" type="url" style="flex:1"
               placeholder="A recipe page's address" aria-label="A recipe page's address">
        <button class="btn" id="rc-fill">From a web link</button>
      </div>`}
      <div class="panel" style="padding:var(--sp-3);max-width:760px">
        <label class="dlg-label" style="margin-top:0">Recipe name</label>
        <input class="input" id="rc-name" value="${escA(recipeBuilder.name)}"
               style="margin-bottom:14px">

        <label class="dlg-label">Tags</label>
        ${tagChipsHtml(recipeBuilder.tags, "rc")}

        <div class="cc-row" style="gap:14px;margin-bottom:14px">
          <div style="flex:1">
            <label class="dlg-label" style="margin-top:0">Source (optional)</label>
            <input class="input" id="rc-source" value="${escA(recipeBuilder.source)}">
          </div>
          <div style="flex:1">
            <label class="dlg-label" style="margin-top:0">Servings (optional)</label>
            <input class="input" id="rc-servings" placeholder="4"
                   value="${escA(recipeBuilder.servings)}">
          </div>
        </div>

        <label class="dlg-label">Photos (up to 6)</label>
        <div id="rc-photos" class="ex-photo-grid" style="margin-bottom:14px"></div>

        <label class="dlg-label">Description (optional)</label>
        ${richBoxHtml("rc-desc", recipeBuilder.description)}

        <label class="dlg-label">Ingredients</label>
        <div id="rc-ingredients"></div>
        <div class="cc-row" style="gap:8px;margin:6px 0 14px">
          <button type="button" class="btn btn-quiet" id="rc-add-ingredient"
                  >+ Ingredient</button>
          <button type="button" class="btn btn-quiet" id="rc-paste-ingredients"
                  >Paste list\u2026</button>
        </div>

        <label class="dlg-label">Steps</label>
        <div id="rc-steps"></div>
        <div class="cc-row" style="gap:8px;margin:6px 0 14px">
          <button type="button" class="btn btn-quiet" id="rc-add-step"
                  >+ Step</button>
          <button type="button" class="btn btn-quiet" id="rc-paste-steps"
                  >Paste list\u2026</button>
        </div>

        <label class="dlg-label">Notes (optional)</label>
        ${richBoxHtml("rc-notes", recipeBuilder.notes)}

        <div class="cc-row" style="gap:8px">
          <button class="btn btn-quiet" id="rc-clear">${editing ? "Cancel" : "Clear"}</button>
          <span style="flex:1"></span>
          <button class="btn btn-save" id="rc-save">${editing ? "Save Changes" : "Save Recipe"}</button>
        </div>
      </div>`;

    /* V30 (14 Nov 2026), from Cam's Collective: a recipe page's address
       fills this form (recipe_link.py: public sites only, read as data).
       Nothing is saved until Save, so it can be checked first. */
    const fill = page.querySelector("#rc-fill");
    if (fill) {
      const fromLink = async () => {
        const url = page.querySelector("#rc-link").value.trim();
        if (!url) return;
        fill.disabled = true;
        fill.textContent = "Reading\u2026";
        const r = await SS.Store.call("kitchen_recipe_from_link", [url], "Reading the recipe");
        fill.disabled = false;
        fill.textContent = "From a web link";
        if (!r || r.error) { S.toast((r && r.error) || "Couldn't read that page.", "error"); return; }
        const x = r.recipe;
        recipeBuilder = {...recipeBuilder, name: x.name || recipeBuilder.name,
          source: x.source || recipeBuilder.source, servings: x.servings || recipeBuilder.servings,
          description: x.description || recipeBuilder.description,
          ingredients: x.ingredients.length ? x.ingredients : recipeBuilder.ingredients,
          steps: x.steps.length ? x.steps : recipeBuilder.steps};
        renderAddRecipe(page);
        S.toast("Filled in from " + (x.source || "the page") + ". Check it, then save.", "good");
      };
      fill.onclick = fromLink;
      page.querySelector("#rc-link").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); fromLink(); }
      });
    }
    page.querySelector("#rc-name").addEventListener("input", (e) => {
      recipeBuilder.name = e.target.value;
    });
    page.querySelector("#rc-source").addEventListener("input", (e) => {
      recipeBuilder.source = e.target.value;
    });
    page.querySelector("#rc-servings").addEventListener("input", (e) => {
      recipeBuilder.servings = e.target.value;
    });
    wireRichBox(page, "rc-desc", (html) => { recipeBuilder.description = html; });
    wireRichBox(page, "rc-notes", (html) => { recipeBuilder.notes = html; });

    paintTagChips(page, "rc", recipeBuilder.tags, () => renderAddRecipe(page));
    page.querySelector("#rc-add-tag").onclick = async () => {
      const name = await S.promptText("New tag", "Tag name (e.g. Sweet, Bread, Chicken)");
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      if (!S.data.tagList.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        S.data.tagList.push(trimmed);
        await S.save();
      }
      if (!recipeBuilder.tags.includes(trimmed)) recipeBuilder.tags.push(trimmed);
      renderAddRecipe(page);
    };

    paintRecipePhotos(page.querySelector("#rc-photos"), recipeBuilder);
    /* Ctrl+V anywhere on this page (not in a text box) pastes a copied picture */
    page.addEventListener("paste", (e) => {
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
      const file = [...((e.clipboardData && e.clipboardData.items) || [])]
        .find((it) => it.kind === "file" && it.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      pasteRecipePhoto(page.querySelector("#rc-photos"), recipeBuilder, file.getAsFile());
    });

    const refreshIngredients = () => fillLineList(page, "rc-ingredients",
      recipeBuilder.ingredients, "1 1/2 cups flour", refreshIngredients);
    refreshIngredients();
    page.querySelector("#rc-add-ingredient").onclick = () => {
      recipeBuilder.ingredients.push("");
      refreshIngredients();
    };
    page.querySelector("#rc-paste-ingredients").onclick = () =>
      bulkPasteDialog("Paste ingredients", "2 cups flour\n1 tsp salt\n3 eggs",
        recipeBuilder.ingredients, refreshIngredients);

    const refreshSteps = () => fillLineList(page, "rc-steps",
      recipeBuilder.steps, "Preheat oven to 180\u00B0C", refreshSteps);
    refreshSteps();
    page.querySelector("#rc-paste-steps").onclick = () =>
      bulkPasteDialog("Paste steps",
        "Preheat oven to 180\u00B0C\nMix the dry ingredients\nBake for 25 minutes",
        recipeBuilder.steps, refreshSteps);
    page.querySelector("#rc-add-step").onclick = () => {
      recipeBuilder.steps.push("");
      refreshSteps();
    };

    page.querySelector("#rc-clear").onclick = async () => {
      const hasContent = recipeBuilder.name.trim()
        || recipeBuilder.ingredients.some((i) => i.trim())
        || recipeBuilder.steps.some((s) => s.trim());
      if (hasContent && !(await S.confirm({title: editing
          ? "Discard these changes?" : "Clear this recipe?",
          body: editing ? "Nothing you've edited here will be saved."
          : "Everything entered so far will be discarded.",
          yes: editing ? "Discard" : "Clear"}))) return;
      recipeBuilder = newRecipeDraft();
      recipeBuilderEditingId = null;
      renderAddRecipe(page);
    };
    page.querySelector("#rc-save").onclick = saveRecipe;
  }

  async function saveRecipe() {
    const name = recipeBuilder.name.trim();
    if (!name) { S.toast("Give the recipe a name.", "error"); return; }
    const ingredients = recipeBuilder.ingredients.map((i) => i.trim()).filter(Boolean);
    const steps = recipeBuilder.steps.map((s) => s.trim()).filter(Boolean);
    if (!ingredients.length) {
      S.toast("Add at least one ingredient.", "error");
      return;
    }
    const payload = {name, tags: [...recipeBuilder.tags],
      source: recipeBuilder.source.trim(), servings: recipeBuilder.servings.trim(),
      images: recipeBuilder.images.map((im) => ({...im})),
      description: recipeBuilder.description.trim(), ingredients, steps,
      notes: recipeBuilder.notes.trim()};

    if (recipeBuilderEditingId) {
      const existing = S.data.recipes.find((r) => r.id === recipeBuilderEditingId);
      if (existing) Object.assign(existing, payload);
      const editedId = recipeBuilderEditingId;
      recipeBuilder = newRecipeDraft();
      recipeBuilderEditingId = null;
      await S.save();
      S.toast("Recipe updated.");
      S.go("recipes");
      if (existing) openInSplit("recipe", editedId);
      else S.render();
      return;
    }

    S.data.recipes.push({id: newId(), created: new Date().toISOString(), ...payload});
    await S.save();
    recipeBuilder = newRecipeDraft();
    S.toast("Recipe saved.");
    S.go("recipes");
  }

  /* ------------------------------------------------------------- photos */
  function paintRecipePhotos(container, recipe) {
    container.innerHTML = recipe.images.map((im, i) => `
      <div class="ex-photo-tile" data-i="${i}">
        <div class="ex-photo-loading">Loading&hellip;</div>
        ${im.placeholder ? `<span class="rc-ph-badge">Placeholder</span>` : ""}
        <button class="ex-photo-del" data-del-photo="${i}" title="Remove">&#10006;</button>
      </div>`).join("")
      + (recipe.images.length < 6 ? `
      <button class="ex-photo-tile ex-photo-add" id="rc-add-photo" title="Add a photo from Photos"
              aria-label="Add a photo from Photos"
              style="display:flex;align-items:center;justify-content:center;
              font-size: 30px;color:var(--muted)">+</button>
      <button class="ex-photo-tile ex-photo-add rc-paste-tile" id="rc-paste-photo"
              title="Paste a picture you copied (or press Ctrl+V on this page)">Paste</button>` : "");

    container.querySelectorAll(".ex-photo-tile[data-i]").forEach(async (tile) => {
      const im = recipe.images[+tile.dataset.i];
      const result = await S.Store.getPhotoData(im.storedName);
      const loading = tile.querySelector(".ex-photo-loading");
      if (result && result.dataUrl) {
        const img = document.createElement("img");
        img.src = result.dataUrl;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit";
        loading.replaceWith(img);
      } else if (loading) {
        loading.textContent = "Missing";
      }
    });
    container.querySelectorAll("[data-del-photo]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const i = +btn.dataset.delPhoto;
        recipe.images.splice(i, 1);
        paintRecipePhotos(container, recipe);
        /* The FILE is not deleted any more. Recipe photos used to be a
           private copy this recipe owned; since they are picked from
           the photo library they belong to the library, and may be on
           another recipe or in an album too. Removing it here means
           "not on this recipe", which is what the button says. */
      }));
    const addBtn = container.querySelector("#rc-add-photo");
    if (addBtn) addBtn.onclick = () => addRecipePhotoFlow(container, recipe);
    const pasteBtn = container.querySelector("#rc-paste-photo");
    if (pasteBtn) pasteBtn.onclick = async () => {
      let blob = null;
      try {
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find((t) => t.startsWith("image/"));
          if (type) { blob = await item.getType(type); break; }
        }
      } catch (e) { /* no clipboard access: Ctrl+V still works */ }
      if (!blob) { S.toast("No picture on the clipboard. Copy one (right-click it, Copy image), then Paste or Ctrl+V.", "warn"); return; }
      pasteRecipePhoto(container, recipe, blob);
    };
  }

  /* Cam (14 Nov): "when copying in a recipe, i would also like the ability
     to add a photo from my clipboard so i can copy one from the webpage
     and copy it in. They will be placeholders until we replace with our
     own when we cook the dish." A pasted picture goes into Photos first
     (every picture lives there, Cam's rule), tagged "Recipe placeholder",
     then onto the recipe marked as a placeholder until he adds his own. */
  async function pasteRecipePhoto(container, recipe, blob) {
    if (recipe.images.length >= 6) { S.toast("A recipe holds six photos.", "warn"); return; }
    if (!blob || !/^image\//.test(blob.type) || blob.size > 25e6) {
      S.toast("That isn't a picture NeuroNet can use.", "error"); return;
    }
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
    }).catch(() => null);
    const add = window.SS && SS.shared && SS.shared.addPhotoFromDataUrl;
    if (!dataUrl || !add) { S.toast("That picture could not be saved.", "error"); return; }
    const r = await add(dataUrl, (recipe.name || "Recipe") + " (placeholder)", ["Recipe placeholder"]);
    if (!r || r.error || !r.storedName) { S.toast((r && r.error) || "That picture could not be saved.", "error"); return; }
    recipe.images.push({storedName: r.storedName, originalName: r.storedName, placeholder: true});
    paintRecipePhotos(container, recipe);
    S.toast("Placeholder photo added. Swap it for your own when you cook it.", "good");
  }

  /* Cam: "when adding a photo to an exercise or recipe for example i
     want KinCruxs in built photo picker to appear".

     This used to open the operating system's file dialog and copy the
     file in, which meant a photo could enter KinCrux twice -- once in
     the photo library and again, separately, as a recipe picture. Now
     it picks from what is already in the library, so there is one copy
     of every photo and one place they are managed. */
  async function addRecipePhotoFlow(container, recipe) {
    const picked = await S.pickFromLibrary({title: "Add a photo to this recipe"});
    if (!picked) return;
    if (recipe.images.some((im) => im.storedName === picked.storedName)) {
      S.toast("That photo is already on this recipe.", "warn");
      return;
    }
    recipe.images.push({storedName: picked.storedName,
                        originalName: picked.originalName || picked.storedName});
    paintRecipePhotos(container, recipe);
  }

  /* ------------------------------------------------------------ library */
  let recQuery = "";
  let recTagFilter = null;
  /* The cookbook library (23 Nov 2026) put ~7,900 MasterCook recipes in
     here beside Cam's own, so: a cookbook picker ("" = everything, "own" =
     Cam's own, else a cookbook's name), its own categories as the chips, the
     cards painted a page at a time, and each recipe's search text worked out
     once instead of on every key press. */
  let recBook = "";
  let recShown = 0;
  const REC_PAGE = 60;
  const recHay = new WeakMap();
  const byName = new Intl.Collator(undefined, {sensitivity: "base"}).compare;
  const ownTag = (r) => !r.library;

  function hayOf(r) {
    const c = recHay.get(r);
    if (c && c.name === r.name && c.desc === r.description && c.ing === r.ingredients
        && c.src === r.source) return c.hay;
    /* v4 - description is rich HTML now, so search on its visible
       text: otherwise typing "bold" would match a <b> tag, and a word
       genuinely inside formatting wouldn't match at all. */
    const hay = [r.name, r.source, richToText(r.description), ...r.ingredients]
      .join(" ").toLowerCase();
    recHay.set(r, {name: r.name, desc: r.description, ing: r.ingredients, src: r.source, hay});
    return hay;
  }

  function inBook(r) {
    if (!recBook) return true;
    if (recBook === "own") return ownTag(r);
    return r.library === recBook;
  }

  function filteredRecipes() {
    const q = recQuery.trim().toLowerCase();
    return S.data.recipes.filter((r) => {
      if (!inBook(r)) return false;
      if (recTagFilter && !r.tags.includes(recTagFilter)) return false;
      if (!q) return true;
      return hayOf(r).includes(q);
    }).sort((a, b) => (!!b.favourite - !!a.favourite)
      || byName(String(a.name || ""), String(b.name || "")));
  }

  /** The cookbooks in the library, by name. */
  function libraryBooks() {
    const names = new Set();
    for (const r of S.data.recipes) if (r.library) names.add(r.library);
    return [...names].sort(byName);
  }

  /** The chips: Cam's own tags, or the chosen cookbook's own categories. */
  function chipTags() {
    if (!recBook || recBook === "own") return S.data.tagList;
    const tags = new Set();
    for (const r of S.data.recipes) if (r.library === recBook) for (const t of r.tags || []) tags.add(t);
    return [...tags].sort(byName);
  }

  /* Favourites (2026-10-02). Cam: "when i favourite either from the widget
     or in the app it will appear above the alphabetical list of recipes
     shown." A flag on the recipe itself (r.favourite), so the desktop
     Recipes widget and this page read the same thing; the widget sets it
     through NeuroNet (recipe.favourite), which saves the Kitchen the same
     way. */
  async function toggleFavourite(r) {
    r.favourite = !r.favourite;
    if (!r.favourite) delete r.favourite;
    await S.save();
    S.render();
    if (splitState && splitState.type === "recipe" && splitState.id === r.id) renderSplitPane();
  }

  /* The cover of a recipe card: its first photo, small (the library's own
     cached thumbnails), or its initial on a tint. */
  function paintCovers(root) {
    root.querySelectorAll("[data-cover]").forEach((el) => {
      const name = el.dataset.cover;
      const thumb = window.SS && SS.shared && SS.shared.thumb;
      if (!name || !thumb) return;
      thumb(name).then((url) => {
        if (!url || el.querySelector(".rk-img")) return;
        const img = document.createElement("img");
        img.className = "rk-img"; img.alt = ""; img.src = url;
        el.prepend(img);
        el.classList.add("has-img");
      }).catch(() => {});
    });
  }

  /* The recipe library, 2026-10-02 -- Cam: "i dont really like the recipe
     view inside the app, it looks clunky and not modern, would you please
     make it look more modern within the app." Cards with their photos instead
     of a table: favourites in their own row first, then everything A to Z. */
  function recipeCard(r) {
    const cover = (r.images && r.images[0] && r.images[0].storedName) || "";
    const meta = [r.servings ? `Serves ${esc(r.servings)}` : "", r.ingredients.length ? `${r.ingredients.length} ingredients` : ""]
      .filter(Boolean).join(" · ");
    return `
      <article class="rk-card" data-open="${escA(r.id)}" tabindex="0" title="${escA(r.name)}">
        <div class="rk-cover" data-cover="${escA(cover)}"><span class="rk-initial">${esc((r.name || "?").trim().charAt(0).toUpperCase())}</span></div>
        <button class="rk-heart ${r.favourite ? "on" : ""}" data-fav="${escA(r.id)}"
                title="${r.favourite ? "Take out of favourites" : "Add to favourites"}" aria-pressed="${!!r.favourite}">${r.favourite ? "♥" : "♡"}</button>
        <div class="rk-card-body">
          <h3 class="rk-name">${esc(r.name)}</h3>
          ${meta ? `<p class="rk-meta">${meta}</p>` : ""}
          ${r.tags.length ? `<div class="rk-tags">${r.tags.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
      </article>`;
  }

  function renderRecipes(page) {
    const list = filteredRecipes();
    recShown = REC_PAGE;
    const shown = list.slice(0, recShown);
    const favs = shown.filter((r) => r.favourite), rest = shown.filter((r) => !r.favourite);
    const favCount = list.filter((r) => r.favourite).length;
    const books = libraryBooks();
    const own = S.data.recipes.filter(ownTag).length;
    if (recBook && recBook !== "own" && !books.includes(recBook)) recBook = "";
    page.innerHTML = `
      <div class="rk">
        <header class="rk-head">
          <div>
            <h2 class="cc-page-h">Recipes</h2>
            <p class="cc-page-sub">${books.length
              ? `${own} of your own · ${S.data.recipes.length - own} in ${books.length} cookbook${books.length === 1 ? "" : "s"}`
              : `${S.data.recipes.length} recipe${S.data.recipes.length === 1 ? "" : "s"} in your library`}${
              favCount ? ` · ${favCount} favourite${favCount === 1 ? "" : "s"}` : ""}.</p>
          </div>
          <button class="btn btn-save" id="rec-add">+ Add Recipe</button>
        </header>
        <div class="rk-tools">
          <div class="rk-tools-row">
            <input class="input rk-search" id="rec-q" type="search" placeholder="Search recipes, ingredients&hellip;" value="${escA(recQuery)}">
            ${books.length ? `<select class="input rk-book" id="rec-book" title="Which recipes">
              <option value="">Everything</option>
              <option value="own" ${recBook === "own" ? "selected" : ""}>Your own recipes</option>
              <optgroup label="Cookbooks">
                ${books.map((b) => `<option value="${escA(b)}" ${recBook === b ? "selected" : ""}>${esc(b)}</option>`).join("")}
              </optgroup>
            </select>` : ""}
          </div>
          <div class="rk-filter" id="rec-tag-filter"></div>
        </div>
        ${list.length && (recQuery.trim() || recBook || recTagFilter) ? `<p class="stamp rk-count">${list.length} recipe${list.length === 1 ? "" : "s"}</p>` : ""}
        ${favs.length ? `<h3 class="rk-section">♥ Favourites</h3><div class="rk-grid">${favs.map(recipeCard).join("")}</div>` : ""}
        ${rest.length ? `${favs.length ? `<h3 class="rk-section">A to Z</h3>` : ""}<div class="rk-grid">${rest.map(recipeCard).join("")}</div>` : ""}
        ${list.length > shown.length ? `<div class="rk-more-row"><button class="btn" id="rec-more">Show more (${list.length - shown.length} to go)</button></div>` : ""}
        ${list.length ? "" : `<p class="cc-empty rk-empty">${S.data.recipes.length ? "No recipes match." : "Nothing here yet — add your first recipe."}</p>`}
      </div>`;

    page.querySelector("#rec-q").addEventListener("input", (e) => {
      recQuery = e.target.value;
      renderRecipes(page);
      const q = page.querySelector("#rec-q");
      q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    });
    const bookSel = page.querySelector("#rec-book");
    if (bookSel) bookSel.addEventListener("change", () => {
      recBook = bookSel.value;
      recTagFilter = null;
      renderRecipes(page);
    });
    /* Show more adds the next cards to the end of the A to Z grid, so the
       page doesn't jump back to the top. */
    const moreBtn = page.querySelector("#rec-more");
    if (moreBtn) moreBtn.onclick = () => {
      const next = list.slice(recShown, recShown + REC_PAGE * 2);
      recShown += next.length;
      const grids = page.querySelectorAll(".rk-grid");
      const grid = grids[grids.length - 1];
      const tmp = document.createElement("div");
      tmp.innerHTML = next.map(recipeCard).join("");
      paintCovers(tmp);
      grid.append(...tmp.children);
      if (recShown >= list.length) moreBtn.parentElement.remove();
      else moreBtn.textContent = `Show more (${list.length - recShown} to go)`;
    };
    page.querySelector("#rec-add").onclick = () => { S.go("add-recipe"); S.render(); };
    /* one listener for every card, painted now or by Show more */
    const rk = page.querySelector(".rk");
    rk.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        e.stopPropagation();
        const r = S.data.recipes.find((x) => x.id === fav.dataset.fav);
        if (r) toggleFavourite(r);
        return;
      }
      const card = e.target.closest("[data-open]");
      if (card) openInSplit("recipe", card.dataset.open);
    });
    rk.addEventListener("keydown", (e) => {
      const card = e.target.closest && e.target.closest("[data-open]");
      if (e.key === "Enter" && card && e.target === card) openInSplit("recipe", card.dataset.open);
    });
    paintCovers(page);

    const tagBox = page.querySelector("#rec-tag-filter");
    tagBox.innerHTML = chipTags().map((t) => `
      <button class="chip ${recTagFilter === t ? "on" : ""}"
              data-tag-filter="${escA(t)}"
              data-picked="${recTagFilter === t ? "1" : "0"}">
        ${esc(t)}</button>`).join("");
    tagBox.querySelectorAll("[data-tag-filter]").forEach((btn) =>
      btn.addEventListener("click", () => {
        recTagFilter = recTagFilter === btn.dataset.tagFilter ? null : btn.dataset.tagFilter;
        renderRecipes(page);
      }));
  }

  function renderRecipeSplitView(pane, recipeId) {
    const r = S.data.recipes.find((x) => x.id === recipeId);
    if (!r) { pane.innerHTML = `<p class="cc-empty">This recipe no `
      + `longer exists.</p>`; return; }

    /* 2026-10-02: a modern recipe page -- the photo across the top with the
       name over it, the facts as chips, the ingredients beside the method
       (ticked off as you go; the ticks aren't saved), numbered steps. */
    const cover = (r.images && r.images[0] && r.images[0].storedName) || "";
    pane.innerHTML = `
      <div class="rk-view">
        <div class="rk-hero" data-cover="${escA(cover)}">
          <div class="rk-hero-shade"></div>
          <button class="split-close rk-close" id="split-x" title="Close">&#10005;</button>
          <button class="rk-heart rk-hero-heart ${r.favourite ? "on" : ""}" id="split-fav-recipe"
                  title="${r.favourite ? "Take out of favourites" : "Add to favourites"}" aria-pressed="${!!r.favourite}">${r.favourite ? "♥" : "♡"}</button>
          <div class="rk-hero-text">
            <h2 class="rk-title">${esc(r.name)}</h2>
            <div class="rk-facts">
              ${r.servings ? `<span>Serves ${esc(r.servings)}</span>` : ""}
              <span>${r.ingredients.length} ingredients</span>
              <span>${r.steps.length} steps</span>
              ${r.source ? `<span>${esc(r.source)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="rk-actions">
          <button class="btn btn-save" id="split-edit-recipe">Edit</button>
          <button class="btn btn-quiet" id="split-print-recipe">Print</button>
          <button class="btn btn-quiet" id="split-book-recipe">Add to book</button>
          <span class="rk-gap"></span>
          <button class="btn btn-danger" id="split-del-recipe">Delete</button>
        </div>
        ${r.tags.length ? `<div class="rk-tags rk-view-tags">${r.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
        ${r.description ? `<div class="rich-view rk-intro">${sanitizeRichHtml(r.description)}</div>` : ""}
        <div class="rk-cols">
          <section class="rk-ings">
            <h3>Ingredients</h3>
            <ul class="recipe-ings">${r.ingredients.map((i, n) =>
              `<li><label><input type="checkbox" data-ing="${n}"><span>${esc(i)}</span></label></li>`).join("")}</ul>
          </section>
          <section class="rk-method">
            <h3>Method</h3>
            <ol class="recipe-steps">${r.steps.map((st) => `<li><span>${esc(st)}</span></li>`).join("")}</ol>
          </section>
        </div>
        ${r.notes ? `<section class="rk-notes"><h3>Notes</h3><div class="rich-view">${sanitizeRichHtml(r.notes)}</div></section>` : ""}
        <div id="rv-photos" class="ex-photo-grid rk-photos"></div>
        <p class="stamp rk-saved">Saved ${new Date(r.created).toLocaleDateString()}</p>
      </div>`;
    paintCovers(pane);
    pane.querySelector("#split-fav-recipe").onclick = () => toggleFavourite(r);
    pane.querySelectorAll("[data-ing]").forEach((c) => c.addEventListener("change", () =>
      c.closest("li").classList.toggle("done", c.checked)));

    paintRecipePhotosReadonly(pane.querySelector("#rv-photos"), r);

    pane.querySelector("#split-x").onclick = closeSplit;
    pane.querySelector("#split-edit-recipe").onclick = () => {
      recipeBuilder = {name: r.name, tags: [...r.tags], source: r.source,
        servings: r.servings, images: r.images.map((im) => ({...im})),
        description: r.description, ingredients: [...r.ingredients],
        steps: [...r.steps], notes: r.notes};
      recipeBuilderEditingId = r.id;
      closeSplit();
      S.go("add-recipe");
    };
    pane.querySelector("#split-print-recipe").onclick = () => printRecipe(r);
    /* Ctrl+P prints the recipe that is open. The anchor is the Print
       BUTTON, not the pane: #cc-split-pane is permanent and merely
       emptied when the recipe closes, so anchoring to it would leave
       the offer live over an empty screen -- measured, and it reprinted
       the recipe you had just closed. The button is replaced on every
       render and gone when the pane empties, which makes the offer last
       exactly as long as the control it mirrors. */
    S.offerPrint(pane.querySelector("#split-print-recipe"),
      r.name || "this recipe", () => S.Store.printRecipeDocument(r));
    pane.querySelector("#split-book-recipe").onclick = () => addToBookDialog(r);
    pane.querySelector("#split-del-recipe").onclick = async () => {
      const ok = await S.confirm({title: "Delete this recipe?",
        body: `Delete \u201C${r.name}\u201D? This can't be undone.`,
        fine: "Any menus it's part of will keep working \u2014 the "
          + "recipe just won't be there anymore. Its photos stay in "
          + "your photo library.", yes: "Delete"});
      if (!ok) return;
      /* Deleting a recipe no longer deletes its photos. They are
         library photos now -- picked, not copied -- so removing the
         recipe must not reach into the photo library and delete files
         that may be in an album or on another recipe. */
      S.data.recipes.splice(S.data.recipes.indexOf(r), 1);
      S.data.menus.forEach((m) => {
        m.recipeIds = (m.recipeIds || []).filter((id) => id !== r.id);
      });
      /* books reference recipes the same way menus do, so they get the
         same prune — otherwise a book would keep a dead id forever and
         quietly print one recipe short */
      (S.data.books || []).forEach((b) => {
        b.recipeIds = (b.recipeIds || []).filter((id) => id !== r.id);
      });
      await S.save();
      closeSplit();
      S.render();
    };
  }

  function paintRecipePhotosReadonly(container, recipe) {
    if (!recipe.images.length) { container.innerHTML = ""; return; }
    if (container.classList.contains("rk-photos")) {
      // the recipe page: the first photo is its header; the rest show below
      recipe = Object.assign({}, recipe, {images: recipe.images.slice(1)});
      if (!recipe.images.length) { container.innerHTML = ""; return; }
    }
    container.innerHTML = recipe.images.map((im) => `
      <div class="ex-photo-tile"><div class="ex-photo-loading">Loading&hellip;</div>
        ${im.placeholder ? `<span class="rc-ph-badge">Placeholder</span>` : ""}</div>`).join("");
    const tiles = [...container.querySelectorAll(".ex-photo-tile")];
    recipe.images.forEach(async (im, i) => {
      const result = await S.Store.getPhotoData(im.storedName);
      const loading = tiles[i].querySelector(".ex-photo-loading");
      if (result && result.dataUrl) {
        const img = document.createElement("img");
        img.src = result.dataUrl;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit";
        loading.replaceWith(img);
      } else if (loading) {
        loading.textContent = "Missing";
      }
    });
  }

  async function printRecipe(r) {
    const result = await S.Store.printRecipeDocument(r);
    if (result && result.error) S.toast(result.error, "error");
  }


  /* v5 — Cam: "allign it with the UI of the other apps with the side bar
     menu please."

     The same shape the other apps use: section headings with a flat list
     of destinations under each, every one visible at once. The previous
     top bar hid Recipes, Menus and the rest behind three dropdowns that
     had to be opened before anything could be reached. Groups are kept
     as HEADINGS rather than being flattened away — they're still a
     useful way to read the list, they just don't hide anything now. */
  /* -------------------------------------------------------------- timer */
  /** Cam: "Timer feature which stays persistent until it is closed."
      Ported from cookery.js's own floating timer cards. Simpler here
      than the reference needed to be: #timer-box lives outside
      #cc-main-pane in index.html's own markup, so it's never touched
      by S.render() rebuilding the page \u2014 no need to re-append it after
      every navigation the way cookery.js had to when Cam's Collective
      was a single mount point. Multiple timers at once, same as the
      reference ("open as many as you like, one per pot"). */
  function beep(times = 2) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 940;
        gain.gain.value = 0.15;
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.16);
      }
    } catch (e) { /* silent machines still get the flashing card */ }
  }

  function openTimer(label = "Timer") {
    const timerBox = document.getElementById("timer-box");
    const card = document.createElement("div");
    card.className = "timer-card";
    card.innerHTML = `
      <div class="timer-head"><span>&#9201; ${esc(label)}</span>
        <button class="timer-x" title="Close">&times;</button></div>
      <div class="timer-display">10:00</div>
      <div class="timer-row">
        <input class="input timer-mins" type="number" min="1" max="240"
               value="10" title="Minutes">
        <button class="btn btn-save timer-start">Start</button>
        <button class="btn btn-quiet timer-reset">Reset</button>
      </div>`;
    timerBox.appendChild(card);

    const display = card.querySelector(".timer-display");
    const startBtn = card.querySelector(".timer-start");
    const minsIn = card.querySelector(".timer-mins");
    let remaining = 0;
    let interval = null;
    let alarming = null;
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:`
      + `${String(s % 60).padStart(2, "0")}`;
    const stopAll = () => {
      if (interval) clearInterval(interval);
      if (alarming) clearInterval(alarming);
      interval = alarming = null;
      card.classList.remove("timer-done");
    };
    startBtn.onclick = () => {
      if (alarming) {                       // STOP ALARM pressed
        stopAll();
        remaining = 0;
        display.textContent = fmt(parseInt(minsIn.value, 10) * 60 || 600);
        startBtn.textContent = "Start";
        return;
      }
      if (interval) {                       // pause
        clearInterval(interval);
        interval = null;
        startBtn.textContent = "Resume";
        return;
      }
      if (remaining <= 0) {
        remaining = (parseInt(minsIn.value, 10) || 10) * 60;
      }
      display.textContent = fmt(remaining);
      startBtn.textContent = "Pause";
      interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          interval = null;
          display.textContent = "DONE!";
          startBtn.textContent = "STOP ALARM";
          card.classList.add("timer-done");
          beep();
          alarming = setInterval(() => beep(), 1600);
          return;
        }
        display.textContent = fmt(remaining);
      }, 1000);
    };
    card.querySelector(".timer-reset").onclick = () => {
      stopAll();
      remaining = 0;
      startBtn.textContent = "Start";
      display.textContent = fmt((parseInt(minsIn.value, 10) || 10) * 60);
    };
    card.querySelector(".timer-x").onclick = () => {
      stopAll();
      card.remove();
    };
    return card;
  }

  /* -------------------------------------------------------------- split pane */
  let splitState = null;   // {type: "recipe", id} | null

  function openInSplit(type, id) {
    splitState = {type, id};
    renderSplitPane();
  }
  function closeSplit() {
    splitState = null;
    renderSplitPane();
  }
  function renderSplitPane() {
    const pane = document.getElementById("cc-split-pane");
    if (!splitState) {
      pane.classList.remove("open");
      pane.innerHTML = "";
      return;
    }
    pane.classList.add("open");
    if (splitState.type === "recipe") renderRecipeSplitView(pane, splitState.id);
  }

  /* ==========================================================================
     RECIPE BOOKS
     ==========================================================================
     Cam: "can we make the app have the same book feature that cranium has
     where i can add to a book, pick a logo, name it and print or export
     it? This will allow me to work with collections of recipes."

     WHY THIS ISN'T JUST MENUS. Menus already hold recipeIds, so a book
     could have been a menu with a cover bolted on. They're kept apart
     because they answer different questions: a menu is what you're
     serving at one occasion, a book is a collection you print once and
     keep. Cam confirmed the split. Structurally they're siblings, and
     deliberately so — a book uses the same id-referencing and the same
     pruning path a menu already does.

     WHY IDS, NOT SNAPSHOTS — the one real departure from Cranium.
     Cranium's books store a SNAPSHOT of each puzzle, because a generated
     puzzle lives nowhere else. A recipe does live somewhere else, and is
     edited over time: fix a typo in a recipe and every book holding it
     should show the fix. So books reference recipeIds, and deleting a
     recipe prunes it from books exactly where it already prunes it from
     menus.
     ========================================================================== */

  /* Cover emblems, drawn on a 24x24 grid, stroked not filled.

     DELIBERATELY NO ELLIPTICAL ARCS in any path. These same paths are
     converted straight onto reportlab's path object for the PDF export
     (see _draw_svg_path in cheffo.py), and arcs are the one part of the
     SVG path grammar that's genuinely painful to convert. Everything
     here uses move/line/curve only, which keeps that converter small
     and the artwork identical across screen, print and PDF.

     This table is the ONLY copy of the artwork — the Python side never
     holds its own, it just receives the chosen path with each request. */
  const COVER_LOGOS = {
    chef: {name: "Chef's hat", path:
      "M6 12.5C3.8 12.5 2 10.7 2 8.5 2 6.4 3.6 4.7 5.6 4.5 6.2 3 7.7 2 9.5 2"
      + "c1.1 0 2.1.4 2.9 1C13.1 2.4 14.5 2 16 2c2.8 0 5 2.2 5 5 0 2.4-1.7 4.4-4 4.9"
      + "M6 12.5V20h12v-7.6M6 16.5h12"},
    sweet: {name: "Cake", path:
      "M4 12.5h16v6.5c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z"
      + "M4.6 12.5C5.2 10.4 6.9 9 9 9h6c2.1 0 3.8 1.4 4.4 3.5"
      + "M12 9V5.5M12 5.5c-1 0-1.6-.7-1.6-1.5 0-1 1.6-2.2 1.6-2.2S13.6 3 13.6 4"
      + "c0 .8-.6 1.5-1.6 1.5M4 16.2c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4"
      + "S12 14.8 13.6 14.8s1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4"},
    bread: {name: "Bread", path:
      "M4 13C4 9.7 7.6 7 12 7s8 2.7 8 6v3.4c0 1.7-1.4 3.1-3.1 3.1H7.1"
      + "C5.4 19.5 4 18.1 4 16.4z"
      + "M9 7.3C9 5.5 10.3 4.2 12 4.2M9.6 11.2v6.1M14.4 11.2v6.1"},
    chicken: {name: "Chicken", path:
      "M20 7.4c0 2.8-2.3 5.1-5.1 5.1-.6 0-1.2-.1-1.7-.3l-4.6 4.6-2.4-2.4 4.6-4.6"
      + "c-.2-.5-.3-1.1-.3-1.7C10.5 5.3 12.8 3 15.6 3 18 3 20 5 20 7.4z"
      + "M8.2 14.4 5.4 17.2c-.9.9-.9 2.4 0 3.4M9.4 15.6l-2.8 2.8"},
    beef: {name: "Beef", path:
      "M3.5 11.5C3.5 7.4 7.4 4 12.2 4S21 7.4 21 11.5s-3.9 7.5-8.8 7.5"
      + "S3.5 15.6 3.5 11.5z"
      + "M8.2 11.4c0-1.9 1.8-3.4 4-3.4s4 1.5 4 3.4-1.8 3.4-4 3.4-4-1.5-4-3.4z"},
    pot: {name: "Pot", path:
      "M3.5 9h17v6.6c0 2.2-1.8 4-4 4H7.5c-2.2 0-4-1.8-4-4z"
      + "M3.5 11.6H1.8M20.5 11.6h1.7M8 6.4C8 5 9 4 10.2 4M12 6.4C12 5 13 4 14.2 4"
      + "M16 6.4C16 5 17 4 18.2 4"},
    fish: {name: "Fish", path:
      "M3 12c2.6-3.2 5.6-4.8 9-4.8 3.4 0 6.4 1.6 9 4.8-2.6 3.2-5.6 4.8-9 4.8"
      + "C8.6 16.8 5.6 15.2 3 12z"
      + "M16.4 10.1h.02M3 12c-.8-1.6-1.2-3.2-1.2-4.8C3.4 8 4.6 9.3 5.4 10.7"
      + "M3 12c-.8 1.6-1.2 3.2-1.2 4.8C3.4 16 4.6 14.7 5.4 13.3"},
    veg: {name: "Greens", path:
      "M12 21c0-5.5 3.1-9.6 8.4-10.8C20.8 15.6 17.4 20 12 21z"
      + "M12 21C12 14.6 8.2 9.9 2 8.7 2.5 15 6.2 19.8 12 21zM12 21v-6.4"},
  };

  const TAG_LOGO = {sweet: "sweet", dessert: "sweet", cake: "sweet",
    baking: "sweet", bread: "bread", dough: "bread", chicken: "chicken",
    poultry: "chicken", beef: "beef", lamb: "beef", pork: "beef",
    steak: "beef", fish: "fish", seafood: "fish", soup: "pot",
    stew: "pot", curry: "pot", pasta: "pot", veg: "veg",
    vegetarian: "veg", vegan: "veg", salad: "veg"};

  const logoFor = (book) =>
    (book && COVER_LOGOS[book.logo]) ? book.logo : suggestedLogo(book);

  /** The emblem a book gets before Cam picks one. Same idea as Cranium's:
      a book that's all one kind of thing gets that thing's emblem, a
      mixed one gets the general chef's hat. Decided from the recipes'
      own tags rather than asking. */
  function suggestedLogo(book) {
    const counts = new Map();
    for (const r of bookRecipes(book)) {
      for (const t of (r.tags || [])) {
        const key = TAG_LOGO[String(t).toLowerCase()];
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    if (!counts.size) return "chef";
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    /* only commit to a themed emblem when the book really is mostly one
       thing — a 50/50 book of cakes and curries is a mixed book */
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    return ranked[0][1] / total >= 0.6 ? ranked[0][0] : "chef";
  }

  function logoSvg(key, size, cls) {
    const l = COVER_LOGOS[key] || COVER_LOGOS.chef;
    return `<svg class="${cls || ""}" viewBox="0 0 24 24" width="${size}"
      height="${size}" fill="none" stroke="currentColor" stroke-width="1.4"
      stroke-linecap="round" stroke-linejoin="round"><path d="${l.path}"/></svg>`;
  }

  const bookById = (id) => (S.data.books || []).find((b) => b.id === id) || null;

  /** A book's recipes, in the book's own order, silently skipping ids
      that no longer resolve — the same resolution the print side does. */
  function bookRecipes(book) {
    if (!book) return [];
    const byId = new Map(S.data.recipes.map((r) => [r.id, r]));
    return (book.recipeIds || []).map((id) => byId.get(id)).filter(Boolean);
  }

  /** The payload the backend needs: the book plus its resolved emblem,
      so cheffo.py never needs its own copy of the artwork. */
  function bookPayload(book) {
    return {...book, logoPath: (COVER_LOGOS[logoFor(book)] || COVER_LOGOS.chef).path};
  }

  async function createBook(name) {
    S.data.books = S.data.books || [];
    const book = {id: newId(), name: String(name || "").trim() || "Untitled book",
      logo: "", notes: "", recipeIds: [], created: new Date().toISOString()};
    S.data.books.push(book);
    await S.save();
    return book;
  }

  /* ------------------------------------------------------- add to book --- */
  /** Cranium's own rule, which is the right one: adding to a book and
      creating a new book are on the SAME sheet, because realising you
      need a new book is exactly what happens while you're filing
      something into one. */
  function addToBookDialog(recipe) {
    const books = [...(S.data.books || [])]
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const d = S.openDlg(`Add “${recipe.name}” to…`, `
      ${books.length ? books.map((b) => {
        const has = (b.recipeIds || []).includes(recipe.id);
        return `<button class="btn bk-pick ${has ? "is-in" : ""}"
          data-bk="${escA(b.id)}" ${has ? "disabled" : ""}>
          <span class="bk-pick-mark">${logoSvg(logoFor(b), 22)}</span>
          <span class="bk-pick-name">${esc(b.name)}</span>
          <span class="stamp">${has ? "already in"
            : (b.recipeIds || []).length + " recipe"
              + ((b.recipeIds || []).length === 1 ? "" : "s")}</span>
        </button>`;
      }).join("")
        : `<p class="stamp" style="margin:0 0 12px">No books yet.</p>`}
      <label class="dlg-label">New book</label>
      <div class="cc-row" style="gap:8px">
        <input class="input" id="bk-new" style="flex:1" placeholder="Sunday Baking">
        <button class="btn btn-save" id="bk-create">Create &amp; add</button>
      </div>`);
    d.btn("Cancel", "btn-quiet", d.close);

    const addTo = async (book) => {
      book.recipeIds = book.recipeIds || [];
      if (!book.recipeIds.includes(recipe.id)) book.recipeIds.push(recipe.id);
      await S.save();
      d.close();
      S.toast(`Added to “${book.name}”.`, "ok");
      S.render();
    };

    d.body.querySelectorAll("[data-bk]").forEach((b) =>
      b.addEventListener("click", () => {
        const book = bookById(b.dataset.bk);
        if (book) addTo(book);
      }));
    const create = async () => {
      const name = d.body.querySelector("#bk-new").value.trim();
      if (!name) { S.toast("Give the book a name.", "error"); return; }
      addTo(await createBook(name));
    };
    d.body.querySelector("#bk-create").onclick = create;
    d.body.querySelector("#bk-new").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); create(); }
    });
  }

  /* ----------------------------------------------------------- screens --- */
  let openBookId = null;

  function renderBooks(page) {
    if (openBookId && bookById(openBookId)) {
      renderBookDetail(page, bookById(openBookId));
      return;
    }
    openBookId = null;
    const books = [...(S.data.books || [])]
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    page.innerHTML = `
      <div class="cc-page-head">
        <div>
          <h2 class="cc-page-h">Recipe Books</h2>
          <p class="cc-page-sub">Collections you can print or export as one
            book — cover, contents and all.</p>
        </div>
        <button class="btn btn-save" id="bk-add">+ New book</button>
      </div>
      ${books.length ? `<div class="bk-grid">
        ${books.map((b) => {
          const n = (b.recipeIds || []).length;
          return `<button class="bk-card" data-open="${escA(b.id)}">
            <span class="bk-card-cover">${logoSvg(logoFor(b), 58)}</span>
            <span class="bk-card-name">${esc(b.name)}</span>
            <span class="stamp">${n} recipe${n === 1 ? "" : "s"}</span>
          </button>`;
        }).join("")}
      </div>`
        : `<div class="cc-empty">
            <p>No books yet.</p>
            <p class="stamp">Make one here, or hit <b>Add to book</b> on any
              recipe.</p>
          </div>`}`;

    page.querySelector("#bk-add").onclick = async () => {
      const name = await S.promptText("New book", "What's it called?", "");
      if (name === null) return;
      const b = await createBook(name);
      openBookId = b.id;
      S.render();
    };
    page.querySelectorAll("[data-open]").forEach((el) =>
      el.addEventListener("click", () => { openBookId = el.dataset.open; S.render(); }));
  }

  function renderBookDetail(page, book) {
    const recipes = bookRecipes(book);
    const missing = (book.recipeIds || []).length - recipes.length;

    page.innerHTML = `
      <button class="btn btn-quiet" id="bk-back" style="margin-bottom:14px">
        &larr; All books</button>

      <div class="bk-detail-head">
        <div class="bk-detail-cover">${logoSvg(logoFor(book), 66)}</div>
        <div style="flex:1">
          <h2 class="cc-page-h" style="margin:0">${esc(book.name)}</h2>
          <p class="cc-page-sub" style="margin:4px 0 0">
            ${recipes.length} recipe${recipes.length === 1 ? "" : "s"}
            ${missing ? ` · ${missing} no longer in your library` : ""}</p>
        </div>
      </div>

      <div class="cc-row cc-wrap" style="gap:8px;margin:16px 0 20px">
        <button class="btn" id="bk-cover">Cover</button>
        <button class="btn" id="bk-rename">Rename</button>
        <button class="btn" id="bk-addrec">+ Add recipes</button>
        <button class="btn btn-save" id="bk-print">Print book</button>
        <button class="btn" id="bk-export">Export…</button>
        <span style="flex:1"></span>
        <button class="btn btn-danger" id="bk-del">Delete book</button>
      </div>

      ${recipes.length ? `<ol class="bk-list">
        ${recipes.map((r, i) => `
          <li class="bk-list-row" data-row="${escA(r.id)}">
            <span class="bk-list-no">${i + 1}</span>
            <span class="bk-list-name">${esc(r.name)}</span>
            <span class="stamp">${(r.tags || []).join(", ")}</span>
            <span class="bk-list-acts">
              <button class="btn btn-quiet btn-sm" data-up="${escA(r.id)}"
                ${i === 0 ? "disabled" : ""} title="Move up">&#8593;</button>
              <button class="btn btn-quiet btn-sm" data-down="${escA(r.id)}"
                ${i === recipes.length - 1 ? "disabled" : ""}
                title="Move down">&#8595;</button>
              <button class="btn btn-quiet btn-sm" data-rm="${escA(r.id)}"
                title="Remove from book">&#10005;</button>
            </span>
          </li>`).join("")}
      </ol>`
        : `<div class="cc-empty"><p>This book is empty.</p>
           <p class="stamp">Use <b>+ Add recipes</b>, or <b>Add to book</b>
             on any recipe.</p></div>`}`;

    page.querySelector("#bk-back").onclick = () => { openBookId = null; S.render(); };
    page.querySelector("#bk-cover").onclick = () => coverPickerDialog(book);
    page.querySelector("#bk-rename").onclick = async () => {
      const name = await S.promptText("Rename book", "Name", book.name);
      if (name === null || !name.trim()) return;
      book.name = name.trim();
      await S.save();
      S.render();
    };
    page.querySelector("#bk-addrec").onclick = () => addRecipesDialog(book);
    page.querySelector("#bk-print").onclick = () => printBook(book);
    S.offerPrint(page.querySelector("#bk-print"), book.name || "this book", () =>
      (bookRecipes(book).length
        ? S.Store.printBookDocument(bookPayload(book), S.data.recipes)
        : {error: "This book has no recipes in it yet."}));
    page.querySelector("#bk-export").onclick = () => exportBookDialog(book);
    page.querySelector("#bk-del").onclick = async () => {
      const ok = await S.confirm({title: "Delete this book?",
        body: `Delete “${book.name}”?`,
        fine: "The recipes themselves stay in your library — only the "
          + "book goes.", yes: "Delete book"});
      if (!ok) return;
      S.data.books = S.data.books.filter((b) => b.id !== book.id);
      openBookId = null;
      await S.save();
      S.render();
    };

    const move = async (id, delta) => {
      const ids = book.recipeIds;
      const i = ids.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await S.save();
      S.render();
    };
    page.querySelectorAll("[data-up]").forEach((b) =>
      b.addEventListener("click", () => move(b.dataset.up, -1)));
    page.querySelectorAll("[data-down]").forEach((b) =>
      b.addEventListener("click", () => move(b.dataset.down, 1)));
    page.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", async () => {
        book.recipeIds = book.recipeIds.filter((x) => x !== b.dataset.rm);
        await S.save();
        S.render();
      }));
  }

  const PICK_MAX = 200;
  const pickMore = (n) => n > PICK_MAX
    ? `<p class="stamp" style="margin:10px 0 0">Showing ${PICK_MAX} of ${n}. Type to find the rest.</p>` : "";

  function addRecipesDialog(book) {
    const already = new Set(book.recipeIds || []);
    const available = [...S.data.recipes]
      .filter((r) => !already.has(r.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (!available.length) {
      S.toast(S.data.recipes.length ? "Every recipe is already in this book."
        : "Add some recipes first.", "error");
      return;
    }
    /* With the cookbook library there can be thousands to choose from, so
       the list is searchable and paints PICK_MAX rows at most; ticks are
       kept in `ticked`, so searching doesn't lose them. */
    const ticked = new Set();
    const d = S.openDlg(`Add to “${book.name}”`, `
      <p class="stamp" style="margin:0 0 10px">Tick everything you want in
        the book.</p>
      <input class="input" id="bk-q" placeholder="Search recipes&hellip;"
             style="width:100%;margin-bottom:10px">
      <div class="bk-chooser" id="bk-choose"></div>`);
    const paint = () => {
      const q = d.body.querySelector("#bk-q").value.trim().toLowerCase();
      const hits = available.filter((r) => !q || (r.name || "").toLowerCase().includes(q));
      d.body.querySelector("#bk-choose").innerHTML = hits.slice(0, PICK_MAX).map((r) => `
          <label class="bk-choose-row">
            <input type="checkbox" value="${escA(r.id)}" ${ticked.has(r.id) ? "checked" : ""}>
            <span style="flex:1">${esc(r.name)}</span>
            <span class="stamp">${esc((r.tags || []).join(", "))}</span>
          </label>`).join("") + pickMore(hits.length);
    };
    d.body.querySelector("#bk-q").addEventListener("input", paint);
    d.body.querySelector("#bk-choose").addEventListener("change", (e) => {
      if (e.target.type !== "checkbox") return;
      if (e.target.checked) ticked.add(e.target.value); else ticked.delete(e.target.value);
    });
    paint();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Add", "btn-save", async () => {
      const picked = [...ticked];
      if (!picked.length) { S.toast("Nothing ticked.", "error"); return; }
      book.recipeIds = [...(book.recipeIds || []), ...picked];
      await S.save();
      d.close();
      S.toast(`Added ${picked.length} recipe${picked.length === 1 ? "" : "s"}.`, "ok");
      S.render();
    });
  }

  function coverPickerDialog(book) {
    const current = logoFor(book);
    const d = S.openDlg("Cover", `
      <p class="stamp" style="margin:0 0 12px">This shows on the printed
        cover and on every page header.</p>
      <div class="bk-logo-grid">
        ${Object.entries(COVER_LOGOS).map(([key, l]) => `
          <button class="bk-logo ${key === current ? "on" : ""}"
                  data-logo="${escA(key)}" title="${escA(l.name)}">
            ${logoSvg(key, 40)}
            <span class="stamp">${esc(l.name)}</span>
          </button>`).join("")}
      </div>
      <p class="stamp" style="margin:14px 0 0">Leave it and Cheffo picks one
        from the book's own tags.</p>`);
    d.btn("Close", "btn-quiet", d.close);
    d.body.querySelectorAll("[data-logo]").forEach((b) =>
      b.addEventListener("click", async () => {
        book.logo = b.dataset.logo;
        await S.save();
        d.close();
        S.render();
      }));
  }

  /* ------------------------------------------------------ print/export --- */
  async function printBook(book) {
    if (!bookRecipes(book).length) {
      S.toast("This book has no recipes in it yet.", "error");
      return;
    }
    const res = await S.Store.printBookDocument(bookPayload(book), S.data.recipes);
    if (res && res.error) S.toast(res.error, "error");
  }

  const BOOK_EXPORTS = {
    html: {label: "Web page", ext: "html",
      hint: "One self-contained file with the photos inside — opens "
        + "anywhere, keeps working on its own."},
    pdf: {label: "PDF", ext: "pdf",
      hint: "A real PDF with a cover, contents and one recipe per page."},
    md: {label: "Markdown", ext: "md",
      hint: "Plain readable text — for pasting into notes or a message."},
  };

  async function exportBookDialog(book) {
    if (!bookRecipes(book).length) {
      S.toast("This book has no recipes in it yet.", "error");
      return;
    }
    const pdf = await S.Store.pdfAvailable();
    const d = S.openDlg(`Export “${book.name}”`, `
      <p class="stamp" style="margin:0 0 14px">Saved to your desktop.</p>
      ${Object.entries(BOOK_EXPORTS).map(([key, f]) => {
        /* PDF is the one format with an optional dependency behind it.
           Saying so here beats offering it and failing afterwards. */
        const off = key === "pdf" && pdf && pdf.ok === false;
        return `<button class="btn bk-fmt" data-fmt="${key}" ${off ? "disabled" : ""}
          style="width:100%;text-align:left;display:block;margin-bottom:8px;
                 padding:11px 13px;height:auto">
          <b>${esc(f.label)}</b> <span class="stamp">(.${f.ext})</span><br>
          <span class="stamp">${off
            ? esc(pdf.hint || "Needs reportlab — pip install reportlab")
            : esc(f.hint)}</span>
        </button>`;
      }).join("")}`);
    d.btn("Cancel", "btn-quiet", d.close);

    d.body.querySelectorAll("[data-fmt]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const res = await S.Store.exportBook(bookPayload(book), S.data.recipes,
          btn.dataset.fmt);
        btn.disabled = false;
        if (res && res.error) { S.toast(res.error, "error"); return; }
        d.close();
        /* naming the file, not just "done" — an export you can't find
           afterwards may as well not have happened */
        S.toast(`Saved to your desktop as ${fileNameOf(res.path)}`, "ok");
      }));
  }

  const fileNameOf = (p) => String(p || "").split(/[\\/]/).pop();

  /* Cheffo's own boot() lived here. It is gone on purpose: Hearth owns
     startup now — one data load, one prefs read, one render. Two boots
     racing to load the same file into two different variables is
     exactly the double-boot bug this app has already been bitten by
     once (see the DOMContentLoaded note in app.js). */

  /* ============================================================================
     CONVERSION / SCALING — ported verbatim from Cam's Collective's own
     cookery.js, which is itself "a faithful port of camscookery's
     Fraction-based scaler, cross-checked against the Python originals
     in unit tests." Not reinvented, not approximated.
     ============================================================================ */
  const WEIGHT_TO_G = {g: 1.0, kg: 1000.0, oz: 28.3495, lb: 453.592};
  const VOLUME_TO_ML = {ml: 1.0, l: 1000.0, tsp: 4.92892, tbsp: 14.7868,
                        cup: 236.588, "fl oz": 29.5735,
                        "pint (US)": 473.176, "quart (US)": 946.353};
  const GRAMS_PER_CUP = {
    "Water": 236.6, "Plain / All-purpose flour": 125.0,
    "Bread flour": 127.0, "Caster / granulated sugar": 200.0,
    "Brown sugar (packed)": 220.0, "Icing / powdered sugar": 120.0,
    "Butter": 227.0, "Milk": 244.0, "Honey": 340.0,
    "Rice (uncooked)": 185.0, "Rolled oats": 90.0, "Cocoa powder": 100.0,
    "Salt (table)": 292.0, "Breadcrumbs (dry)": 108.0,
    "Whole wheat flour": 120.0, "Self-raising flour": 125.0,
    "Almond meal / flour": 96.0, "Cornflour / cornstarch": 128.0,
    "Rice flour": 158.0, "Semolina": 167.0, "Polenta / cornmeal": 156.0,
    "Raw / demerara sugar": 200.0, "Chocolate chips": 170.0,
    "Desiccated coconut": 85.0, "Sultanas / raisins": 150.0,
    "Cream": 240.0, "Sour cream": 240.0, "Yoghurt": 245.0,
    "Peanut butter": 258.0, "Maple syrup": 322.0, "Golden syrup": 340.0,
    "Molasses / treacle": 340.0, "Grated parmesan": 100.0,
    "Walnuts (chopped)": 117.0, "Almonds (whole)": 143.0};
  const COOKING_MEASURES = {cup: 1.0, tbsp: 1 / 16, tsp: 1 / 48};

  const convertWeight = (v, a, b) => v * WEIGHT_TO_G[a] / WEIGHT_TO_G[b];
  const convertVolume = (v, a, b) => v * VOLUME_TO_ML[a] / VOLUME_TO_ML[b];
  function convertTemperature(v, a, b) {
    if (a === b) return v;
    const c = a === "\u00B0C" ? v : a === "\u00B0F" ? (v - 32) * 5 / 9
                                                    : v - 273.15;
    return b === "\u00B0C" ? c : b === "\u00B0F" ? c * 9 / 5 + 32
                                                 : c + 273.15;
  }
  function convertCooking(v, from, to, ingredient) {
    const gPerCup = GRAMS_PER_CUP[ingredient];
    const grams = from === "grams" ? v : v * COOKING_MEASURES[from] * gPerCup;
    return to === "grams" ? grams : grams / (COOKING_MEASURES[to] * gPerCup);
  }

  const ING_RE = new RegExp(
    "^(?<prefix>[A-Za-z][A-Za-z' /&-]*:\\s*)?" +
    "(?<amount>\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+)" +
    "(?<rest>[\\s\\S]*)$");

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (n, d = 1) => {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(Math.abs(n), d) || 1;
    return {n: n / g, d: d / g};
  };
  const fracMul = (a, b) => frac(a.n * b.n, a.d * b.d);
  const fracAdd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);

  /** "1 1/2" | "3/4" | "2.5" | "3" -> exact fraction */
  function parseAmount(text) {
    text = text.trim();
    if (text.includes(" ") && text.includes("/")) {
      const [whole, rest] = text.split(/\s+/, 2);
      return fracAdd(frac(parseInt(whole, 10)), parseAmount(rest));
    }
    if (text.includes("/")) {
      const [n, d] = text.split("/");
      return frac(parseInt(n, 10), parseInt(d, 10));
    }
    if (text.includes(".")) {
      const places = text.split(".")[1].length;
      return frac(Math.round(parseFloat(text) * 10 ** places),
                  10 ** places);
    }
    return frac(parseInt(text, 10));
  }

  /** Format like Python's _format_amount: whole numbers plain, tidy
      fractions as mixed numbers, awkward ones as trimmed decimals. */
  function formatAmount(f) {
    if (f.d === 1) return String(f.n);
    if ([2, 3, 4, 8].includes(f.d)) {
      const whole = Math.floor(f.n / f.d);
      const rem = f.n % f.d;
      const fr = `${rem}/${f.d}`;
      return whole ? `${whole} ${fr}` : fr;
    }
    return String(parseFloat((f.n / f.d).toFixed(2)));
  }

  /** Scale the leading quantity of an ingredient line. Lines with no
      leading number get an "(xN)" tag so nothing is silently lost. */
  function scaleIngredient(ingredient, mult) {
    const m = String(mult);
    const multF = m.includes(".") ? parseAmount(m) : frac(parseFloat(m));
    if (multF.n === multF.d) return ingredient;
    const match = ingredient.trim().match(ING_RE);
    if (!match) return `${ingredient} (x${formatAmount(multF)})`;
    const amount = fracMul(parseAmount(match.groups.amount), multF);
    return `${match.groups.prefix || ""}${formatAmount(amount)}` +
           `${match.groups.rest}`;
  }

  /* ============================================================================
     MENUS
     ============================================================================ */
  function newMenu() {
    return {id: newId(), name: "New Menu", created: new Date().toISOString(),
      recipeIds: [], notes: ""};
  }

  let menuSelected = null;

  function renderMenus(page) {
    const menus = [...S.data.menus].sort((a, b) =>
      (b.created || "").localeCompare(a.created || ""));
    if (!menus.some((m) => m.id === menuSelected) && menus.length) {
      menuSelected = menus[0].id;
    }
    page.innerHTML = `
      <h2 class="cc-page-h">Menus</h2>
      <p class="cc-page-sub">Group recipes together for an event or a
        week's worth of cooking.</p>
      <div class="sidebar-layout">
        <aside class="sidebar-nav">
          <button class="btn btn-save" id="mn-new"
                  style="margin-bottom:10px;width:100%">+ New Menu</button>
          ${menus.map((m) => `<button class="sidebar-nav-btn
            ${m.id === menuSelected ? "on" : ""}" data-id="${escA(m.id)}">
            <div>${esc(m.name)}</div>
            <div class="stamp" style="margin:0">${m.recipeIds.length} recipe${
              m.recipeIds.length === 1 ? "" : "s"}</div>
            </button>`).join("") || `<p class="stamp" style="padding:10px 4px">
            No menus yet.</p>`}
        </aside>
        <div class="sidebar-content" id="mn-content"></div>
      </div>`;

    page.querySelector("#mn-new").onclick = async () => {
      const m = newMenu();
      S.data.menus.push(m);
      await S.save();
      menuSelected = m.id;
      S.render();
    };
    page.querySelectorAll(".sidebar-nav-btn").forEach((b) =>
      b.addEventListener("click", () => {
        menuSelected = b.dataset.id;
        S.render();
      }));
    paintMenuContent(page);
  }

  function paintMenuContent(page) {
    const box = page.querySelector("#mn-content");
    const m = S.data.menus.find((x) => x.id === menuSelected);
    if (!m) {
      box.innerHTML = `<div class="cc-onboard">
        <h2>No menu yet</h2>
        <p>Click \u201C+ New Menu\u201D to build your first one.</p>
        </div>`;
      return;
    }
    const recipes = m.recipeIds.map((id) => S.data.recipes.find((r) => r.id === id))
      .filter(Boolean);

    box.innerHTML = `
      <div class="cc-row" style="justify-content:space-between;margin-bottom:12px">
        <h2 class="cc-page-h" style="margin-bottom:2px">${esc(m.name)}</h2>
        <div class="cc-row" style="gap:8px">
          <button class="btn btn-quiet" id="mn-rename">Rename</button>
          <button class="btn btn-danger" id="mn-delete">Delete</button>
        </div>
      </div>
      <div class="panel lp-section">
        <div class="cc-row" style="justify-content:space-between">
          <h3>Recipes</h3>
          <button class="btn btn-quiet" id="mn-add-recipe">+ Add recipe</button>
        </div>
        ${recipes.length ? `<div class="lp-ref-list">
          ${recipes.map((r, i) => `<div class="lp-ref-row">
            <span class="lp-ref-name" data-open-recipe="${i}">${esc(r.name)}</span>
            <button class="btn btn-quiet" data-rm-recipe="${i}">Remove</button>
            </div>`).join("")}
          </div>` : `<p class="cc-empty" style="text-align:left;padding:4px 0">
          No recipes added yet.</p>`}
      </div>
      <label class="dlg-label">Notes</label>
      <textarea class="input" id="mn-notes" rows="3"
                style="margin-bottom:10px">${esc(m.notes || "")}</textarea>
      <button class="btn btn-save" id="mn-save-notes">Save notes</button>`;

    box.querySelector("#mn-rename").onclick = async () => {
      const name = await S.promptText("Rename menu", "Name", m.name);
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) { S.toast("Give it a name.", "error"); return; }
      m.name = trimmed;
      await S.save();
      S.render();
    };
    box.querySelector("#mn-delete").onclick = async () => {
      const ok = await S.confirm({title: "Delete this menu?",
        body: `Delete \u201C${m.name}\u201D? This can't be undone.`,
        yes: "Delete"});
      if (!ok) return;
      S.data.menus.splice(S.data.menus.indexOf(m), 1);
      await S.save();
      menuSelected = null;
      S.render();
    };
    box.querySelector("#mn-add-recipe").onclick = () => menuAddRecipeDialog(m);
    box.querySelectorAll("[data-open-recipe]").forEach((el) =>
      el.addEventListener("click", () => {
        S.go("recipes");
        openInSplit("recipe", recipes[+el.dataset.openRecipe].id);
      }));
    box.querySelectorAll("[data-rm-recipe]").forEach((b) =>
      b.addEventListener("click", async () => {
        const r = recipes[+b.dataset.rmRecipe];
        m.recipeIds = m.recipeIds.filter((id) => id !== r.id);
        await S.save();
        S.render();
      }));
    box.querySelector("#mn-save-notes").onclick = async () => {
      m.notes = box.querySelector("#mn-notes").value.trim();
      await S.save();
      S.toast("Notes saved.");
    };
  }

  function menuAddRecipeDialog(menu) {
    const available = S.data.recipes.filter((r) => !menu.recipeIds.includes(r.id));
    const d = S.openDlg("Add a recipe", `
      <input class="input" id="mar-q" placeholder="Search recipes&hellip;"
             style="width:100%;margin-bottom:10px">
      <div id="mar-list" style="max-height:360px;overflow-y:auto"></div>`, true);
    const paintList = () => {
      const q = d.body.querySelector("#mar-q").value.trim().toLowerCase();
      const filtered = available.filter((r) => !q || r.name.toLowerCase().includes(q));
      d.body.querySelector("#mar-list").innerHTML = (filtered.slice(0, PICK_MAX).map((r) => `
        <button class="picker-item" data-rid="${escA(r.id)}" style="width:100%">
          <span>${esc(r.name)}</span>
          <span class="stamp">${esc(r.tags.join(", "))}</span>
        </button>`).join("") + pickMore(filtered.length)) || `<p class="cc-empty">${available.length ?
          "No recipes match." : "Every recipe is already in this menu."}</p>`;
      d.body.querySelectorAll("[data-rid]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          menu.recipeIds.push(btn.dataset.rid);
          await S.save();
          d.close();
          S.render();
        }));
    };
    d.body.querySelector("#mar-q").addEventListener("input", paintList);
    paintList();
    d.btn("Close", "btn-quiet", d.close);
  }

  /* ============================================================================
     SHOPPING LISTS
     ============================================================================ */
  function newShoppingList() {
    return {id: newId(), title: "New Shopping List",
      created: new Date().toISOString(), recipeNames: [], items: [""]};
  }

  let shopSelected = null;

  function renderShopping(page) {
    const lists = [...S.data.shoppingLists].sort((a, b) =>
      (b.created || "").localeCompare(a.created || ""));
    if (!lists.some((l) => l.id === shopSelected) && lists.length) {
      shopSelected = lists[0].id;
    }
    page.innerHTML = `
      <h2 class="cc-page-h">Shopping Lists</h2>
      <p class="cc-page-sub">Build a list by hand, or pull ingredients
        straight from a recipe.</p>
      <div class="sidebar-layout">
        <aside class="sidebar-nav">
          <button class="btn btn-save" id="sh-new"
                  style="margin-bottom:10px;width:100%">+ New List</button>
          ${lists.map((l) => `<button class="sidebar-nav-btn
            ${l.id === shopSelected ? "on" : ""}" data-id="${escA(l.id)}">
            <div>${esc(l.title)}</div>
            <div class="stamp" style="margin:0">${l.items.filter((i) => i.trim()).length} item${
              l.items.filter((i) => i.trim()).length === 1 ? "" : "s"}</div>
            </button>`).join("") || `<p class="stamp" style="padding:10px 4px">
            No lists yet.</p>`}
        </aside>
        <div class="sidebar-content" id="sh-content"></div>
      </div>`;

    page.querySelector("#sh-new").onclick = async () => {
      const l = newShoppingList();
      S.data.shoppingLists.push(l);
      await S.save();
      shopSelected = l.id;
      S.render();
    };
    page.querySelectorAll(".sidebar-nav-btn").forEach((b) =>
      b.addEventListener("click", () => {
        shopSelected = b.dataset.id;
        S.render();
      }));
    paintShoppingContent(page);
  }

  function paintShoppingContent(page) {
    const box = page.querySelector("#sh-content");
    const l = S.data.shoppingLists.find((x) => x.id === shopSelected);
    if (!l) {
      box.innerHTML = `<div class="cc-onboard">
        <h2>No list yet</h2>
        <p>Click \u201C+ New List\u201D to start one.</p>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="cc-row" style="justify-content:space-between;margin-bottom:12px">
        <h2 class="cc-page-h" style="margin-bottom:2px">${esc(l.title)}</h2>
        <div class="cc-row" style="gap:8px">
          <button class="btn btn-quiet" id="sh-rename">Rename</button>
          <button class="btn btn-quiet" id="sh-print">Print</button>
          <button class="btn btn-danger" id="sh-delete">Delete</button>
        </div>
      </div>
      ${l.recipeNames.length ? `<p class="stamp">From: ${l.recipeNames
        .map(esc).join(", ")}</p>` : ""}
      <button class="btn btn-quiet" id="sh-add-from-recipe"
              style="margin:8px 0 14px">+ Add ingredients from a recipe</button>
      <div id="sh-items"></div>
      <button class="btn btn-quiet" id="sh-add-item" style="margin-top:8px">
        + Item</button>`;

    const refreshItems = () => fillLineList(page, "sh-items", l.items,
      "Milk", async () => { refreshItems(); await S.save(); });
    refreshItems();
    box.querySelector("#sh-add-item").onclick = () => {
      l.items.push("");
      refreshItems();
    };

    box.querySelector("#sh-rename").onclick = async () => {
      const title = await S.promptText("Rename list", "Title", l.title);
      if (title === null) return;
      const trimmed = title.trim();
      if (!trimmed) { S.toast("Give it a name.", "error"); return; }
      l.title = trimmed;
      await S.save();
      S.render();
    };
    box.querySelector("#sh-print").onclick = () => printShoppingList(l);
    S.offerPrint(box.querySelector("#sh-print"), l.title || "this list",
      () => S.Store.printShoppingListDocument(l));
    box.querySelector("#sh-delete").onclick = async () => {
      const ok = await S.confirm({title: "Delete this list?",
        body: `Delete \u201C${l.title}\u201D? This can't be undone.`,
        yes: "Delete"});
      if (!ok) return;
      S.data.shoppingLists.splice(S.data.shoppingLists.indexOf(l), 1);
      await S.save();
      shopSelected = null;
      S.render();
    };
    box.querySelector("#sh-add-from-recipe").onclick = () => shopAddFromRecipeDialog(l);
  }

  function shopAddFromRecipeDialog(list) {
    const d = S.openDlg("Add ingredients from a recipe", `
      <input class="input" id="saf-q" placeholder="Search recipes&hellip;"
             style="width:100%;margin-bottom:10px">
      <div id="saf-list" style="max-height:360px;overflow-y:auto"></div>`, true);
    const paintList = () => {
      const q = d.body.querySelector("#saf-q").value.trim().toLowerCase();
      const filtered = S.data.recipes.filter((r) => !q || r.name.toLowerCase().includes(q));
      d.body.querySelector("#saf-list").innerHTML = (filtered.slice(0, PICK_MAX).map((r) => `
        <button class="picker-item" data-rid="${escA(r.id)}" style="width:100%">
          <span>${esc(r.name)}</span>
          <span class="stamp">${r.ingredients.length} ingredients</span>
        </button>`).join("") + pickMore(filtered.length)) || `<p class="cc-empty">No recipes match.</p>`;
      d.body.querySelectorAll("[data-rid]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const r = S.data.recipes.find((x) => x.id === btn.dataset.rid);
          list.items = list.items.filter((i) => i.trim());
          list.items.push(...r.ingredients);
          if (!list.items.length) list.items.push("");
          if (!list.recipeNames.includes(r.name)) list.recipeNames.push(r.name);
          await S.save();
          d.close();
          S.render();
          S.toast(`Added ${r.ingredients.length} ingredients from \u201C${r.name}\u201D.`);
        }));
    };
    d.body.querySelector("#saf-q").addEventListener("input", paintList);
    paintList();
    d.btn("Close", "btn-quiet", d.close);
  }

  async function printShoppingList(l) {
    const result = await S.Store.printShoppingListDocument(l);
    if (result && result.error) S.toast(result.error, "error");
  }

  /* ============================================================================
     CALCULATORS — Unit Converter + Scale Recipe
     ============================================================================ */
  let calcTab = "Unit Converter";
  let convUnitTab = "Weight";

  function renderCalculators(page) {
    const tabs = ["Unit Converter", "Scale Recipe"];
    page.innerHTML = `
      <h2 class="cc-page-h">Calculators</h2>
      <p class="cc-page-sub">Convert between units, or scale a whole
        recipe up or down.</p>
      <div class="sidebar-layout">
        <aside class="sidebar-nav">
          ${tabs.map((t) => `<button class="sidebar-nav-btn ${t === calcTab ?
            "on" : ""}" data-cat="${escA(t)}">${esc(t)}</button>`).join("")}
        </aside>
        <div class="sidebar-content" id="calc-content"></div>
      </div>`;
    page.querySelectorAll(".sidebar-nav-btn").forEach((b) =>
      b.addEventListener("click", () => {
        calcTab = b.dataset.cat;
        renderCalculators(page);
      }));
    const content = page.querySelector("#calc-content");
    if (calcTab === "Unit Converter") calcUnitConverter(content);
    else calcScaleRecipe(content);
  }

  function calcUnitConverter(box) {
    const unitTabs = ["Weight", "Volume", "Temperature", "Cooking"];
    box.innerHTML = `
      <h3 style="margin:0 0 14px;font-size: 17.5px">Unit Converter</h3>
      <div class="cc-row" style="gap:6px;margin-bottom:14px;flex-wrap:wrap">
        ${unitTabs.map((t) => `<button class="btn ${t === convUnitTab ?
          "btn-save" : "btn-quiet"}" data-unit-tab="${escA(t)}"
          style="padding:6px 12px">${esc(t)}</button>`).join("")}
      </div>
      <div class="calc-grid"><div class="panel calc-panel" id="cv-body"></div></div>`;
    box.querySelectorAll("[data-unit-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        convUnitTab = b.dataset.unitTab;
        calcUnitConverter(box);
      }));

    const body = box.querySelector("#cv-body");
    if (convUnitTab === "Cooking") {
      body.innerHTML = `
        <h3>Cooking Measure</h3>
        <label class="dlg-label" style="margin-top:0">Ingredient</label>
        <select class="input" id="cv-ing" style="width:100%">
          ${Object.keys(GRAMS_PER_CUP).map((i) =>
            `<option>${esc(i)}</option>`).join("")}
        </select>
        <div class="cc-row calc-row" style="margin-top:12px;flex-wrap:wrap">
          <input class="input" id="cv-val" type="number" step="any"
                 style="width:110px" value="1">
          <select class="input" id="cv-from">
            ${["cup", "tbsp", "tsp", "grams"].map((u) =>
              `<option>${u}</option>`).join("")}</select>
          <span>&rarr;</span>
          <select class="input" id="cv-to">
            ${["grams", "cup", "tbsp", "tsp"].map((u) =>
              `<option>${u}</option>`).join("")}</select>
          <button class="btn btn-save" id="cv-go">Convert</button>
        </div>
        <pre class="calc-out" id="cv-out">Pick an ingredient \u2014
  densities differ, so a cup of flour isn't a cup of honey.</pre>`;
      body.querySelector("#cv-go").onclick = () => {
        const v = parseFloat(body.querySelector("#cv-val").value);
        const out = body.querySelector("#cv-out");
        if (isNaN(v)) { out.textContent = "Enter a number."; return; }
        const ing = body.querySelector("#cv-ing").value;
        const from = body.querySelector("#cv-from").value;
        const to = body.querySelector("#cv-to").value;
        const res = convertCooking(v, from, to, ing);
        out.textContent = `${v} ${from} of ${ing}\n= `
          + `${parseFloat(res.toFixed(2))} ${to}`;
      };
    } else {
      const units = convUnitTab === "Weight" ? Object.keys(WEIGHT_TO_G)
        : convUnitTab === "Volume" ? Object.keys(VOLUME_TO_ML)
        : ["\u00B0C", "\u00B0F", "K"];
      const fn = convUnitTab === "Weight" ? convertWeight
        : convUnitTab === "Volume" ? convertVolume : convertTemperature;
      body.innerHTML = `
        <h3>${esc(convUnitTab)}</h3>
        <div class="cc-row calc-row" style="margin-top:12px;flex-wrap:wrap">
          <input class="input" id="cv-val" type="number" step="any"
                 style="width:110px" value="1">
          <select class="input" id="cv-from">
            ${units.map((u) => `<option>${esc(u)}</option>`).join("")}
          </select>
          <span>&rarr;</span>
          <select class="input" id="cv-to">
            ${units.map((u, i) => `<option ${i === 1 ? "selected" : ""}>
              ${esc(u)}</option>`).join("")}
          </select>
          <button class="btn btn-save" id="cv-go">Convert</button>
        </div>
        <pre class="calc-out" id="cv-out">Enter a value and convert.</pre>`;
      body.querySelector("#cv-go").onclick = () => {
        const v = parseFloat(body.querySelector("#cv-val").value);
        const out = body.querySelector("#cv-out");
        if (isNaN(v)) { out.textContent = "Enter a number."; return; }
        const from = body.querySelector("#cv-from").value;
        const to = body.querySelector("#cv-to").value;
        const res = fn(v, from, to);
        out.textContent = `${v} ${from}  =  `
          + `${parseFloat(res.toFixed(4))} ${to}`;
      };
    }
  }

  function calcScaleRecipe(box) {
    box.innerHTML = `
      <h3 style="margin:0 0 14px;font-size: 17.5px">Scale Recipe</h3>
      <div class="calc-grid"><div class="panel calc-panel">
        <h3>Pick a recipe and a multiplier</h3>
        <label class="dlg-label" style="margin-top:0">Recipe</label>
        <select class="input" id="sr-recipe" style="width:100%">
          <option value="">\u2014 Choose a recipe \u2014</option>
          ${S.data.recipes.map((r) => `<option value="${escA(r.id)}">
            ${esc(r.name)}</option>`).join("")}
        </select>
        <div class="cc-row calc-row" style="margin-top:12px">
          <label class="dlg-label" style="margin:0">Multiplier</label>
          <select class="input" id="sr-mult" style="width:100px">
            ${["0.5", "1", "1.5", "2", "3", "4", "5", "6", "8", "10"]
              .map((v) => `<option ${v === "1" ? "selected" : ""}>${v}</option>`)
              .join("")}
          </select>
          <button class="btn btn-save" id="sr-go">Scale</button>
        </div>
        <p class="stamp" style="margin-top:8px">Amounts are scaled exactly
          (fractions, not rounded decimals). Lines with no leading number
          get an "(xN)" tag instead so nothing's silently lost.</p>
        <div id="sr-out"></div>
      </div></div>`;

    if (!S.data.recipes.length) {
      box.querySelector("#sr-out").innerHTML =
        `<p class="cc-empty" style="text-align:left;padding:10px 0">
         No recipes saved yet \u2014 add one first.</p>`;
      return;
    }

    box.querySelector("#sr-go").onclick = () => {
      const rid = box.querySelector("#sr-recipe").value;
      const r = S.data.recipes.find((x) => x.id === rid);
      const out = box.querySelector("#sr-out");
      if (!r) { out.innerHTML = `<p class="stamp">Pick a recipe first.</p>`; return; }
      const mult = parseFloat(box.querySelector("#sr-mult").value);
      const scaled = r.ingredients.map((i) => scaleIngredient(i, mult));
      const newServings = r.servings && !isNaN(parseFloat(r.servings))
        ? parseFloat((parseFloat(r.servings) * mult).toFixed(2)) : null;
      out.innerHTML = `
        <h3 style="margin-top:16px">${esc(r.name)} &times; ${mult}
          ${newServings !== null ? `<span class="stamp">(serves ~${newServings})</span>` : ""}</h3>
        <ul class="recipe-ings">${scaled.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        <button class="btn btn-quiet" id="sr-add-shop">+ Add to a shopping list</button>`;
      out.querySelector("#sr-add-shop").onclick = () =>
        scaleAddToShoppingDialog(r, scaled, mult);
    };
  }

  function scaleAddToShoppingDialog(recipe, scaledIngredients, mult) {
    const choices = S.data.shoppingLists;
    const d = S.openDlg("Add to a shopping list", `
      <label class="dlg-label" style="margin-top:0">Add to</label>
      <select class="input" id="sas-dest" style="width:100%">
        <option value="__new__">+ New list</option>
        ${choices.map((l) => `<option value="${escA(l.id)}">${esc(l.title)}</option>`).join("")}
      </select>`, true);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Add", "btn-save", async () => {
      const dest = d.body.querySelector("#sas-dest").value;
      let tag = recipe.name;
      if (mult !== 1) tag += ` (x${mult})`;
      if (dest === "__new__") {
        const l = newShoppingList();
        l.title = `Shopping list \u2014 ${tag}`;
        l.items = [...scaledIngredients];
        l.recipeNames = [tag];
        S.data.shoppingLists.push(l);
        shopSelected = l.id;
      } else {
        const l = choices.find((x) => x.id === dest);
        l.items = l.items.filter((i) => i.trim());
        l.items.push(...scaledIngredients);
        if (!l.items.length) l.items.push("");
        l.recipeNames.push(tag);
        shopSelected = l.id;
      }
      await S.save();
      d.close();
      S.toast(`${scaledIngredients.length} ingredient(s) added.`);
    });
  }


  /* ------------------------------------------------------------------
     What Hearth's router calls. Each takes the element to render into;
     the cookery pages build their own two-pane shell inside it.
     ------------------------------------------------------------------ */
  function mount(main, which) {
    main.innerHTML = `<div id="cc-content">
        <div id="cc-main-pane"></div>
        <div id="cc-split-pane"></div>
      </div>`;
    const page = main.querySelector("#cc-main-pane");
    ({
      recipes: renderRecipes,
      "add-recipe": renderAddRecipe,
      menus: renderMenus,
      shopping: renderShopping,
      books: renderBooks,
      calculators: renderCalculators,
    })[which](page);
    renderSplitPane();
  }

  window.CP.Cookery = {
    mount,
    openTimer,
    /* The Omarchy menu opens one recipe (app.js openItem): beside the list,
       as a click on it does. false if it's gone. */
    openRecipe(id) {
      if (!S.data || !S.data.recipes.some((r) => r.id === id)) return false;
      openInSplit("recipe", id);
      return true;
    },
    /* the desktop Recipes widget changed a favourite: show it, if on screen */
    refresh() {
      try { S.render(); if (splitState) renderSplitPane(); } catch (e) { /* not mounted */ }
    },
    VIEWS: ["recipes", "add-recipe", "menus", "shopping", "books",
            "calculators"],
    /* The dashboard's Quick recipe widget splits a pasted list with the
       same rules the recipe builder uses, bullets and step numbers and all. */
    splitPastedLines,
    /* the same surface Cheffo's own tests drove, so they port across */
    _test: {
      scaleIngredient, parseAmount, formatAmount, convertWeight,
      convertVolume, convertTemperature, convertCooking,
      sanitizeRichHtml, richToText, splitPastedLines,
      newRecipeDraft, filteredRecipes, renderRecipes, renderAddRecipe,
      renderRecipeSplitView, saveRecipe, printRecipe,
      newMenu, renderMenus, paintMenuContent, menuAddRecipeDialog,
      newShoppingList, renderShopping, paintShoppingContent,
      shopAddFromRecipeDialog, printShoppingList,
      renderCalculators, calcUnitConverter, calcScaleRecipe,
      COVER_LOGOS, TAG_LOGO, logoFor, suggestedLogo, logoSvg, bookById,
      bookRecipes, bookPayload, createBook, addToBookDialog, renderBooks,
      renderBookDetail, addRecipesDialog, coverPickerDialog, printBook,
      exportBookDialog, BOOK_EXPORTS,
      openInSplit, closeSplit, renderSplitPane, openTimer, mount,
      get recipeBuilder() { return recipeBuilder; },
      _setRecipeBuilder: (r) => { recipeBuilder = r; },
      get openBookId() { return openBookId; },
      _setOpenBookId: (id) => { openBookId = id; },
      get menuSelected() { return menuSelected; },
      _setMenuSelected: (id) => { menuSelected = id; },
      get shopSelected() { return shopSelected; },
      _setShopSelected: (id) => { shopSelected = id; },
      get recQuery() { return recQuery; },
      _setRecQuery: (q) => { recQuery = q; },
    },
  };
})();
