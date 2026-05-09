# Unpacking and *args / **kwargs

## Tuple unpacking

Assign multiple variables from an iterable in one line.

```python
x, y = (10, 20)
first, *rest = [1, 2, 3, 4]   # first=1, rest=[2, 3, 4]
*init, last  = [1, 2, 3, 4]   # init=[1, 2, 3], last=4
```

The `*` syntax (extended unpacking) captures the remainder as a list. Useful for splitting head/tail without slicing.

> **Gotcha:** the number of targets must match the number of values unless you use `*`. `a, b = (1, 2, 3)` raises `ValueError: too many values to unpack`.

## *args

Collects extra positional arguments into a tuple inside the function.

```python
def total(*args):
    return sum(args)

total(1, 2, 3)   # args = (1, 2, 3)
```

Use when a function should accept any number of positional arguments — e.g. wrappers, decorators, variadic utilities.

> **Gotcha:** `*args` is a tuple, not a list. You cannot append to it inside the function.

## **kwargs

Collects extra keyword arguments into a dict inside the function.

```python
def log(**kwargs):
    for key, value in kwargs.items():
        print(f"{key}: {value}")

log(user="alice", level="info")
```

Use when a function should accept arbitrary named options — e.g. forwarding config, building flexible APIs.

**Combining them:**

```python
def fn(*args, **kwargs):
    pass
```

Order must always be: regular args, `*args`, keyword-only args, `**kwargs`.

> **Gotcha:** keyword-only arguments (defined after `*args`) must always be passed by name. `def fn(*args, strict=False)` — `strict` can only be set as `fn(..., strict=True)`, never positionally.

## Unpacking into function calls

Use `*` and `**` to unpack when calling a function.

```python
coords = (3, 7)
draw(*coords)          # same as draw(3, 7)

config = {"color": "red", "size": 12}
render(**config)       # same as render(color="red", size=12)
```

Useful for forwarding arguments or composing calls from data.
