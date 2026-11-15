/* ==========================================================================
   Algorithm — syntax highlighting.

   WHY THIS IS HAND-WRITTEN. CodeMirror and Monaco are the obvious answers
   and both were unavailable: Algorithm has to work with no network, and
   bundling a megabyte of editor to colour five languages is a poor trade
   for an app whose whole point is being small and local.

   HOW IT WORKS. One ordered alternation per language, scanned left to
   right. Order is the entire design: comments and strings are matched
   before anything else, so the word `if` inside a string stays a string,
   and `#` inside a Python string does not start a comment. Every pattern is
   anchored and consumes at least one character, so the scanner cannot stall.

   WHAT IT DELIBERATELY DOES NOT DO. It is not a parser. It will not tell
   you that a brace is unbalanced, and it colours a Rust lifetime the same
   way whether or not it is valid. That is the right trade for an editor:
   highlighting has to survive half-typed code, and a parser that fails on
   invalid input would leave the screen colourless exactly while you are
   writing.
   ========================================================================== */
window.AL = window.AL || {};

AL.Highlight = (() => {
  "use strict";

  const KEYWORDS = {
    python: ["False", "None", "True", "and", "as", "assert", "async", "await",
      "break", "class", "continue", "def", "del", "elif", "else", "except",
      "finally", "for", "from", "global", "if", "import", "in", "is",
      "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
      "while", "with", "yield", "match", "case"],
    javascript: ["async", "await", "break", "case", "catch", "class", "const",
      "continue", "debugger", "default", "delete", "do", "else", "export",
      "extends", "finally", "for", "function", "if", "import", "in",
      "instanceof", "let", "new", "of", "return", "static", "super",
      "switch", "this", "throw", "try", "typeof", "var", "void", "while",
      "with", "yield", "true", "false", "null", "undefined"],
    rust: ["as", "async", "await", "break", "const", "continue", "crate",
      "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl",
      "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref",
      "return", "self", "Self", "static", "struct", "super", "trait", "true",
      "type", "unsafe", "use", "where", "while"],
    css: [],
    html: [],
  };

  const BUILTINS = {
    python: ["abs", "all", "any", "bool", "dict", "enumerate", "float", "int",
      "len", "list", "max", "min", "open", "print", "range", "set", "sorted",
      "str", "sum", "tuple", "type", "zip", "isinstance", "super", "object"],
    javascript: ["Array", "Boolean", "Date", "Error", "JSON", "Map", "Math",
      "Number", "Object", "Promise", "RegExp", "Set", "String", "Symbol",
      "console", "document", "window", "fetch", "parseInt", "parseFloat"],
    rust: ["Box", "Option", "Result", "String", "Vec", "HashMap", "HashSet",
      "Some", "None", "Ok", "Err", "i8", "i16", "i32", "i64", "i128",
      "isize", "u8", "u16", "u32", "u64", "u128", "usize", "f32", "f64",
      "bool", "char", "str", "println", "format", "vec"],
    css: [],
    html: [],
  };

  const word = (list) => list.length
    ? new RegExp(`^(?:${list.join("|")})\\b`) : null;

  /* Each rule is [type, regex]. Tried in order; first match wins. Every
     regex is anchored at the start of the remaining text. */
  function rulesFor(language) {
    const kw = word(KEYWORDS[language] || []);
    const bi = word(BUILTINS[language] || []);

    const common = [
      ["space", /^\s+/],
    ];

    if (language === "python") {
      return [
        ...common,
        ["comment", /^#[^\n]*/],
        // Triple-quoted first: a docstring starts with what looks like an
        // empty string to a shorter pattern.
        ["string", /^[rbfu]{0,2}"""[\s\S]*?(?:"""|$)/i],
        ["string", /^[rbfu]{0,2}'''[\s\S]*?(?:'''|$)/i],
        ["string", /^[rbfu]{0,2}"(?:\\.|[^"\\\n])*"?/i],
        ["string", /^[rbfu]{0,2}'(?:\\.|[^'\\\n])*'?/i],
        ["decorator", /^@[A-Za-z_][\w.]*/],
        ["number", /^\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?j?/],
        ["keyword", kw],
        ["builtin", bi],
        ["def", /^(?<=)[A-Za-z_]\w*(?=\s*\()/],
        ["name", /^[A-Za-z_]\w*/],
        ["punct", /^[^\w\s]/],
      ].filter((r) => r[1]);
    }

    if (language === "javascript") {
      return [
        ...common,
        ["comment", /^\/\/[^\n]*/],
        ["comment", /^\/\*[\s\S]*?(?:\*\/|$)/],
        ["string", /^`(?:\\.|[^`\\])*`?/],
        ["string", /^"(?:\\.|[^"\\\n])*"?/],
        ["string", /^'(?:\\.|[^'\\\n])*'?/],
        ["number", /^\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?/],
        ["keyword", kw],
        ["builtin", bi],
        ["def", /^[A-Za-z_$][\w$]*(?=\s*\()/],
        ["name", /^[A-Za-z_$][\w$]*/],
        ["punct", /^[^\w\s]/],
      ].filter((r) => r[1]);
    }

    if (language === "rust") {
      return [
        ...common,
        ["comment", /^\/\/[^\n]*/],
        ["comment", /^\/\*[\s\S]*?(?:\*\/|$)/],
        ["attr", /^#!?\[[^\]]*\]?/],
        ["string", /^r#*"[\s\S]*?"#*/],
        ["string", /^"(?:\\.|[^"\\])*"?/],
        // A lifetime looks like a character literal's opening quote, so it
        // has to be tried first or every 'a becomes an unterminated char.
        ["lifetime", /^'[A-Za-z_]\w*(?!')/],
        ["string", /^'(?:\\.|[^'\\])'?/],
        ["macro", /^[A-Za-z_]\w*!/],
        ["number", /^\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?:[iuf](?:8|16|32|64|128|size))?/],
        ["keyword", kw],
        ["builtin", bi],
        ["def", /^[A-Za-z_]\w*(?=\s*\()/],
        ["name", /^[A-Za-z_]\w*/],
        ["punct", /^[^\w\s]/],
      ].filter((r) => r[1]);
    }

    if (language === "css") {
      return [
        ...common,
        ["comment", /^\/\*[\s\S]*?(?:\*\/|$)/],
        ["string", /^"(?:\\.|[^"\\\n])*"?/],
        ["string", /^'(?:\\.|[^'\\\n])*'?/],
        ["atrule", /^@[A-Za-z-]+/],
        ["number", /^-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr|ch|pt)?/],
        ["colour", /^#[0-9A-Fa-f]{3,8}\b/],
        ["prop", /^--?[A-Za-z-][\w-]*(?=\s*:)/],
        ["selector", /^[.#][A-Za-z_][\w-]*/],
        ["name", /^[A-Za-z_][\w-]*/],
        ["punct", /^[^\w\s]/],
      ];
    }

    // HTML
    return [
      ...common,
      ["comment", /^<!--[\s\S]*?(?:-->|$)/],
      ["doctype", /^<!DOCTYPE[^>]*>?/i],
      ["tag", /^<\/?[A-Za-z][\w-]*/],
      ["string", /^"(?:[^"\\]|\\.)*"?/],
      ["string", /^'(?:[^'\\]|\\.)*'?/],
      ["attr", /^[A-Za-z-][\w-]*(?=\s*=)/],
      ["punct", /^[<>/=]/],
      ["text", /^[^<>"'\s]+/],
      ["punct", /^[^\w\s]/],
    ];
  }

  const LANGUAGES = {
    python: { label: "Python", ext: ["py", "pyw"], comment: "#" },
    javascript: { label: "JavaScript", ext: ["js", "mjs", "cjs"], comment: "//" },
    rust: { label: "Rust", ext: ["rs"], comment: "//" },
    html: { label: "HTML", ext: ["html", "htm"], comment: "<!--" },
    css: { label: "CSS", ext: ["css"], comment: "/*" },
    plain: { label: "Plain text", ext: ["txt", "md", "json", "toml"], comment: "#" },
  };

  /** Work out the language from a filename, defaulting to plain text. */
  function languageFor(filename) {
    const ext = String(filename || "").split(".").pop().toLowerCase();
    for (const [id, spec] of Object.entries(LANGUAGES)) {
      if (spec.ext.includes(ext)) return id;
    }
    return "plain";
  }

  const escapeHtml = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /**
   * Tokenise into [{type, text}]. Exposed separately from the HTML so it can
   * be tested without a DOM, which is how the tricky cases — a keyword
   * inside a string, an unterminated quote — actually get checked.
   */
  function tokenise(code, language) {
    const text = String(code ?? "");
    if (language === "plain" || !LANGUAGES[language]) {
      return text ? [{ type: "text", text }] : [];
    }
    const rules = rulesFor(language);
    const out = [];
    let rest = text;
    let guard = 0;

    while (rest.length) {
      // A rule that matched an empty string would spin forever; the guard is
      // belt and braces on top of every pattern consuming a character.
      if (++guard > 200000) {
        out.push({ type: "text", text: rest });
        break;
      }
      let matched = false;
      for (const [type, regex] of rules) {
        const m = regex.exec(rest);
        if (m && m[0].length) {
          out.push({ type, text: m[0] });
          rest = rest.slice(m[0].length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        out.push({ type: "text", text: rest[0] });
        rest = rest.slice(1);
      }
    }

    // Merge neighbours of the same type so the DOM has far fewer nodes; a
    // thousand-line file otherwise produces tens of thousands of spans.
    const merged = [];
    for (const token of out) {
      const last = merged[merged.length - 1];
      if (last && last.type === token.type) last.text += token.text;
      else merged.push({ ...token });
    }
    return merged;
  }

  /**
   * Highlighted HTML, optionally with search matches marked.
   *
   * `ranges` is [[start, end], ...] over the raw text. Marking them cannot
   * be a string replace on the finished HTML — that would match inside tag
   * names and class attributes, and would happily wrap half a span. So the
   * token stream is split at every range boundary instead, and each piece
   * is emitted separately. A match that straddles two tokens simply becomes
   * two marked pieces, which looks identical and stays valid.
   */
  function toHtml(code, language, ranges = null, currentIndex = -1) {
    const tokens = tokenise(code, language);
    if (!ranges || !ranges.length) {
      // not .map(renderToken): map hands over each token's position too, and
      // renderToken took it for a mark class -- <span class="1"> round every
      // token after the first (harmless to look at, but not meant)
      return tokens.map((t) => renderToken(t)).join("");
    }

    // Boundaries where a token must be cut, as offsets into the raw text.
    const cuts = new Set();
    for (const [start, end] of ranges) { cuts.add(start); cuts.add(end); }

    let offset = 0;
    const out = [];
    for (const token of tokens) {
      const tokenEnd = offset + token.text.length;
      const inner = [...cuts].filter((c) => c > offset && c < tokenEnd)
        .sort((a, b) => a - b);
      let from = offset;
      for (const cut of [...inner, tokenEnd]) {
        const piece = code.slice(from, cut);
        if (piece) {
          const hit = ranges.findIndex(([s, e]) => from >= s && cut <= e);
          out.push(renderToken({ type: token.type, text: piece },
                               hit === -1 ? null
                                 : (hit === currentIndex ? "m m-now" : "m")));
        }
        from = cut;
      }
      offset = tokenEnd;
    }
    return out.join("");
  }

  function renderToken(token, markClass = null) {
    const body = escapeHtml(token.text);
    const inner = (token.type === "space" || token.type === "text")
      ? body : `<span class="t-${token.type}">${body}</span>`;
    return markClass ? `<span class="${markClass}">${inner}</span>` : inner;
  }

  /**
   * Every match of `needle` in `text`, as [start, end] pairs.
   *
   * Plain text, not a regular expression: someone searching for `(` or `.`
   * in their code means those characters, and quietly treating them as
   * syntax would be baffling. Overlapping matches are skipped by advancing
   * past each hit.
   */
  function findRanges(text, needle, { caseSensitive = false } = {}) {
    if (!needle) return [];
    const haystack = caseSensitive ? text : text.toLowerCase();
    const target = caseSensitive ? needle : needle.toLowerCase();
    const out = [];
    let from = 0;
    while (out.length < 5000) {
      const at = haystack.indexOf(target, from);
      if (at === -1) break;
      out.push([at, at + target.length]);
      from = at + target.length;
    }
    return out;
  }

  return { LANGUAGES, languageFor, tokenise, toHtml, escapeHtml, findRanges };
})();
