// A min-heap stored in an array: the children of i are 2i+1 and 2i+2.
// `less(a, b)` decides the order, so it works for any kind of item.
"use strict";

class MinHeap {
  constructor(items = [], less = (a, b) => a < b) {
    this.a = [...items];
    this.less = less;
    for (let i = Math.floor(this.a.length / 2) - 1; i >= 0; i--) this.#down(i); // O(n)
  }

  get size() { return this.a.length; }

  peek() {
    if (!this.a.length) throw new RangeError("peek at empty heap");
    return this.a[0];
  }

  push(item) { this.a.push(item); this.#up(this.a.length - 1); }

  pop() {
    if (!this.a.length) throw new RangeError("pop from empty heap");
    const top = this.a[0], last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this.#down(0); }
    return top;
  }

  #up(i) {
    const a = this.a;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  #down(i) {
    const a = this.a, n = a.length;
    for (;;) {
      let small = i;
      for (const child of [2 * i + 1, 2 * i + 2]) {
        if (child < n && this.less(a[child], a[small])) small = child;
      }
      if (small === i) return;
      [a[i], a[small]] = [a[small], a[i]];
      i = small;
    }
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const data = Array.from({ length: 200 }, (_, i) => (i * 7919) % 1000);
const h = new MinHeap();
data.forEach((x) => h.push(x));
assert(h.peek() === Math.min(...data), "peek is the smallest");
const out = [];
while (h.size) out.push(h.pop());
assert(out.join() === [...data].sort((a, b) => a - b).join(), "comes out sorted");
const tasks = new MinHeap([[2, 0, "write"], [1, 1, "plan"], [2, 2, "test"]],
  (x, y) => x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]));
assert([tasks.pop(), tasks.pop(), tasks.pop()].map((t) => t[2]).join() === "plan,write,test",
  "ties keep order");
console.log("MinHeap: all checks passed");

module.exports = { MinHeap };
