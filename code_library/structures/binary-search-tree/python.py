"""An (unbalanced) binary search tree of unique keys with values."""


class Node:
    __slots__ = ("key", "value", "left", "right")

    def __init__(self, key, value):
        self.key, self.value = key, value
        self.left = self.right = None


class BST:
    def __init__(self):
        self.root = None
        self.size = 0

    def insert(self, key, value=None):
        def go(node):
            if node is None:
                self.size += 1
                return Node(key, value)
            if key < node.key:
                node.left = go(node.left)
            elif key > node.key:
                node.right = go(node.right)
            else:
                node.value = value          # same key: replace the value
            return node
        self.root = go(self.root)

    def find(self, key):
        node = self.root
        while node:
            if key == node.key:
                return node.value
            node = node.left if key < node.key else node.right
        raise KeyError(key)

    def __contains__(self, key):
        try:
            self.find(key)
            return True
        except KeyError:
            return False

    def delete(self, key):
        self.root = self._delete(self.root, key)

    def _delete(self, node, key):
        if node is None:
            raise KeyError(key)
        if key < node.key:
            node.left = self._delete(node.left, key)
        elif key > node.key:
            node.right = self._delete(node.right, key)
        elif node.left is None or node.right is None:
            self.size -= 1
            return node.left or node.right      # 0 or 1 child: splice out
        else:
            succ = node.right                   # 2 children: borrow the successor
            while succ.left:
                succ = succ.left
            node.key, node.value = succ.key, succ.value
            node.right = self._delete(node.right, succ.key)
        return node

    def __iter__(self):
        """Keys in order, without recursion: an explicit stack."""
        stack, node = [], self.root
        while stack or node:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            yield node.key
            node = node.right

    def height(self):
        def h(node):
            return 0 if node is None else 1 + max(h(node.left), h(node.right))
        return h(self.root)


if __name__ == "__main__":
    t = BST()
    for k in (8, 3, 10, 1, 6, 14, 4, 7, 13):
        t.insert(k, str(k))
    assert list(t) == [1, 3, 4, 6, 7, 8, 10, 13, 14], "in-order walk is sorted"
    assert t.find(6) == "6" and 5 not in t
    t.delete(3)                       # two children
    t.delete(14)                      # one child
    t.delete(1)                       # leaf
    assert list(t) == [4, 6, 7, 8, 10, 13] and t.size == 6
    skewed = BST()
    for k in range(1, 51):
        skewed.insert(k)
    assert skewed.height() == 50, "sorted input makes a linked list"
    print("BST: all checks passed")
