# Comprehensions

## List comprehensions

Concise syntax for building a list by transforming or filtering an iterable.

```python
squares = [x ** 2 for x in range(10)]
evens   = [x for x in range(10) if x % 2 == 0]
```

Equivalent to a `for` loop with `.append()`, but faster in practice because the loop runs in C internally.

> **Gotcha:** comprehensions are not always more readable. If the logic is complex, a plain loop with a descriptive variable name is better. Nesting more than two levels is almost always a sign to refactor.

## Dict and set comprehensions

Same idea, different brackets.

```python
squared = {x: x ** 2 for x in range(5)}   # dict
unique  = {x.lower() for x in words}       # set
```

> **Gotcha:** dict comprehensions silently overwrite duplicate keys. `{x % 3: x for x in range(6)}` — only the last value for each key survives.

## Generator expressions

Like a list comprehension but lazy. Produces values one at a time instead of building the whole list in memory. Use parentheses instead of brackets.

```python
total = sum(x ** 2 for x in range(1_000_000))
```

No extra list is created — each value is computed and consumed on the fly. Useful when you only need to iterate once and the dataset is large.

**When to use a generator vs a list:**
- Use a generator when you only iterate once and don't need random access.
- Use a list when you need to iterate multiple times, index into results, or check the length.

> **Gotcha:** a generator can only be iterated once. After exhaustion it yields nothing. If you need to iterate again, you must recreate it.
