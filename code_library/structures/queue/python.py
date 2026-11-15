"""A FIFO queue on a ring buffer: O(1) at both ends, nothing ever shifts."""


class Queue:
    def __init__(self, capacity=4):
        self._slots = [None] * max(1, capacity)
        self._head = 0          # index of the oldest item
        self._size = 0

    def __len__(self):
        return self._size

    def enqueue(self, item):
        if self._size == len(self._slots):
            self._resize(2 * len(self._slots))
        self._slots[(self._head + self._size) % len(self._slots)] = item
        self._size += 1

    def dequeue(self):
        if not self._size:
            raise IndexError("dequeue from empty queue")
        item = self._slots[self._head]
        self._slots[self._head] = None
        self._head = (self._head + 1) % len(self._slots)
        self._size -= 1
        return item

    def peek(self):
        if not self._size:
            raise IndexError("peek at empty queue")
        return self._slots[self._head]

    def __iter__(self):
        for i in range(self._size):
            yield self._slots[(self._head + i) % len(self._slots)]

    def _resize(self, capacity):
        # Unroll the ring: the oldest item goes to index 0.
        self._slots = list(self) + [None] * (capacity - self._size)
        self._head = 0


if __name__ == "__main__":
    q = Queue(capacity=2)
    for n in range(5):
        q.enqueue(n)
    assert len(q) == 5 and q.peek() == 0
    assert [q.dequeue(), q.dequeue()] == [0, 1], "first in, first out"
    for n in range(5, 9):          # wraps round the end of the array
        q.enqueue(n)
    assert list(q) == [2, 3, 4, 5, 6, 7, 8]
    assert [q.dequeue() for _ in range(len(q))] == [2, 3, 4, 5, 6, 7, 8]
    try:
        q.dequeue()
        raise AssertionError("expected IndexError")
    except IndexError:
        pass
    print("Queue: all checks passed")
