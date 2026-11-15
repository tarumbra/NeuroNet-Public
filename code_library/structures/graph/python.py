"""A directed, weighted graph as an adjacency list, with BFS, DFS,
Dijkstra and a topological sort."""
import heapq
from collections import deque


class Graph:
    def __init__(self, directed=True):
        self.adj = {}           # vertex -> {neighbour: weight}
        self.directed = directed

    def add_edge(self, a, b, weight=1):
        self.adj.setdefault(a, {})[b] = weight
        self.adj.setdefault(b, {})
        if not self.directed:
            self.adj[b][a] = weight

    def bfs(self, start):
        """Vertices in order of distance (edge count) from start."""
        seen, order, queue = {start}, [], deque([start])
        while queue:
            v = queue.popleft()                 # queue: oldest first
            order.append(v)
            for n in self.adj[v]:
                if n not in seen:
                    seen.add(n)
                    queue.append(n)
        return order

    def dfs(self, start):
        """Vertices as deep as possible first -- the same loop, with a stack."""
        seen, order, stack = set(), [], [start]
        while stack:
            v = stack.pop()                     # stack: newest first
            if v in seen:
                continue
            seen.add(v)
            order.append(v)
            stack.extend(reversed(list(self.adj[v])))
        return order

    def shortest_path(self, start, goal):
        """Dijkstra: (cost, path) of the cheapest route, or (inf, [])."""
        best, prev = {start: 0}, {}
        heap = [(0, start)]
        while heap:
            cost, v = heapq.heappop(heap)
            if v == goal:
                path = [v]
                while v in prev:
                    v = prev[v]
                    path.append(v)
                return cost, path[::-1]
            if cost > best[v]:
                continue                        # a stale, longer entry
            for n, w in self.adj[v].items():
                if cost + w < best.get(n, float("inf")):
                    best[n], prev[n] = cost + w, v
                    heapq.heappush(heap, (cost + w, n))
        return float("inf"), []

    def topological_order(self):
        """Every vertex after the ones pointing to it (Kahn's algorithm)."""
        incoming = {v: 0 for v in self.adj}
        for v in self.adj:
            for n in self.adj[v]:
                incoming[n] += 1
        ready = deque(v for v, k in incoming.items() if k == 0)
        order = []
        while ready:
            v = ready.popleft()
            order.append(v)
            for n in self.adj[v]:
                incoming[n] -= 1
                if incoming[n] == 0:
                    ready.append(n)
        if len(order) != len(self.adj):
            raise ValueError("the graph has a cycle")
        return order


if __name__ == "__main__":
    g = Graph(directed=False)
    for a, b, w in [("A", "B", 4), ("A", "C", 1), ("C", "B", 2), ("B", "D", 1), ("C", "D", 6)]:
        g.add_edge(a, b, w)
    assert g.bfs("A") == ["A", "B", "C", "D"]
    assert g.dfs("A") == ["A", "B", "C", "D"]
    assert g.shortest_path("A", "D") == (4, ["A", "C", "B", "D"]), "the long way is cheaper"
    deps = Graph()
    for a, b in [("models", "views"), ("utils", "models"), ("utils", "views"), ("views", "app")]:
        deps.add_edge(a, b)
    assert deps.topological_order() == ["utils", "models", "views", "app"]
    deps.add_edge("app", "utils")
    try:
        deps.topological_order()
        raise AssertionError("expected a cycle")
    except ValueError:
        pass
    print("Graph: all checks passed")
