# Data Structures

## list

Ordered, mutable sequence. Backed by a dynamic array. Appending to the end is O(1) amortised. Inserting or deleting at the front or middle is O(n) because everything shifts.

**When to use:** when order matters and you need to add/remove from the end — e.g. a stack, a queue of results, iterating in sequence.

**Common operations:**
- `append(x)` — O(1), adds to end
- `insert(i, x)` — O(n), avoid for large lists
- `pop()` — O(1), removes from end
- `pop(0)` — O(n), avoid; use `deque` instead
- `in` — O(n) linear scan

> **Gotcha:** `list.insert(0, x)` and `list.pop(0)` are O(n). If you need fast front operations, use `collections.deque`.

## dict

Hash map. Keys must be hashable. Lookup, insert, and delete are O(1) average. Maintains insertion order since Python 3.7.

**When to use:** mapping keys to values, fast lookups by key, counting, grouping.

**Common operations:**
- `d[key]` — raises `KeyError` if missing
- `d.get(key, default)` — safe lookup, returns default if missing
- `d.setdefault(key, default)` — inserts default if key missing, returns value
- `key in d` — O(1)

> **Gotcha:** `d[key]` raises `KeyError` on a missing key. Use `.get()` defensively or handle the exception. Also: mutable objects like lists cannot be dict keys — they are not hashable.

## set

Unordered collection of unique hashable elements. Backed by a hash table. Membership test is O(1).

**When to use:** deduplication, membership testing, set operations (union, intersection, difference).

**Common operations:**
- `x in s` — O(1)
- `s.add(x)` — O(1)
- `s & t` — intersection
- `s | t` — union
- `s - t` — difference

> **Gotcha:** sets are unordered — you cannot index into one or rely on iteration order. If you need both uniqueness and order, use a dict with `dict.fromkeys()`.

## tuple

Ordered, immutable sequence. Slightly faster than list for iteration. Can be used as a dict key if all elements are hashable.

**When to use:** fixed collections of heterogeneous data — e.g. coordinates `(x, y)`, returning multiple values from a function, dict keys.

**Named tuples:** `collections.namedtuple` or `typing.NamedTuple` give you field names without the overhead of a full class.

> **Gotcha:** a tuple containing a mutable object is not truly immutable. `t = ([1, 2],)` — the tuple cannot be reassigned, but `t[0].append(3)` works fine. Tuples are only hashable if all their elements are hashable.
