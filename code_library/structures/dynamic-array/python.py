"""A dynamic array: a fixed-size block that is replaced by one twice as big
when it fills. Python's list already does this (in C); this shows how."""


class DynamicArray:
    def __init__(self):
        self._capacity = 1
        self._size = 0
        self._slots = [None] * self._capacity   # stands in for raw memory

    def __len__(self):
        return self._size

    def __getitem__(self, index):
        return self._slots[self._check(index)]

    def __setitem__(self, index, value):
        self._slots[self._check(index)] = value

    def __iter__(self):
        for i in range(self._size):
            yield self._slots[i]

    def append(self, value):
        if self._size == self._capacity:
            self._grow(2 * self._capacity)          # doubling = O(1) amortised
        self._slots[self._size] = value
        self._size += 1

    def insert(self, index, value):
        if not 0 <= index <= self._size:
            raise IndexError(index)
        if self._size == self._capacity:
            self._grow(2 * self._capacity)
        for i in range(self._size, index, -1):      # shift right: O(n)
            self._slots[i] = self._slots[i - 1]
        self._slots[index] = value
        self._size += 1

    def pop(self, index=None):
        index = self._size - 1 if index is None else self._check(index)
        if self._size == 0:
            raise IndexError("pop from empty array")
        value = self._slots[index]
        for i in range(index, self._size - 1):      # shift left: O(n)
            self._slots[i] = self._slots[i + 1]
        self._size -= 1
        self._slots[self._size] = None              # don't keep it alive
        if 0 < self._size <= self._capacity // 4:   # shrink, but lazily
            self._grow(self._capacity // 2)
        return value

    def _check(self, index):
        if index < 0:
            index += self._size
        if not 0 <= index < self._size:
            raise IndexError(index)
        return index

    def _grow(self, capacity):
        slots = [None] * capacity
        for i in range(self._size):
            slots[i] = self._slots[i]
        self._slots, self._capacity = slots, capacity


if __name__ == "__main__":
    a = DynamicArray()
    for n in range(10):
        a.append(n)
    assert len(a) == 10 and a[0] == 0 and a[-1] == 9
    assert a._capacity == 16, "doubles: 1, 2, 4, 8, 16"
    a.insert(0, -1)
    assert list(a) == [-1] + list(range(10))
    assert a.pop(0) == -1 and a.pop() == 9
    a[0] = 100
    assert a[0] == 100
    while len(a) > 1:
        a.pop()
    assert a._capacity < 16, "shrinks when mostly empty"
    try:
        a[5]
        raise AssertionError("expected IndexError")
    except IndexError:
        pass
    print("DynamicArray: all checks passed")
