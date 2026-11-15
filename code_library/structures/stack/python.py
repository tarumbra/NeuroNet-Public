"""A stack, wrapping a Python list (whose end is the cheap end)."""


class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)

    def pop(self):
        if not self._items:
            raise IndexError("pop from empty stack")
        return self._items.pop()

    def peek(self):
        if not self._items:
            raise IndexError("peek at empty stack")
        return self._items[-1]

    def __len__(self):
        return len(self._items)

    def __bool__(self):
        return bool(self._items)


PAIRS = {")": "(", "]": "[", "}": "{"}


def balanced(text):
    """True if every bracket in `text` is closed in the right order."""
    stack = Stack()
    for ch in text:
        if ch in "([{":
            stack.push(ch)
        elif ch in PAIRS:
            if not stack or stack.pop() != PAIRS[ch]:
                return False
    return not stack


if __name__ == "__main__":
    s = Stack()
    for n in (1, 2, 3):
        s.push(n)
    assert s.peek() == 3 and len(s) == 3
    assert [s.pop(), s.pop(), s.pop()] == [3, 2, 1], "last in, first out"
    try:
        s.pop()
        raise AssertionError("expected IndexError")
    except IndexError:
        pass
    assert balanced("def f(x): return [x, {1: (2)}]")
    assert not balanced("(]") and not balanced("((") and not balanced(")(")
    print("Stack: all checks passed")
