# Concurrency vs Parallelism

## The Distinction

These two words are used interchangeably in conversation but they mean different things.

**Concurrency** is about structure — designing a program to deal with multiple things at once. It does not require multiple CPU cores. A single-core machine can run a concurrent program by interleaving tasks.

**Parallelism** is about execution — actually doing multiple things at the same time. It requires multiple CPU cores (or machines). Parallelism is a subset of concurrency.

Rob Pike's definition: "Concurrency is about dealing with lots of things at once. Parallelism is about doing lots of things at once."

```
Single core:
  Task A: ----  ----  ----
  Task B:     --    --    --
  Time:   ========================>
  (concurrent, NOT parallel — interleaved on one core)

Multiple cores:
  Core 1, Task A: --------
  Core 2, Task B: --------
  Time:           =======>
  (concurrent AND parallel — truly simultaneous)
```

## Why the Difference Matters

A program can be:
- **Concurrent but not parallel**: a single-threaded event loop (Node.js, asyncio) handling many requests by switching between them while waiting on I/O
- **Parallel but structured sequentially**: a batch job that splits an array across cores, each core computes its chunk independently — no interleaving, just simultaneous work
- **Both**: a multi-threaded web server where threads run on multiple cores and each thread handles multiple requests via async I/O

Understanding which you actually need changes your tool choice:

| Goal | Right tool |
|---|---|
| Handle many slow I/O operations without blocking | Concurrency (async, threads) |
| Speed up CPU-heavy computation | Parallelism (multiple processes/cores) |
| Both | Thread pool + async I/O |

## Concurrency Without Parallelism

A single thread can be concurrent by yielding control whenever it would otherwise block:

```
Thread 1:
  send HTTP request A  →  (waiting)  →  receive response A
  send HTTP request B  →  (waiting)  →  receive response B

Sequential:   A_request + A_wait + A_response + B_request + B_wait + B_response
Concurrent:   A_request + B_request + (both wait together) + A_response + B_response
```

Total latency drops from the sum of waits to the maximum of waits. This is what `asyncio` and `CompletableFuture` achieve — concurrency without extra threads.

> **Gotcha:** adding threads does not automatically give you parallelism if your runtime has a global lock (e.g. Python's GIL). Python threads are concurrent but not parallel for CPU-bound work. Java threads are both concurrent and parallel — the JVM has no global lock.

## Parallelism Without Concurrency

A purely parallel program divides a problem into independent chunks, runs them simultaneously, then combines results. No coordination mid-flight.

```java
// Parallel sum — each thread computes its slice, no synchronisation during work
int[] array = ...;
int mid = array.length / 2;
Future<Long> left  = pool.submit(() -> sum(array, 0, mid));
Future<Long> right = pool.submit(() -> sum(array, mid, array.length));
long total = left.get() + right.get(); // combine at the end only
```

This is Fork/Join and parallel streams in a nutshell. It works because the sub-tasks share no mutable state.

> **Gotcha:** most real programs need both concurrency and parallelism — and that is where correctness problems arise. Parallelism alone (no shared state) is easy to reason about. Adding concurrency (shared mutable state, coordination) is where races, deadlocks, and visibility bugs come in.
