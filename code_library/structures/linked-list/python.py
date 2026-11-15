"""A singly linked list with a tail reference."""


class Node:
    __slots__ = ("value", "next")

    def __init__(self, value, next=None):
        self.value = value
        self.next = next


class LinkedList:
    def __init__(self, items=()):
        self.head = None
        self.tail = None
        self.size = 0
        for item in items:
            self.append(item)

    def __len__(self):
        return self.size

    def __iter__(self):
        node = self.head
        while node:
            yield node.value
            node = node.next

    def prepend(self, value):
        self.head = Node(value, self.head)
        if self.tail is None:
            self.tail = self.head
        self.size += 1

    def append(self, value):
        node = Node(value)
        if self.tail is None:
            self.head = self.tail = node
        else:
            self.tail.next = node
            self.tail = node
        self.size += 1

    def pop_front(self):
        if self.head is None:
            raise IndexError("pop from empty list")
        node = self.head
        self.head = node.next
        if self.head is None:
            self.tail = None            # the easily forgotten line
        self.size -= 1
        return node.value

    def remove(self, value):
        """Remove the first node holding `value`. True if one was removed."""
        prev, node = None, self.head
        while node and node.value != value:
            prev, node = node, node.next
        if node is None:
            return False
        if prev is None:
            self.head = node.next
        else:
            prev.next = node.next
        if node is self.tail:
            self.tail = prev
        self.size -= 1
        return True

    def reverse(self):
        """In place, O(n) time, O(1) extra space -- the classic exercise."""
        prev, node = None, self.head
        self.tail = self.head
        while node:
            node.next, prev, node = prev, node, node.next
        self.head = prev

    def _check(self):
        """The invariants. Cheap enough to call after every operation in tests."""
        count, last, node = 0, None, self.head
        while node:
            count, last, node = count + 1, node, node.next
        assert count == self.size, "size matches the nodes"
        assert last is self.tail, "tail is the last node"


if __name__ == "__main__":
    l = LinkedList([1, 2, 3])
    l._check()
    l.prepend(0); l.append(4); l._check()
    assert list(l) == [0, 1, 2, 3, 4]
    assert l.remove(4) and l.tail.value == 3; l._check()
    assert not l.remove(99)
    l.reverse(); l._check()
    assert list(l) == [3, 2, 1, 0]
    while l:
        l.pop_front(); l._check()
    assert l.head is None and l.tail is None
    l.append("again"); l._check()
    print("LinkedList: all checks passed")
