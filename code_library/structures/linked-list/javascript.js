// A singly linked list with a tail reference.
"use strict";

class Node {
  constructor(value, next = null) { this.value = value; this.next = next; }
}

class LinkedList {
  constructor(items = []) {
    this.head = null;
    this.tail = null;
    this.size = 0;
    for (const item of items) this.append(item);
  }

  *[Symbol.iterator]() {
    for (let node = this.head; node; node = node.next) yield node.value;
  }

  prepend(value) {
    this.head = new Node(value, this.head);
    if (!this.tail) this.tail = this.head;
    this.size++;
  }

  append(value) {
    const node = new Node(value);
    if (!this.tail) this.head = this.tail = node;
    else { this.tail.next = node; this.tail = node; }
    this.size++;
  }

  popFront() {
    if (!this.head) throw new RangeError("pop from empty list");
    const node = this.head;
    this.head = node.next;
    if (!this.head) this.tail = null;   // the easily forgotten line
    this.size--;
    return node.value;
  }

  /** Remove the first node holding `value`; true if one was removed. */
  remove(value) {
    let prev = null, node = this.head;
    while (node && node.value !== value) { prev = node; node = node.next; }
    if (!node) return false;
    if (prev) prev.next = node.next; else this.head = node.next;
    if (node === this.tail) this.tail = prev;
    this.size--;
    return true;
  }

  /** In place, O(n) time, O(1) extra space. */
  reverse() {
    let prev = null, node = this.head;
    this.tail = this.head;
    while (node) { const next = node.next; node.next = prev; prev = node; node = next; }
    this.head = prev;
  }

  /** The invariants -- call after every operation in tests. */
  check() {
    let count = 0, last = null;
    for (let node = this.head; node; node = node.next) { count++; last = node; }
    if (count !== this.size) throw new Error("size matches the nodes");
    if (last !== this.tail) throw new Error("tail is the last node");
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const l = new LinkedList([1, 2, 3]);
l.check();
l.prepend(0); l.append(4); l.check();
assert([...l].join() === "0,1,2,3,4", "prepend and append");
assert(l.remove(4) && l.tail.value === 3, "removing the tail moves the tail"); l.check();
assert(!l.remove(99), "removing a missing value");
l.reverse(); l.check();
assert([...l].join() === "3,2,1,0", "reverse");
while (l.size) { l.popFront(); l.check(); }
assert(l.head === null && l.tail === null, "empty again");
l.append("again"); l.check();
console.log("LinkedList: all checks passed");

module.exports = { LinkedList };
