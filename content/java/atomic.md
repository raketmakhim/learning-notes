# Atomic Classes and CAS

## What is CAS

Compare-And-Swap (CAS) is a CPU-level instruction that atomically does the following: read a value, compare it to an expected value, and only write a new value if the comparison succeeds. If another thread changed the value in between, the operation fails and the caller retries.

```
CAS(variable, expected, newValue):
  if variable == expected:
    variable = newValue
    return true
  else:
    return false   // another thread changed it — retry
```

This is the foundation of lock-free programming. No thread ever blocks — instead of waiting for a lock, a thread just retries the operation. Under low contention this is much faster than acquiring a mutex.

**CAS vs synchronized:**
- `synchronized` blocks threads — they sleep and incur context-switch overhead
- CAS spins and retries — no OS involvement, stays in user space
- CAS wins at low-to-moderate contention; under very high contention, spinning wastes CPU

## AtomicInteger and AtomicLong

The most common atomic classes. Wrap an `int` or `long` and expose operations that execute atomically via CAS.

```java
AtomicInteger count = new AtomicInteger(0);

count.incrementAndGet();           // ++count, returns new value
count.getAndIncrement();           // count++, returns old value
count.addAndGet(5);                // count += 5, returns new value
count.compareAndSet(10, 20);       // if count==10, set to 20; returns boolean
count.get();                       // plain read
```

**When to use over `synchronized int`:**
- Single counter incremented by many threads — `AtomicInteger` is faster and simpler
- You need compare-and-swap semantics — check a value and update only if it matches
- You don't need to coordinate multiple variables together (if you do, use `synchronized`)

> **Gotcha:** `AtomicInteger` makes individual operations atomic but not sequences of operations. `if (count.get() == 0) count.set(1)` is still a race condition — use `compareAndSet(0, 1)` instead.

## AtomicReference

Applies CAS to an object reference. Lets you atomically swap out an immutable object.

```java
AtomicReference<String> ref = new AtomicReference<>("initial");

ref.set("updated");
String old = ref.getAndSet("next");         // swap, return old
ref.compareAndSet("next", "final");         // update only if still "next"
ref.updateAndGet(s -> s.toUpperCase());     // functional update
```

**Common pattern — atomic state transition:**

```java
AtomicReference<State> state = new AtomicReference<>(State.IDLE);

// Only one thread succeeds in transitioning from IDLE to RUNNING
if (state.compareAndSet(State.IDLE, State.RUNNING)) {
    // this thread won the race — do the work
}
```

> **Gotcha:** `AtomicReference` compares by reference (`==`), not by `equals()`. Two different `String` objects with the same content will not match in a `compareAndSet`.

## ABA Problem

CAS only checks if the value is still the expected value. It cannot detect if the value changed from A to B and back to A between your read and your CAS.

```
Thread 1 reads value = A
Thread 2 changes A → B → A
Thread 1 CAS succeeds (still sees A) — but state may have changed meaningfully
```

In most counter/flag scenarios this doesn't matter. It becomes a problem in pointer-based structures like lock-free stacks where ABA can cause use-after-free bugs.

**Fix: `AtomicStampedReference`** — pairs the value with an integer stamp (version counter). CAS must match both the value and the stamp.

```java
AtomicStampedReference<Node> top = new AtomicStampedReference<>(node, 0);

int[] stamp = new int[1];
Node current = top.get(stamp);           // read value and stamp together
top.compareAndSet(current, newNode, stamp[0], stamp[0] + 1);  // must match both
```

## LongAdder

`AtomicLong` with CAS suffers under very high contention — many threads spinning and failing on the same memory location. `LongAdder` solves this by maintaining an array of cells, each updated by a subset of threads. The true sum is computed lazily when `sum()` is called.

```java
LongAdder counter = new LongAdder();

counter.increment();       // threads spread across cells — less contention
counter.add(5);
long total = counter.sum(); // sums all cells
counter.reset();
```

**`LongAdder` vs `AtomicLong`:**
- High contention (many threads updating): `LongAdder` wins — far less CAS failure
- Low contention or need exact snapshot: `AtomicLong` — simpler, `sum()` is not atomic
- Need `compareAndSet`: only `AtomicLong` supports it

> **Gotcha:** `LongAdder.sum()` is not atomic. Another thread can update a cell between reading cells, so the result is approximate under concurrent modification. Use it for metrics and counters where an exact snapshot is not required.

## FinTech Examples

**Trade counter — high throughput:**

```java
// Many threads recording trades simultaneously
LongAdder tradeCount = new LongAdder();
tradeCount.increment();              // called from many threads
long total = tradeCount.sum();       // read periodically for reporting
```

**Circuit breaker state — compare-and-swap:**

```java
AtomicReference<CircuitState> state = new AtomicReference<>(CircuitState.CLOSED);

// Only trip the breaker once — first thread wins, rest skip
if (state.compareAndSet(CircuitState.CLOSED, CircuitState.OPEN)) {
    log.warn("Circuit breaker tripped");
    scheduleReset();
}
```

**Sequence number generator:**

```java
AtomicLong orderIdSequence = new AtomicLong(0);

public long nextOrderId() {
    return orderIdSequence.incrementAndGet(); // guaranteed unique across threads
}
```
