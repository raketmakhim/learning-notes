# Java Memory Model

## What is the JMM

The Java Memory Model defines how threads interact through memory and what behaviours are allowed in concurrent execution. It specifies the rules for visibility, ordering, and atomicity of shared variables.

**Why it exists:** modern hardware introduces three sources of non-determinism that the JMM must tame.
- **CPU caches**: each core has its own L1/L2 cache — a write by one thread may stay cached and not be visible to another
- **Compiler optimisations**: the JIT reorders instructions to improve throughput
- **CPU reordering**: hardware can execute instructions out of order

**Memory architecture:**

```
Main Memory (Heap)
    |
    +-- Thread 1 Working Memory (CPU Cache)
    |     local copy of variables, may be stale
    |
    +-- Thread 2 Working Memory (CPU Cache)
          local copy of variables, may differ from Thread 1
```

**The core problem:**

```java
// Thread 1:
x = 1;
y = 2;

// Thread 2:
if (y == 2) {
    assert x == 1; // MAY FAIL
}
```

Thread 2 might see `y == 2` but still see `x == 0` due to caching or reordering. The JMM exists to define exactly when such visibility is guaranteed.

## volatile

`volatile` ensures reads and writes go directly to/from main memory, bypassing CPU caches.

```java
private volatile boolean running = true;
```

**What it guarantees:**
- **Visibility**: all threads see the latest written value immediately
- **Write barrier**: a write to a `volatile` flushes it to main memory; a read always fetches from main memory
- **Ordering**: the compiler and CPU cannot reorder operations across a `volatile` access

**Stop-flag pattern — broken without volatile:**

```java
class Worker implements Runnable {
    private boolean running = true; // NOT volatile

    public void run() {
        while (running) { // may never see false — cached in register
            // work
        }
    }
    public void stop() { running = false; }
}
```

**Fixed:**

```java
private volatile boolean running = true;
```

**What `volatile` does not do:**

```java
private volatile int count = 0;
count++; // NOT thread-safe

// count++ is three operations:
// 1. read count
// 2. add 1
// 3. write count
// another thread can interleave between any two steps
```

**When to use `volatile`:** a single boolean flag written by one thread and read by others. Simple assignments where no compound operations are needed and no invariants exist between multiple variables.

> **Gotcha:** `volatile` only prevents stale reads. It does not prevent two threads from simultaneously performing a read-modify-write on the same variable. For counters, use `AtomicInteger`. For anything more complex, use `synchronized`.

## synchronized

`synchronized` provides two guarantees: mutual exclusion (only one thread runs the block at a time) and memory visibility (changes are flushed to main memory on exit and fresh values are read on entry).

**Synchronized method:**

```java
public synchronized void increment() {
    count++; // lock on 'this'
}

public static synchronized void staticMethod() {
    // lock on the Class object
}
```

**Synchronized block:**

```java
private final Object lock = new Object();

public void method() {
    synchronized(lock) {
        // critical section
    }
}
```

**Memory visibility flow:**

```java
// Thread 1:
synchronized(lock) {
    x = 1;
    y = 2;
} // flushes x and y to main memory on exit

// Thread 2:
synchronized(lock) { // reads fresh values on entry
    // GUARANTEED to see x=1, y=2
}
```

**Monitor lock mechanics:** every object has a monitor. The lock is reentrant — the same thread can acquire it multiple times and a count is maintained. The lock releases when the count returns to zero.

```java
public synchronized void outer() {
    inner(); // safe — same thread already holds the lock
}
public synchronized void inner() { /* work */ }
```

> **Gotcha:** keep `synchronized` blocks as small as possible. Holding a lock longer than necessary increases contention and reduces throughput. Never call an external or unknown method while holding a lock — if that method also acquires locks, deadlock risk rises sharply.

## Happens-Before

Happens-before is the JMM's formal guarantee: if action A happens-before action B, then all memory writes made by A are visible to B.

**The six rules:**

**1. Program order**: every action in a thread happens-before every subsequent action in the same thread.

**2. Monitor lock**: unlocking a monitor happens-before every subsequent lock of that same monitor.

```java
// Thread 1:
synchronized(lock) { x = 1; } // unlock

// Thread 2:
synchronized(lock) { /* guaranteed to see x=1 */ } // lock
```

**3. Volatile variable**: a write to a `volatile` happens-before every subsequent read of it.

```java
// Thread 1:
x = 1;
volatileFlag = true;  // write

// Thread 2:
if (volatileFlag) {   // read — also sees x=1
```

