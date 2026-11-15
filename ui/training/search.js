/* ==========================================================================
   CF.Search — one box across everything.

   Two kinds of term:

     #word   matches a tag, an exercise category or a body part, by prefix.
             Prefix, because the tags in use have spaces in them — "#max"
             finds "Max strength" without anyone having to type or quote the
             whole thing.

     word    matches names and the text inside records.

   All terms are ANDed. `#upper #biceps squat` means: tagged something
   starting "upper", tagged something starting "biceps", and the word
   "squat" somewhere in it.

   The point of `#` spanning tags, categories and body parts is that those
   are different fields on different record types, but they are the same
   idea to the person typing. `#push` should find the push exercises and the
   push-tagged sessions without them having to know which field is which.
   ========================================================================== */
CF.Search = (() => {
  "use strict";

  /* Every collection that can be searched, and how to read one of its
     records. `labels` is what `#` terms match; `text` is everything else. */
  const TYPES = [
    {
      id: "sessions", label: "Sessions", icon: "session", singular: "session",
      list: (doc) => doc.sessions || [],
      name: (r) => r.name,
      labels: (r) => r.tags || [],
      text: (r) => [r.notes, ...(r.items || []).map((i) => i.name)],
      sub: (r) => `${(r.items || []).length} exercises`,
    },
    {
      id: "circuits", label: "Circuits", icon: "circuit", singular: "circuit",
      list: (doc) => doc.circuits || [],
      name: (r) => r.name,
      labels: (r) => [...(r.tags || []), r.type].filter(Boolean),
      text: (r) => [r.notes, ...(r.stations || []).map((s) => s.name)],
      sub: (r) => `${(r.stations || []).length} stations`,
    },
    {
      id: "library", label: "Exercises", icon: "library", singular: "exercise",
      // The library is a map of category to a map of name to record, so it
      // is flattened into records carrying their own name and category.
      list: (doc) => {
        const out = [];
        for (const [category, items] of Object.entries(doc.exercises || {})) {
          for (const [name, rec] of Object.entries(items)) {
            out.push({ name, category, ...rec });
          }
        }
        return out;
      },
      name: (r) => r.name,
      labels: (r) => [r.category, ...(r.bodyParts || [])].filter(Boolean),
      text: (r) => [r.instructions],
      sub: (r) => r.category,
    },
    {
      id: "guides", label: "Guides", icon: "guide", singular: "guide",
      list: (doc) => doc.guides || [],
      name: (r) => r.name,
      labels: () => [],
      text: (r) => [String(r.bodyHtml || "").replace(/<[^>]+>/g, " ")],
      sub: () => "guide",
    },
    {
      id: "questionnaires", label: "Questionnaires", icon: "form",
      singular: "questionnaire",
      list: (doc) => doc.questionnaires || [],
      name: (r) => r.name,
      labels: () => [],
      text: (r) => (r.questions || []).map((q) => q.text),
      sub: (r) => `${(r.questions || []).length} questions`,
    },
    {
      id: "programs", label: "Programs", icon: "program", singular: "program",
      list: (doc) => doc.programs || [],
      name: (r) => r.name,
      labels: () => [],
      text: (r) => Object.values(r.overview || {}),
      sub: (r) => `${(r.mesocycles || []).length} blocks`,
    },
    {
      id: "lessonPlans", label: "Lesson plans", icon: "plan", singular: "lesson plan",
      list: (doc) => doc.lessonPlans || [],
      name: (r) => r.name,
      labels: () => [],
      text: (r) => [r.location, r.stores,
        ...(r.textBoxes || []).map((b) => `${b.title} ${String(b.bodyHtml || "")
          .replace(/<[^>]+>/g, " ")}`)],
      sub: (r) => r.location || "lesson plan",
    },
    {
      id: "athletes", label: "Athletes", icon: "people", singular: "athlete",
      list: (doc) => doc.athletes || [],
      name: (r) => r.name,
      labels: () => [],
      text: (r) => [r.email, r.notes],
      sub: (r) => r.email || "athlete",
    },
    {
      id: "equipment", label: "Equipment", icon: "kit", singular: "equipment",
      list: (doc) => doc.equipment || [],
      name: (r) => r.name,
      labels: () => [],
      text: () => [],
      sub: () => "equipment",
    },
    {
      id: "documents", label: "Documents", icon: "file", singular: "file",
      list: (doc) => doc.documents || [],
      name: (r) => r.originalName,
      // A category behaves like a tag here, so `#forms` finds them.
      labels: (r) => [r.category].filter(Boolean),
      text: (r) => [r.note],
      sub: (r) => r.category || "file",
    },
  ];

  const lower = (v) => String(v ?? "").toLowerCase();

  /** Split a query into `#` label terms and plain text terms. */
  function parse(query) {
    const labels = [];
    const words = [];
    for (const part of String(query || "").trim().split(/\s+/)) {
      if (!part) continue;
      if (part.startsWith("#") && part.length > 1) labels.push(lower(part.slice(1)));
      else if (!part.startsWith("#")) words.push(lower(part));
    }
    return { labels, words };
  }

  /** Build a searchable form of every record once per query. */
  function index(doc) {
    return TYPES.map((type) => ({
      type,
      records: type.list(doc).map((record) => {
        const labels = (type.labels(record) || []).filter(Boolean).map(String);
        const haystack = lower([
          type.name(record),
          ...labels,
          ...(type.text(record) || []).filter(Boolean),
        ].join(" "));
        return {
          record,
          name: type.name(record) || "",
          labels,
          labelsLower: labels.map(lower),
          haystack,
        };
      }),
    }));
  }

  /**
   * `limit` caps each group, so one type with hundreds of matches cannot
   * bury the others. The true count is reported separately.
   */
  function run(doc, query, { limit = 8 } = {}) {
    const { labels, words } = parse(query);
    if (!labels.length && !words.length) return { groups: [], total: 0, labels, words };

    const groups = [];
    let total = 0;

    for (const { type, records } of index(doc)) {
      const hits = records.filter((entry) => {
        // Every # term must match some label by prefix.
        for (const term of labels) {
          if (!entry.labelsLower.some((l) => l.startsWith(term))) return false;
        }
        // Every plain word must appear somewhere in the record.
        for (const word of words) {
          if (!entry.haystack.includes(word)) return false;
        }
        return true;
      });

      if (!hits.length) continue;

      // A name match is what you usually meant, so it sorts first.
      const firstWord = words[0] || "";
      hits.sort((a, b) => {
        const rank = (e) => {
          const n = lower(e.name);
          if (!firstWord) return 1;
          if (n === firstWord) return 0;
          if (n.startsWith(firstWord)) return 1;
          if (n.includes(firstWord)) return 2;
          return 3;
        };
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });

      total += hits.length;
      groups.push({
        type, count: hits.length,
        hits: hits.slice(0, limit),
        more: Math.max(0, hits.length - limit),
      });
    }

    return { groups, total, labels, words };
  }

  /** Every value a `#` term could match, for suggestions. */
  function allLabels(doc) {
    const set = new Set();
    for (const { type, records } of index(doc)) {
      void type;
      for (const entry of records) entry.labels.forEach((l) => set.add(l));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /** Suggestions for the `#` term currently being typed, if any. */
  function suggest(doc, query) {
    const match = String(query || "").match(/(?:^|\s)#([^\s]*)$/);
    if (!match) return null;
    const partial = lower(match[1]);
    const already = parse(query).labels.slice(0, -1);
    const options = allLabels(doc)
      .filter((l) => lower(l).startsWith(partial))
      .filter((l) => !already.includes(lower(l)))
      .slice(0, 10);
    return { partial, options };
  }

  /** Replace the `#` term being typed with a chosen label. */
  function complete(query, label) {
    // Labels contain spaces; the first word is enough to match by prefix and
    // keeps the query parseable.
    const token = String(label).split(/\s+/)[0];
    return String(query).replace(/(?:^|\s)#[^\s]*$/, (m) =>
      (m.startsWith(" ") ? " " : "") + "#" + token) + " ";
  }

  return { TYPES, parse, run, allLabels, suggest, complete };
})();
