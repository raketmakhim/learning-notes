# Concurrency Patterns

## Producer-Consumer

Decouple the rate of work production from the rate of consumption. Producers add items to a shared queue; consumers take items from it. Neither needs to know about the other.

```
[Producer 1] ─┐
[Producer 2] ─┼──► [Bounded Queue] ──► [Consumer 1]
[Producer 3] ─┘                    └──► [Consumer 2]
```

**Benefits:**
- **Rate decoupling**: producers and consumers can run at different speeds — the queue absorbs the difference
- **Backpressure**: a bounded queue blocks producers when full, naturally applying backpressure instead of letting the system be overwhelmed
- **Independent scaling**: add consumers to increase throughput without changing producer code

**Key design decisions:**
- Queue bound: unbounded queues can cause `OutOfMemoryError` if producers consistently outpace consumers. Always bound in production.
- Number of consumers: tune based on profiling — too few and the queue fills; too many and threads contend on the queue.
- Poison pill: a sentinel value that signals consumers to shut down cleanly.

> **Gotcha:** if consumers throw exceptions and die, the queue fills up, producers block, and the system grinds to a halt. Always ensure consumers restart on failure and monitor queue depth as a primary health signal.

## Read-Write Lock

Most shared data structures are read frequently but written rarely. A plain mutex is pessimistic — it serialises all access including reads that could safely run concurrently.

A read-write lock (shared-exclusive lock) distinguishes:
- **Read lock (shared)**: multiple threads can hold it simultaneously — reads run in parallel
- **Write lock (exclusive)**: only one thread can hold it, and only when no readers hold the read lock

```
Readers: T1 ─────────┐
         T2 ────────┐ │   (concurrent reads fine)
         T3 ──────┐ │ │
Writer:  T4 ──────┘ └─┘──► blocks until all readers done, then runs alone
```

**When to use:** read-heavy data structures like configuration caches, routing tables, reference data in trading systems. Not worth the overhead if writes are as frequent as reads.

> **Gotcha:** write starvation — if readers arrive continuously, a writer can be blocked indefinitely because the read lock is always held by someone. Good implementations give writers priority after they start waiting, preventing this. Check the documentation of the specific implementation you use.

## Thread-per-Request vs Thread Pool vs Event Loop

These are the three fundamental models for handling concurrent work. The right choice depends on the nature of the work and the scale required.

**Thread-per-request:** spawn a new thread (or process) for each incoming request. Simple, fully isolated.

```
Request 1 → Thread 1 (lives for duration of request)
Request 2 → Thread 2
Request 3 → Thread 3
```

Pros: simple, natural blocking code, full isolation. Cons: thread creation overhead, memory per thread (~1MB stack), context-switch cost, doesn't scale beyond ~10,000 concurrent requests.

**Thread pool:** a fixed number of threads pick tasks from a queue. Threads are reused across requests.

```
Request 1 → Queue → Thread 1 (reused)
Request 2 → Queue → Thread 2 (reused)
Request 3 → Queue → Thread 1 (after it finishes req 1)
```

Pros: controls resource usage, reuses threads, scales better. Cons: pool size tuning required, thread starvation if all threads block on slow I/O.

**Event loop (async I/O):** a single thread handles many requests by registering callbacks for I/O completion and running the next available callback when one completes.

```
Single thread:
  start req 1 I/O → register callback → start req 2 I/O → register callback
  → req 1 I/O done → run callback → req 2 I/O done → run callback
```

Pros: handles tens of thousands of concurrent I/O-bound operations with minimal threads. Cons: CPU-bound work blocks the loop; callback chains (or async/await) are harder to reason about than sequential code.

| Model | Best for | Scales to |
|---|---|---|
| Thread-per-request | Simple services, low concurrency | ~1,000 concurrent |
| Thread pool | Mixed workloads, controlled resources | ~10,000 concurrent |
| Event loop | High-concurrency I/O (APIs, websockets) | ~100,000+ concurrent |

## Backpressure

When a consumer cannot keep up with a producer, the system needs a mechanism to slow or stop the producer. Without backpressure, queues grow unboundedly, memory is exhausted, and the system crashes.

**Mechanisms:**
- **Blocking queue**: producer blocks on `put()` when the queue is full — natural backpressure
- **Rejection**: queue returns an error when full — producer must handle it (`offer()` returning `false`)
- **Rate limiting**: producer is throttled to a maximum rate regardless of consumer speed
- **Reactive streams**: backpressure is a first-class part of the protocol — consumers request N items at a time, producers send no more

> **Gotcha:** an unbounded queue is not a solution to slow consumers — it is a way to defer the crash. Given enough time, the queue will fill memory. A bounded queue with blocking or rejection makes the problem visible immediately, which is better than crashing after 20 minutes under load.

## Immutability as a Concurrency Strategy

The safest shared state is state that cannot change. An immutable object can be read by any number of threads simultaneously with zero synchronisation.

```java
// Immutable — safe to share freely
final class Price {
    private final String symbol;
    private final BigDecimal value;
    // no setters
}
```

Instead of mutating shared state, produce new immutable objects:

```java
// Instead of:
price.setValue(newValue);    // must synchronise

// Do:
price = new Price(symbol, newValue);  // atomic reference swap
```

This is the core idea behind persistent data structures, event sourcing, and functional programming applied to concurrency. The only synchronisation needed is on the reference itself (a single `volatile` or `AtomicReference`), not on the object's internals.

> **Gotcha:** immutability requires discipline — one mutable field or a mutable collection inside an otherwise immutable class breaks the guarantee. In Java, `final` fields prevent reassignment but not mutation of the referenced object. `Collections.unmodifiableList()` prevents modification through that reference but not through the original.
