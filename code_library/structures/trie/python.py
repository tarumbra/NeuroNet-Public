"""A trie: words stored letter by letter, shared prefixes shared."""


class Trie:
    def __init__(self):
        self.root = {}          # char -> child node; "$" marks a word's end
        self.size = 0

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        if "$" not in node:
            node["$"] = True
            self.size += 1

    def _walk(self, prefix):
        node = self.root
        for ch in prefix:
            node = node.get(ch)
            if node is None:
                return None
        return node

    def __contains__(self, word):
        node = self._walk(word)
        return node is not None and "$" in node

    def starts_with(self, prefix):
        return self._walk(prefix) is not None

    def complete(self, prefix, limit=None):
        """Every word beginning with `prefix`, alphabetically."""
        start = self._walk(prefix)
        out = []
        if start is None:
            return out

        def walk(node, path):
            if limit is not None and len(out) >= limit:
                return
            if "$" in node:
                out.append(prefix + path)
            for ch in sorted(k for k in node if k != "$"):
                walk(node[ch], path + ch)
        walk(start, "")
        return out


if __name__ == "__main__":
    t = Trie()
    for w in ("car", "cart", "cat", "cow", "dog", "car"):
        t.insert(w)
    assert t.size == 5, "a repeat isn't counted twice"
    assert "cat" in t and "ca" not in t and t.starts_with("ca")
    assert t.complete("ca") == ["car", "cart", "cat"]
    assert t.complete("c", limit=2) == ["car", "cart"]
    assert t.complete("x") == []
    print("Trie: all checks passed")
