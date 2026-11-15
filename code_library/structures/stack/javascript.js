// A stack, wrapping an Array (whose end is the cheap end).
"use strict";

class Stack {
  #items = [];
  push(item) { this.#items.push(item); }
  pop() {
    if (!this.#items.length) throw new RangeError("pop from empty stack");
    return this.#items.pop();
  }
  peek() {
    if (!this.#items.length) throw new RangeError("peek at empty stack");
    return this.#items[this.#items.length - 1];
  }
  get size() { return this.#items.length; }
  isEmpty() { return this.#items.length === 0; }
}

const PAIRS = { ")": "(", "]": "[", "}": "{" };

/** True if every bracket in `text` is closed in the right order. */
function balanced(text) {
  const stack = new Stack();
  for (const ch of text) {
    if ("([{".includes(ch)) stack.push(ch);
    else if (ch in PAIRS && (stack.isEmpty() || stack.pop() !== PAIRS[ch])) return false;
  }
  return stack.isEmpty();
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const s = new Stack();
[1, 2, 3].forEach((n) => s.push(n));
assert(s.peek() === 3 && s.size === 3, "peek");
assert([s.pop(), s.pop(), s.pop()].join() === "3,2,1", "last in, first out");
let threw = false;
try { s.pop(); } catch (e) { threw = true; }
assert(threw, "pop from empty throws");
assert(balanced("function f(x) { return [x, {a: (2)}]; }"), "balanced");
assert(!balanced("(]") && !balanced("((") && !balanced(")("), "unbalanced");
console.log("Stack: all checks passed");

module.exports = { Stack, balanced };
