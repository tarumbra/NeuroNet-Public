"""Union-find with path compression and union by size."""


class UnionFind:
    def __init__(self, items=()):
        self.parent = {}
        self.size = {}
        self.groups = 0
        for item in items:
            self.add(item)

    def add(self, x):
        if x not in self.parent:
            self.parent[x] = x
            self.size[x] = 1
            self.groups += 1

    def find(self, x):
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:           # path compression
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b):
        """Merge the groups; False if they were already one."""
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.size[ra] < self.size[rb]:       # union by size
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        self.groups -= 1
        return True

    def connected(self, a, b):
        return self.find(a) == self.find(b)


def count_islands(grid):
    """A use: count groups of '#' that touch up/down/left/right."""
    uf = UnionFind((r, c) for r, row in enumerate(grid) for c, ch in enumerate(row) if ch == "#")
    for r, c in list(uf.parent):
        for nr, nc in ((r + 1, c), (r, c + 1)):
            if (nr, nc) in uf.parent:
                uf.union((r, c), (nr, nc))
    return uf.groups


if __name__ == "__main__":
    uf = UnionFind(range(10))
    assert uf.groups == 10
    uf.union(1, 2); uf.union(3, 4); uf.union(2, 4)
    assert uf.connected(1, 3) and not uf.connected(1, 5)
    assert not uf.union(1, 4), "already together"
    assert uf.groups == 7
    assert count_islands(["##..#",
                          "#...#",
                          "..#..",
                          "....."]) == 3
    print("UnionFind: all checks passed")
