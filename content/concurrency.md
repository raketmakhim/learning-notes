# Concurrency

## volatile vs synchronized vs AtomicInteger

These three solve different problems. The mistake most people make is treating them as interchangeable.

**volatile**: guarantees visibility only. Every thread reads from main memory, not a CPU cache. Does not guarantee atomicity; `i++` on a volatile is still a race condition.

**synchronized**: guarantees both visibility and atomicity. Only one thread executes the block at a time. Has overhead, causing context switching and thread blocking.

**AtomicInteger**: atomic operations (compare-and-swap) without locking. Faster than `synchronized` for simple counters. Part of `java.util.concurrent.atomic`.

**When to use which:** Use `volatile` for a single flag one thread writes and others read, e.g. a boolean `running` field. Use `AtomicInteger` for a shared counter multiple threads increment. Use `synchronized` when you need to protect a block of operations that must happen together atomically.

> **Gotcha:** `volatile` does not make compound operations atomic. `count++` is read-modify-write: three operations. A volatile count is still broken under concurrent writes.

## CountDownLatch, CyclicBarrier, Semaphore

**CountDownLatch**: one-shot. A thread waits until a count reaches zero. Other threads call `countDown()`. Cannot be reset. Use for: wait until N tasks complete before proceeding.

**CyclicBarrier**: reusable. All threads wait at a barrier until everyone arrives, then all proceed. Use for: coordinate threads that need to synchronise at multiple points in a loop.

**Semaphore**: controls access to a limited resource. A thread calls `acquire()` to take a permit, `release()` to return it. Use for: rate limiting, connection pools, throttling concurrent access.

**Trading context:** CountDownLatch: wait for N market data feeds to initialise before starting the engine. Semaphore: limit concurrent database connections or API calls to an exchange.

> **Gotcha:** `CountDownLatch` cannot be reused once it hits zero. If you need to repeat the coordination, use `CyclicBarrier` instead.

## ExecutorService, thread pools, Future / CompletableFuture

`ExecutorService` manages a pool of threads so you don't create and destroy threads manually. Submit tasks via `submit()` or `execute()`. Always shut down with `shutdown()` or `shutdownNow()` when done.

**Fixed thread pool**: `Executors.newFixedThreadPool(n)`. Predictable resource usage. Good default for CPU-bound tasks.

**Cached thread pool**: `Executors.newCachedThreadPool()`. Creates threads on demand, reuses idle ones. Fine for short-lived tasks, dangerous under high load.

**Scheduled pool**: `Executors.newScheduledThreadPool(n)`. Run tasks after a delay or on a recurring schedule.

**Future** represents a result that isn't ready yet. You can call `get()` to block until it is. Problem: `get()` blocks the calling thread, not great for low-latency systems.

**CompletableFuture** solves this. You chain non-blocking callbacks with `thenApply()`, `thenCompose()`, `thenCombine()`. Lets you build async pipelines without blocking threads.

> **Gotcha:** calling `future.get()` without a timeout can block a thread forever if the task hangs. Always use `get(timeout, unit)` in production code.

## ConcurrentHashMap internals

Not just "it's thread-safe." Know why.

**Pre-Java 8:** the map was divided into segments (default 16), each with its own lock. Only the segment being written to was locked, so up to 16 threads could write concurrently.

**Java 8+:** segments were dropped in favour of locking at individual bucket level using CAS (compare-and-swap) and `synchronized` on the first node of each bucket. Far more granular, with much better throughput under high concurrency.

**Key behaviours:** reads are generally non-blocking. Writes lock only the affected bucket. `size()` is approximate under concurrent modification. `putIfAbsent()` and `computeIfAbsent()` are atomic. Does not allow null keys or null values (unlike `HashMap`).

> **Gotcha:** individual operations are atomic but compound operations are not. A check-then-act like `if (!map.containsKey(k)) map.put(k, v)` is still a race condition. Use `putIfAbsent()` or `computeIfAbsent()` instead.

## Race conditions, deadlocks, livelocks

**Race condition**: two threads access shared state concurrently and the result depends on timing. Fix: synchronise access or use atomic operations.

**Deadlock**: thread A holds lock 1 and waits for lock 2. Thread B holds lock 2 and waits for lock 1. Both block forever. Fix: always acquire locks in the same order.

**Livelock**: threads are active but make no progress. They keep reacting to each other. Like two people stepping aside in a corridor and mirroring each other. Fix: introduce randomness or priority.

> **Gotcha:** deadlock: threads are blocked and doing nothing. Livelock: threads are running but achieving nothing. CPU usage is high in a livelock, near zero in a deadlock.

## ReentrantLock vs synchronized

`synchronized` is built into the language, simple but limited. Auto-releases on exit or exception. No timeout: a thread waits indefinitely for the lock.

`ReentrantLock` gives you more control. Explicit `lock()` / `unlock()`. Supports `tryLock(timeout)`, interruptible locking, and fairness policy. Must unlock in a `finally` block.

**When to reach for ReentrantLock:** when you need to try acquiring a lock without blocking indefinitely, critical in low-latency systems. Also useful when you need fair ordering of waiting threads.

> **Gotcha:** if you forget to call `unlock()`, especially on an exception path, the lock is never released and everything waiting on it deadlocks. Always put `unlock()` in a `finally` block.
