// An (unbalanced) binary search tree of unique keys with values.
"use strict";

class Node {
  constructor(key, value) { this.key = key; this.value = value; this.left = this.right = null; }
}

class BST {
  constructor() { this.root = null; this.size = 0; }

  insert(key, value) {
    const go = (node) => {
      if (!node) { this.size++; return new Node(key, value); }
      if (key < node.key) node.left = go(node.left);
      else if (key > node.key) node.right = go(node.right);
      else node.value = value;            // same key: replace the value
      return node;
    };
    this.root = go(this.root);
  }

  find(key) {
    let node = this.root;
    while (node) {
      if (key === node.key) return node.value;
      node = key < node.key ? node.left : node.right;
    }
    return undefined;
  }

  has(key) {
    let node = this.root;
    while (node && node.key !== key) node = key < node.key ? node.left : node.right;
    return !!node;
  }

  delete(key) { this.root = this.#delete(this.root, key); }

  #delete(node, key) {
    if (!node) throw new RangeError(`no key ${key}`);
    if (key < node.key) node.left = this.#delete(node.left, key);
    else if (key > node.key) node.right = this.#delete(node.right, key);
    else if (!node.left || !node.right) {     // 0 or 1 child: splice out
      this.size--;
      return node.left || node.right;
    } else {                                  // 2 children: borrow the successor
      let succ = node.right;
      while (succ.left) succ = succ.left;
      node.key = succ.key;
      node.value = succ.value;
      node.right = this.#delete(node.right, succ.key);
    }
    return node;
  }

  /** Keys in order, with an explicit stack instead of recursion. */
  *[Symbol.iterator]() {
    const stack = [];
    let node = this.root;
    while (stack.length || node) {
      while (node) { stack.push(node); node = node.left; }
      node = stack.pop();
      yield node.key;
      node = node.right;
    }
  }

  height(node = this.root) {
    return node ? 1 + Math.max(this.height(node.left), this.height(node.right)) : 0;
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const t = new BST();
[8, 3, 10, 1, 6, 14, 4, 7, 13].forEach((k) => t.insert(k, String(k)));
assert([...t].join() === "1,3,4,6,7,8,10,13,14", "in-order walk is sorted");
assert(t.find(6) === "6" && !t.has(5), "find");
t.delete(3); t.delete(14); t.delete(1);   // two children, one child, a leaf
assert([...t].join() === "4,6,7,8,10,13" && t.size === 6, "delete");
const skewed = new BST();
for (let k = 1; k <= 50; k++) skewed.insert(k);
assert(skewed.height() === 50, "sorted input makes a linked list");
console.log("BST: all checks passed");

module.exports = { BST };
