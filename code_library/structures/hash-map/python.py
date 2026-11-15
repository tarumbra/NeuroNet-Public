"""A hash map with separate chaining and resizing."""


class HashMap:
    def __init__(self, buckets=8):
        self._buckets = [[] for _ in range(buckets)]
        self._size = 0

    def _bucket(self, key):
        return self._buckets[hash(key) % len(self._buckets)]

    def __setitem__(self, key, value):
        bucket = self._bucket(key)
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)    # replace, don't duplicate
                return
        bucket.append((key, value))
        self._size += 1
        if self._size / len(self._buckets) > 0.75:
            self._resize(2 * len(self._buckets))

    def __getitem__(self, key):
        for k, v in self._bucket(key):
            if k == key:
                return v
        raise KeyError(key)

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __delitem__(self, key):
        bucket = self._bucket(key)
        for i, (k, _) in enumerate(bucket):
            if k == key:
                del bucket[i]
                self._size -= 1
                return
        raise KeyError(key)

    def __contains__(self, key):
        return any(k == key for k, _ in self._bucket(key))

    def __len__(self):
        return self._size

    def items(self):
        for bucket in self._buckets:
            yield from bucket

    def _resize(self, count):
        old = list(self.items())
        self._buckets = [[] for _ in range(count)]
        for k, v in old:
            self._bucket(k).append((k, v))


if __name__ == "__main__":
    m = HashMap(buckets=2)
    for n in range(100):
        m["key%d" % n] = n
    assert len(m) == 100 and m["key42"] == 42
    assert len(m._buckets) >= 100 / 0.75, "grew to keep buckets short"
    m["key42"] = "changed"
    assert m["key42"] == "changed" and len(m) == 100, "replaces, doesn't duplicate"
    del m["key42"]
    assert "key42" not in m and m.get("key42", "gone") == "gone"
    try:
        m["nope"]
        raise AssertionError("expected KeyError")
    except KeyError:
        pass
    assert sorted(v for _, v in m.items()) == [n for n in range(100) if n != 42]
    print("HashMap: all checks passed")
