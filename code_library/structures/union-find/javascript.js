// Union-find with path compression and union by size.
"use strict";

class UnionFind {
  constructor(items = []) {
    this.parent = new Map();
    this.size = new Map();
    this.groups = 0;
    for (const x of items) this.add(x);
  }

  add(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); this.size.set(x, 1); this.groups++; }
  }

  find(x) {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    while (this.parent.get(x) !== root) {        // path compression
      const next = this.parent.get(x);
      this.parent.set(x, root);
      x = next;
    }
    return root;
  }

  /** Merge the groups; false if they were already one. */
  union(a, b) {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.size.get(ra) < this.size.get(rb)) [ra, rb] = [rb, ra];  // union by size
    this.parent.set(rb, ra);
    this.size.set(ra, this.size.get(ra) + this.size.get(rb));
    this.groups--;
    return true;
  }

  connected(a, b) { return this.find(a) === this.find(b); }
}

/** A use: count groups of '#' that touch up/down/left/right. */
function countIslands(grid) {
  const key = (r, c) => `${r},${c}`;
  const uf = new UnionFind();
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "#") uf.add(key(r, c)); }));
  grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== "#") return;
    if (grid[r + 1] && grid[r + 1][c] === "#") uf.union(key(r, c), key(r + 1, c));
    if (row[c + 1] === "#") uf.union(key(r, c), key(r, c + 1));
  }));
  return uf.groups;
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const uf = new UnionFind([...Array(10).keys()]);
assert(uf.groups === 10, "ten groups");
uf.union(1, 2); uf.union(3, 4); uf.union(2, 4);
assert(uf.connected(1, 3) && !uf.connected(1, 5), "connected");
assert(!uf.union(1, 4), "already together");
assert(uf.groups === 7, "seven groups");
assert(countIslands(["##..#", "#...#", "..#..", "....."]) === 3, "islands");
console.log("UnionFind: all checks passed");

module.exports = { UnionFind, countIslands };
