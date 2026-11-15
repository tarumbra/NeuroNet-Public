  // ---- the How to Play book (2026-10-20) ------------------------------------------------------------------------------------
  //      Amunet's guide, read from the bag in the class books' reader: a contents page, then a page a chapter with its photo
  //      (art/guide/<shot>.webp, made by tools/make_guide.js -- the same chapters print to the PDF on Scribe's Ebooks shelf).
  function guidePages() {
    const G = Core.HOW_TO_PLAY, shot = (k) => k && window.GUIDE_SHOTS && window.GUIDE_SHOTS[k] ? `<img class="gh-shot" alt="" src="art/guide/${k}.webp">` : "";
    const contents = `<h2 class="gh-title">${esc(G.title)}</h2><p class="gh-sub">${esc(G.subtitle)}</p>
      <ol class="gh-contents">${G.chapters.map((c, i) => `<li><button class="gh-link" data-bookto="${i + 1}">${esc(c.title)}</button></li>`).join("")}</ol>
      <p class="gh-note">This book is also on NeuroNet's Scribe shelf, under Ebooks.</p>`;
    return [{head: G.title, html: contents}].concat(G.chapters.map((c) => ({head: G.title, html: `<h3 class="gh-chapter">${esc(c.title)}</h3>${shot(c.shot)}
      ${c.paras.map((p) => `<p>${esc(p)}</p>`).join("")}
      ${c.tips && c.tips.length ? `<div class="gh-tips"><b>Good to know</b><ul>${c.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      <button class="gh-link gh-tocback" data-bookto="0">Contents</button>`})));
  }
  let guideShelved = false;
  /** Put the PDF on Scribe's Ebooks shelf (once a run; NeuroNet adds it or refreshes it in place). */
  async function guideToScribe() {
    if (guideShelved || slot === "dev") return;
    guideShelved = true;
    try { await SS.Store.call("guide_to_scribe", []); } catch (e) { /* NeuroNet's shelf is a nicety: the book's in the bag anyway */ }
  }
  function openGuide() { openPages(guidePages(), Core.HOW_TO_PLAY.title, 0, "gh-guide"); guideToScribe(); }
  everySecond("guideshelf", () => { const s = current().s; if (s && s.player && s.player.made && Core.hasGuide(s)) { guideToScribe(); return false; } return true; });
