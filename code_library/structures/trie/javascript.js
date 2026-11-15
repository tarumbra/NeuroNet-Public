// A trie: words stored letter by letter, shared prefixes shared.
"use strict";

class TrieNode {
  constructor() { this.children = new Map(); this.end = false; }
}

class Trie {
  constructor() { this.root = new TrieNode(); this.size = 0; }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
    }
    if (!node.end) { node.end = true; this.size++; }
  }

  #walk(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }

  has(word) { const n = this.#walk(word); return !!n && n.end; }

  startsWith(prefix) { return this.#walk(prefix) !== null; }

  /** Every word beginning with `prefix`, alphabetically. */
  complete(prefix, limit = Infinity) {
    const out = [];
    const walk = (node, path) => {
      if (out.length >= limit) return;
      if (node.end) out.push(prefix + path);
      for (const ch of [...node.children.keys()].sort()) walk(node.children.get(ch), path + ch);
    };
    const start = this.#walk(prefix);
    if (start) walk(start, "");
    return out;
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const t = new Trie();
["car", "cart", "cat", "cow", "dog", "car"].forEach((w) => t.insert(w));
assert(t.size === 5, "a repeat isn't counted twice");
assert(t.has("cat") && !t.has("ca") && t.startsWith("ca"), "has / startsWith");
assert(t.complete("ca").join() === "car,cart,cat", "complete");
assert(t.complete("c", 2).join() === "car,cart", "limit");
assert(t.complete("x").length === 0, "no matches");
console.log("Trie: all checks passed");

module.exports = { Trie };
