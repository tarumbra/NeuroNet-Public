// A dynamic array: a fixed-size block replaced by one twice as big when it
// fills. JavaScript's Array already does this; this shows how.
"use strict";

class DynamicArray {
  constructor() {
    this.capacity = 1;
    this.size = 0;
    this.slots = new Array(this.capacity);   // stands in for raw memory
  }

  get length() { return this.size; }

  get(index) { return this.slots[this.#check(index)]; }

  set(index, value) { this.slots[this.#check(index)] = value; }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.size; i++) yield this.slots[i];
  }

  push(value) {
    if (this.size === this.capacity) this.#grow(2 * this.capacity); // O(1) amortised
    this.slots[this.size++] = value;
  }

  insert(index, value) {
    if (index < 0 || index > this.size) throw new RangeError(`index ${index}`);
    if (this.size === this.capacity) this.#grow(2 * this.capacity);
    for (let i = this.size; i > index; i--) this.slots[i] = this.slots[i - 1]; // O(n)
    this.slots[index] = value;
    this.size++;
  }

  pop(index = this.size - 1) {
    if (this.size === 0) throw new RangeError("pop from empty array");
    index = this.#check(index);
    const value = this.slots[index];
    for (let i = index; i < this.size - 1; i++) this.slots[i] = this.slots[i + 1];
    this.slots[--this.size] = undefined;      // don't keep it alive
    if (this.size > 0 && this.size <= this.capacity / 4) this.#grow(this.capacity / 2);
    return value;
  }

  #check(index) {
    if (index < 0) index += this.size;
    if (index < 0 || index >= this.size) throw new RangeError(`index ${index}`);
    return index;
  }

  #grow(capacity) {
    const slots = new Array(capacity);
    for (let i = 0; i < this.size; i++) slots[i] = this.slots[i];
    this.slots = slots;
    this.capacity = capacity;
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const a = new DynamicArray();
for (let n = 0; n < 10; n++) a.push(n);
assert(a.length === 10 && a.get(0) === 0 && a.get(-1) === 9, "push and get");
assert(a.capacity === 16, "doubles: 1, 2, 4, 8, 16");
a.insert(0, -1);
assert([...a].join() === [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].join(), "insert at front");
assert(a.pop(0) === -1 && a.pop() === 9, "pop");
a.set(0, 100);
assert(a.get(0) === 100, "set");
while (a.length > 1) a.pop();
assert(a.capacity < 16, "shrinks when mostly empty");
let threw = false;
try { a.get(5); } catch (e) { threw = e instanceof RangeError; }
assert(threw, "out of range throws");
console.log("DynamicArray: all checks passed");

module.exports = { DynamicArray };
