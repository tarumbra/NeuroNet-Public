// A FIFO queue on a ring buffer: O(1) at both ends. Array.shift() is O(n).
"use strict";

class Queue {
  constructor(capacity = 4) {
    this.slots = new Array(Math.max(1, capacity));
    this.head = 0;    // index of the oldest item
    this.size = 0;
  }

  enqueue(item) {
    if (this.size === this.slots.length) this.#resize(2 * this.slots.length);
    this.slots[(this.head + this.size) % this.slots.length] = item;
    this.size++;
  }

  dequeue() {
    if (!this.size) throw new RangeError("dequeue from empty queue");
    const item = this.slots[this.head];
    this.slots[this.head] = undefined;
    this.head = (this.head + 1) % this.slots.length;
    this.size--;
    return item;
  }

  peek() {
    if (!this.size) throw new RangeError("peek at empty queue");
    return this.slots[this.head];
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.size; i++) yield this.slots[(this.head + i) % this.slots.length];
  }

  #resize(capacity) {
    // Unroll the ring: the oldest item goes to index 0.
    const slots = [...this];
    slots.length = capacity;
    this.slots = slots;
    this.head = 0;
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const q = new Queue(2);
for (let n = 0; n < 5; n++) q.enqueue(n);
assert(q.size === 5 && q.peek() === 0, "enqueue");
assert(q.dequeue() === 0 && q.dequeue() === 1, "first in, first out");
for (let n = 5; n < 9; n++) q.enqueue(n);   // wraps round the end
assert([...q].join() === "2,3,4,5,6,7,8", "wraps");
const out = [];
while (q.size) out.push(q.dequeue());
assert(out.join() === "2,3,4,5,6,7,8", "drains in order");
let threw = false;
try { q.dequeue(); } catch (e) { threw = true; }
assert(threw, "dequeue from empty throws");
console.log("Queue: all checks passed");

module.exports = { Queue };
