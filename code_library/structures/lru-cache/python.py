"""An LRU cache: a dict for finding, a doubly linked list for order."""


class _Node:
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key=None, value=None):
        self.key, self.value = key, value
        self.prev = self.next = None


class LRUCache:
    def __init__(self, capacity):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self.capacity = capacity
        self.map = {}
        self.head, self.tail = _Node(), _Node()  # sentinels: no edge cases
        self.head.next, self.tail.prev = self.tail, self.head

    def _unlink(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _push_front(self, node):
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key, default=None):
        node = self.map.get(key)
        if node is None:
            return default
        self._unlink(node)
        self._push_front(node)          # using it makes it recent
        return node.value

    def put(self, key, value):
        node = self.map.get(key)
        if node:
            node.value = value
            self._unlink(node)
        else:
            node = self.map[key] = _Node(key, value)
            if len(self.map) > self.capacity:
                oldest = self.tail.prev
                self._unlink(oldest)
                del self.map[oldest.key]
        self._push_front(node)

    def keys(self):
        """Most recent first."""
        node, out = self.head.next, []
        while node is not self.tail:
            out.append(node.key)
            node = node.next
        return out

    def __len__(self):
        return len(self.map)


if __name__ == "__main__":
    c = LRUCache(2)
    c.put("a", 1); c.put("b", 2)
    assert c.get("a") == 1, "a is now the most recent"
    c.put("c", 3)                       # evicts b, the least recent
    assert c.get("b") is None and c.keys() == ["c", "a"]
    c.put("a", 10)
    assert c.get("a") == 10 and len(c) == 2
    c.put("d", 4)                       # evicts c
    assert c.keys() == ["d", "a"]
    assert len(c.map) == len(c.keys()), "the map and the list agree"
    print("LRUCache: all checks passed")
