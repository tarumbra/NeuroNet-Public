// A directed, weighted graph as an adjacency list, with BFS, DFS, Dijkstra
// and a topological sort. (Dijkstra uses a small binary heap.)
"use strict";

class Graph {
  constructor(directed = true) { this.adj = new Map(); this.directed = directed; }

  addEdge(a, b, weight = 1) {
    if (!this.adj.has(a)) this.adj.set(a, new Map());
    if (!this.adj.has(b)) this.adj.set(b, new Map());
    this.adj.get(a).set(b, weight);
    if (!this.directed) this.adj.get(b).set(a, weight);
  }

  /** Vertices in order of distance (edge count) from start. */
  bfs(start) {
    const seen = new Set([start]), order = [], queue = [start];
    for (let i = 0; i < queue.length; i++) {      // an index, not shift(): O(1)
      const v = queue[i];
      order.push(v);
      for (const n of this.adj.get(v).keys()) {
        if (!seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    return order;
  }

  /** As deep as possible first -- the same loop, with a stack. */
  dfs(start) {
    const seen = new Set(), order = [], stack = [start];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      order.push(v);
      stack.push(...[...this.adj.get(v).keys()].reverse());
    }
    return order;
  }

  /** Dijkstra: {cost, path} of the cheapest route. */
  shortestPath(start, goal) {
    const best = new Map([[start, 0]]), prev = new Map();
    const heap = [[0, start]];
    const push = (item) => {
      heap.push(item);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          let s = i;
          for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c][0] < heap[s][0]) s = c;
          if (s === i) break;
          [heap[s], heap[i]] = [heap[i], heap[s]]; i = s;
        }
      }
      return top;
    };
    while (heap.length) {
      const [cost, v] = pop();
      if (v === goal) {
        const path = [v];
        for (let x = v; prev.has(x);) { x = prev.get(x); path.push(x); }
        return { cost, path: path.reverse() };
      }
      if (cost > best.get(v)) continue;            // a stale, longer entry
      for (const [n, w] of this.adj.get(v)) {
        if (cost + w < (best.has(n) ? best.get(n) : Infinity)) {
          best.set(n, cost + w); prev.set(n, v); push([cost + w, n]);
        }
      }
    }
    return { cost: Infinity, path: [] };
  }

  /** Every vertex after the ones pointing to it (Kahn's algorithm). */
  topologicalOrder() {
    const incoming = new Map([...this.adj.keys()].map((v) => [v, 0]));
    for (const edges of this.adj.values()) for (const n of edges.keys()) incoming.set(n, incoming.get(n) + 1);
    const ready = [...incoming].filter(([, k]) => k === 0).map(([v]) => v), order = [];
    for (let i = 0; i < ready.length; i++) {
      const v = ready[i];
      order.push(v);
      for (const n of this.adj.get(v).keys()) {
        incoming.set(n, incoming.get(n) - 1);
        if (incoming.get(n) === 0) ready.push(n);
      }
    }
    if (order.length !== this.adj.size) throw new Error("the graph has a cycle");
    return order;
  }
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const g = new Graph(false);
[["A", "B", 4], ["A", "C", 1], ["C", "B", 2], ["B", "D", 1], ["C", "D", 6]].forEach((e) => g.addEdge(...e));
assert(g.bfs("A").join() === "A,B,C,D", "bfs");
assert(g.dfs("A").join() === "A,B,C,D", "dfs");
const route = g.shortestPath("A", "D");
assert(route.cost === 4 && route.path.join() === "A,C,B,D", "the long way is cheaper");
const deps = new Graph();
[["models", "views"], ["utils", "models"], ["utils", "views"], ["views", "app"]].forEach((e) => deps.addEdge(...e));
assert(deps.topologicalOrder().join() === "utils,models,views,app", "topological order");
deps.addEdge("app", "utils");
let threw = false;
try { deps.topologicalOrder(); } catch (e) { threw = true; }
assert(threw, "a cycle is found");
console.log("Graph: all checks passed");

module.exports = { Graph };
