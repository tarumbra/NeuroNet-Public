"""A min-heap stored in a list: the children of i are 2i+1 and 2i+2."""


class MinHeap:
    def __init__(self, items=()):
        self._a = list(items)
        for i in reversed(range(len(self._a) // 2)):   # heapify: O(n)
            self._down(i)

    def __len__(self):
        return len(self._a)

    def peek(self):
        if not self._a:
            raise IndexError("peek at empty heap")
        return self._a[0]

    def push(self, item):
        self._a.append(item)
        self._up(len(self._a) - 1)

    def pop(self):
        if not self._a:
            raise IndexError("pop from empty heap")
        top, last = self._a[0], self._a.pop()
        if self._a:
            self._a[0] = last
            self._down(0)
        return top

    def _up(self, i):
        a = self._a
        while i > 0:
            parent = (i - 1) // 2
            if a[i] >= a[parent]:
                break
            a[i], a[parent] = a[parent], a[i]
            i = parent

    def _down(self, i):
        a, n = self._a, len(self._a)
        while True:
            small = i
            for child in (2 * i + 1, 2 * i + 2):
                if child < n and a[child] < a[small]:
                    small = child
            if small == i:
                return
            a[i], a[small] = a[small], a[i]
            i = small


def k_smallest(items, k):
    """A use: the k smallest items, in order."""
    heap = MinHeap(items)
    return [heap.pop() for _ in range(min(k, len(heap)))]


if __name__ == "__main__":
    import random
    data = random.Random(7).sample(range(1000), 200)
    h = MinHeap()
    for x in data:
        h.push(x)
    assert h.peek() == min(data)
    assert [h.pop() for _ in range(len(h))] == sorted(data), "comes out sorted"
    assert k_smallest([5, 1, 4, 2, 3], 3) == [1, 2, 3]
    tasks = MinHeap([(2, 0, "write"), (1, 1, "plan"), (2, 2, "test")])
    assert [tasks.pop()[2] for _ in range(3)] == ["plan", "write", "test"], "ties keep order"
    print("MinHeap: all checks passed")
