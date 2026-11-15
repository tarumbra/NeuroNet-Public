// An LRU cache, two ways: the textbook design (a Map for finding, a doubly
// linked list for order), and the JavaScript shortcut (a Map remembers
// insertion order, so delete-then-set moves a key to the end).
"use strict";

class LRUCache {
  constructor(capacity) {
    if (capacity < 1) throw new RangeError("capacity must be at least 1");
    this.capacity = capacity;
    this.map = new Map();
    this.head = { prev: null, next: null };   // sentinels: no edge cases
    this.tail = { prev: this.head, next: null };
    this.head.next = this.tail;
  }

  #unlink(node) { node.prev.next = node.next; node.next.prev = node.prev; }

  #pushFront(node) {
    node.prev = this.head; node.next = this.head.next;
    this.head.next.prev = node; this.head.next = node;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.#unlink(node); this.#pushFront(node);   // using it makes it recent
    return node.value;
  }

  put(key, value) {
    let node = this.map.get(key);
    if (node) { node.value = value; this.#unlink(node); }
    else {
      node = { key, value, prev: null, next: null };
      this.map.set(key, node);
      if (this.map.size > this.capacity) {
        const oldest = this.tail.prev;
        this.#unlink(oldest);
        this.map.delete(oldest.key);
      }
    }
    this.#pushFront(node);
  }

  /** Most recent first. */
  keys() {
    const out = [];
    for (let n = this.head.next; n !== this.tail; n = n.next) out.push(n.key);
    return out;
  }
}

/** The shortcut: the same behaviour in a dozen lines, because Map keeps order. */
class MapLRU {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key); this.map.set(key, value);
    return value;
  }
  put(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value);
  }
  keys() { return [...this.map.keys()].reverse(); }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
for (const Cache of [LRUCache, MapLRU]) {
  const c = new Cache(2);
  c.put("a", 1); c.put("b", 2);
  assert(c.get("a") === 1, "a is now the most recent");
  c.put("c", 3);                              // evicts b
  assert(c.get("b") === undefined && c.keys().join() === "c,a", Cache.name + ": evicts the least recent");
  c.put("a", 10);
  assert(c.get("a") === 10, "update");
  c.put("d", 4);                              // evicts c
  assert(c.keys().join() === "d,a", Cache.name + ": order");
}
console.log("LRUCache: all checks passed");

module.exports = { LRUCache, MapLRU };
