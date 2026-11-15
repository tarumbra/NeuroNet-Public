// A hash map with separate chaining and resizing. (Use Map in real code.)
"use strict";

/** A string hash (FNV-1a). Real engines hash every kind of key; this one
    takes strings and numbers, by their text. */
function hash(key) {
  let h = 0x811c9dc5;
  for (const ch of String(key)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

class HashMap {
  constructor(buckets = 8) {
    this.buckets = Array.from({ length: buckets }, () => []);
    this.size = 0;
  }

  #bucket(key) { return this.buckets[hash(key) % this.buckets.length]; }

  set(key, value) {
    const bucket = this.#bucket(key);
    const pair = bucket.find((p) => p[0] === key);
    if (pair) { pair[1] = value; return this; }    // replace, don't duplicate
    bucket.push([key, value]);
    if (++this.size / this.buckets.length > 0.75) this.#resize(2 * this.buckets.length);
    return this;
  }

  get(key) {
    const pair = this.#bucket(key).find((p) => p[0] === key);
    return pair ? pair[1] : undefined;
  }

  has(key) { return this.#bucket(key).some((p) => p[0] === key); }

  delete(key) {
    const bucket = this.#bucket(key);
    const i = bucket.findIndex((p) => p[0] === key);
    if (i === -1) return false;
    bucket.splice(i, 1);
    this.size--;
    return true;
  }

  *entries() { for (const bucket of this.buckets) yield* bucket; }

  #resize(count) {
    const old = [...this.entries()];
    this.buckets = Array.from({ length: count }, () => []);
    for (const [k, v] of old) this.#bucket(k).push([k, v]);
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const m = new HashMap(2);
for (let n = 0; n < 100; n++) m.set("key" + n, n);
assert(m.size === 100 && m.get("key42") === 42, "set and get");
assert(m.buckets.length >= 100 / 0.75, "grew to keep buckets short");
m.set("key42", "changed");
assert(m.get("key42") === "changed" && m.size === 100, "replaces, doesn't duplicate");
assert(m.delete("key42") && !m.has("key42") && !m.delete("key42"), "delete");
assert(m.get("nope") === undefined, "missing key");
const values = [...m.entries()].map(([, v]) => v).sort((a, b) => a - b);
assert(values.length === 99 && values[0] === 0 && values[98] === 99, "every pair survives resizing");
console.log("HashMap: all checks passed");

module.exports = { HashMap, hash };