**4. Thread start**: `thread.start()` happens-before any action in the started thread.

**5. Thread termination**: all actions in a thread happen-before any thread detects it has terminated via `join()`.

**6. Transitivity**: if A happens-before B and B happens-before C, then A happens-before C.

**Safe publication example:**

```java
// Unsafe — other threads may see a partially constructed object
public Holder holder;
holder = new Holder(42);

// Safe with volatile
public volatile Holder holder;
holder = new Holder(42); // full construction visible before reference is published
```

> **Gotcha:** without a happens-before relationship, there is no ordering guarantee — even if a write appears to happen "earlier" in wall-clock time. The JMM only guarantees visibility through the six rules above, not through physical time.

## volatile vs synchronized

| | `volatile` | `synchronized` |
|---|---|---|
| Visibility | Yes | Yes |
| Atomicity | No | Yes |
| Mutual exclusion | No | Yes |
| Multiple variables | No | Yes |
| Compound operations | Not safe | Safe |
| Overhead | Low | Higher |

**Decision guide:**
- Single variable, simple read/write, one writer: `volatile`
- Compound operations (`++`, `--`, `+=`): `synchronized` or `AtomicInteger`
- Multiple related variables with invariants between them: `synchronized`

## Common Patterns

**Double-checked locking — broken without `volatile`:**

```java
// BROKEN
private static Singleton instance; // not volatile

public static Singleton getInstance() {
    if (instance == null) {
        synchronized(Singleton.class) {
            if (instance == null) {
                instance = new Singleton(); // partially visible to other threads
            }
        }
    }
    return instance;
}
```

**Fixed:**

```java
private static volatile Singleton instance; // volatile required
```

**Safe publication options:**

```java
// 1. volatile field
public volatile Data data;

// 2. synchronized accessor
private Data data;
public synchronized Data getData() { return data; }

// 3. final field — safest, zero overhead
public final Data data = new Data();
```

**Piggybacking:** use a single `volatile` write to flush several non-volatile fields.

```java
class DataHolder {
    private int x, y, z;
    private volatile boolean ready;

    public void write() {
        x = 1; y = 2; z = 3;
        ready = true; // volatile write flushes x, y, z to main memory
    }
    public void read() {
        if (ready) { // volatile read — sees fresh x, y, z
        }
    }
}
```

> **Gotcha:** piggybacking only works if the volatile write happens-after the plain writes, and the volatile read happens-before the plain reads — and if there is a happens-before chain connecting the two threads through the volatile variable.

## FinTech Context

**Payment processing — must use `synchronized`:**

```java
class PaymentProcessor {
    private final Object lock = new Object();
    private BigDecimal balance;

    public void processPayment(BigDecimal amount) {
        synchronized(lock) { // read + check + update must be atomic
            if (balance.compareTo(amount) >= 0) {
                balance = balance.subtract(amount);
            }
        }
    }
}
```

**Circuit breaker — `volatile` is sufficient:**

```java
class CircuitBreaker {
    private volatile State state = State.CLOSED;
    private final AtomicInteger failureCount = new AtomicInteger();

    public boolean allowRequest() {
        return state == State.CLOSED; // simple volatile read
    }
    public void recordFailure() {
        if (failureCount.incrementAndGet() > THRESHOLD) {
            state = State.OPEN; // simple volatile write
        }
    }
}
```

**Market data cache:**

```java
class PriceCache {
    private final ConcurrentHashMap<String, Price> prices = new ConcurrentHashMap<>();

    public void updatePrice(String symbol, Price price) {
        prices.put(symbol, price); // thread-safe, uses volatile + CAS internally
    }
    public Price getPrice(String symbol) {
        return prices.get(symbol); // always sees latest value
    }
}
```

## Best Practices

- **Prefer immutability**: immutable objects require no synchronisation at all
- **Use `volatile` for flags**: simple status variables read by many, written by one
- **Use `synchronized` for compound operations**: any read-modify-write or multi-field invariant
- **Use higher-level constructs**: `AtomicInteger`, `ConcurrentHashMap`, `ReentrantLock` over raw `synchronized` where appropriate
- **Document thread safety**: state clearly in Javadoc whether a class is thread-safe and under what assumptions
- **Never assume ordering**: without a happens-before relationship, no visibility is guaranteed regardless of timing
- **Test under concurrency**: use stress tests and tools like `jcstress` — concurrency bugs are timing-dependent and often invisible in normal testing
