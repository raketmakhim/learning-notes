# String Formatting

## f-strings

The modern standard. Prefix the string with `f` and embed expressions directly in `{}`.

```python
name = "Alice"
score = 98.6
print(f"Player {name} scored {score:.1f}")
```

Expressions inside `{}` are evaluated at runtime. You can call functions, access attributes, and apply format specs — all inline.

**Common format specs:**
- `{x:.2f}` — float with 2 decimal places
- `{x:,}` — thousands separator
- `{x:>10}` — right-align in a field of width 10
- `{x!r}` — call `repr(x)`

> **Gotcha:** f-strings are evaluated immediately where they appear. You cannot define an f-string template in one place and fill it in later — use `str.format()` or a `Template` for that.

## str.format()

Older but useful when the template needs to be stored or reused separately from the values.

```python
template = "Hello, {}. You have {} messages."
template.format("Alice", 3)

# Named placeholders
"{name} is {age}".format(name="Alice", age=30)
```

> **Gotcha:** positional and keyword placeholders cannot be freely mixed in all Python versions. Stick to one style per format string.

## % formatting

The oldest style, inherited from C's `printf`. Still appears in logging and legacy codebases.

```python
"Hello, %s. Score: %.2f" % ("Alice", 98.6)
```

Avoid in new code. The main exception: the `logging` module uses `%`-style by convention because it defers formatting until the message is actually emitted, avoiding the cost of string building for suppressed log levels.

> **Gotcha:** passing a tuple as the single argument to `%` requires wrapping it: `"%s" % (value,)`. Forgetting the comma causes a `TypeError` when `value` is a tuple.

## string.Template

Designed for user-facing templates where you want to allow substitution but not arbitrary expression evaluation.

```python
from string import Template
t = Template("Hello, $name!")
t.substitute(name="Alice")
```

Safe to use with untrusted input because it does not evaluate expressions. Use `safe_substitute()` to leave missing keys as-is rather than raising `KeyError`.
