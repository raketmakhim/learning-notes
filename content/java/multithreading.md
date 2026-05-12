# Multithreading

## Thread Basics

A thread is a lightweight unit of execution within a process. Multiple threads share the same memory space but execute independently.

**Process**: independent program with its own memory space.
**Thread**: lightweight execution unit within a process.
**Shared memory**: all threads in a process share heap memory.
**Thread stack**: each thread has its own stack for local variables.
**Context switching**: the OS switches between threads, which has overhead.

**Creating threads — Method 1: extend Thread**

```java
class MyThread extends Thread {
    public void run() { /* work */ }
}
new MyThread().start();
```

**Creating threads — Method 2: implement Runnable (preferred)**

```java
Runnable task = () -> { /* work */ };
new Thread(task).start();
```

Runnable is preferred because it separates task logic from thread management, allows the class to extend something else, and the same Runnable can be reused with different executors.

**Thread lifecycle:**
- `NEW`: thread created but not started
- `RUNNABLE`: running or ready to run
- `BLOCKED`: waiting for a monitor lock
- `WAITING`: waiting indefinitely for another thread
- `TIMED_WAITING`: waiting for a specified time
- `TERMINATED`: thread completed execution

## Synchronization

When multiple threads access shared data, synchronization prevents race conditions and ensures data consistency.

**Race condition example:**

```java
int count = 0;
// Thread 1: count++ (read 0, write 1)
// Thread 2: count++ (read 0, write 1)
// Result: count = 1, should be 2
```

**Synchronized method:**

```java
public synchronized void increment() {
    count++;
}
```

**Synchronized block:**

```java
public void increment() {
    synchronized(this) {
        count++;
    }
}
```

Every object has an intrinsic lock (monitor). Only one thread can hold it at a time — others block until it is released. Static synchronized methods lock on the `Class` object rather than the instance.

**volatile:**

```java
private volatile boolean running = true;
```

`volatile` prevents CPU caching — the value is always read from main memory and writes are immediately visible to all threads. It does not provide atomicity. Use it for simple flags or status variables written by one thread and read by others.

> **Gotcha:** `volatile` does not make compound operations atomic. `count++` on a volatile field is still a race condition — it is read-modify-write: three separate operations. Use `AtomicInteger` or `synchronized` instead.

## Java Memory Model

Each thread may cache variables in CPU registers or L1/L2 cache. Without synchronization, changes made by one thread may not be visible to others.

**Happens-before relationship** — the JMM defines when a write in one thread is guaranteed to be visible to a read in another:

- **Program order**: actions in a single thread happen in sequence
- **Monitor lock**: an unlock happens-before any subsequent lock of the same monitor
- **Volatile**: a write to a volatile variable happens-before any subsequent read of it
- **Thread start**: `thread.start()` happens-before any action in the started thread
- **Thread join**: all actions in a thread happen-before `join()` returns

> **Gotcha:** without a happens-before relationship between two threads, there is no guarantee that one thread will ever see a write made by the other — even if the write happened "earlier" in wall-clock time. Always establish happens-before explicitly through synchronization, volatile, or thread start/join.

## Thread Pools and ExecutorService

Creating threads is expensive. Thread pools reuse threads across multiple tasks, reducing overhead and allowing resource limits.

**FixedThreadPool:**

```java
ExecutorService executor = Executors.newFixedThreadPool(5);
```

Fixed number of threads. Tasks queue when all threads are busy. Good for consistent, known workloads.

**CachedThreadPool:**

```java
ExecutorService executor = Executors.newCachedThreadPool();
```

Creates threads on demand, reuses idle threads (60s timeout). Good for many short-lived tasks. Dangerous under sustained high load — can create unbounded threads.

**SingleThreadExecutor:**

```java
ExecutorService executor = Executors.newSingleThreadExecutor();
```

One thread, tasks executed sequentially. Use when guaranteed ordering matters.

**ScheduledThreadPool:**

```java
ScheduledExecutorService executor = Executors.newScheduledThreadPool(3);
```

Schedule tasks with a delay or on a recurring schedule. Use for polling, cron-style jobs.

**Submitting tasks:**

```java
executor.execute(() -> { /* fire and forget */ });

Future<Integer> future = executor.submit(() -> 42);
Integer result = future.get(); // blocks until complete

executor.shutdown();
executor.awaitTermination(60, TimeUnit.SECONDS);
```

**Custom ThreadPoolExecutor:**

```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    5,                             // core pool size
    10,                            // max pool size
    60L, TimeUnit.SECONDS,         // keep-alive for excess threads
    new LinkedBlockingQueue<>(100) // bounded task queue
);
```

- `corePoolSize`: minimum threads kept alive
- `maximumPoolSize`: ceiling on thread count
- `keepAliveTime`: how long excess threads wait before being terminated
- `workQueue`: holds tasks when all core threads are busy

> **Gotcha:** always shut down an `ExecutorService` when done. Threads in a pool are non-daemon by default — they will prevent the JVM from exiting if you forget to call `shutdown()`.

## Fork/Join Framework

Designed for divide-and-conquer parallelism. Tasks recursively split themselves into smaller subtasks, execute in parallel, then combine results.

**Work stealing**: each thread maintains its own deque of tasks and works from the tail (LIFO). Idle threads steal from the head of other threads' deques (FIFO). This reduces contention and keeps CPUs busy.

```java
class SumTask extends RecursiveTask<Long> {
    int[] array;
    int start, end;

    protected Long compute() {
        if (end - start <= 10) {
            return sum(array, start, end);
        }
        int mid = (start + end) / 2;
        SumTask left  = new SumTask(array, start, mid);
        SumTask right = new SumTask(array, mid, end);
        left.fork();                        // schedule async
        return right.compute() + left.join(); // compute right inline, wait for left
    }
}

ForkJoinPool pool = new ForkJoinPool();
Long result = pool.invoke(new SumTask(array, 0, array.length));
```

> **Gotcha:** Fork/Join is designed for CPU-bound, non-blocking tasks. Blocking inside a `RecursiveTask` (I/O, `Thread.sleep`, locks) starves the pool because Fork/Join threads are not replaced when blocked.

## Common Concurrency Issues

**Race condition**: two threads read and write shared state concurrently; the outcome depends on timing. Fix: use synchronization, atomic classes, or locks.

**Deadlock**: thread A holds lock 1 and waits for lock 2; thread B holds lock 2 and waits for lock 1. Both block forever. Prevention: always acquire locks in the same order, use `tryLock()` with a timeout, and minimise lock holding time.

**Livelock**: threads keep changing state in response to each other but make no overall progress. Like two people in a corridor who keep stepping the same way to let each other pass. Fix: introduce randomness or a priority scheme.

**Starvation**: a thread is perpetually denied access to a resource because others monopolise it. Fix: use fair locks — `new ReentrantLock(true)`.

> **Gotcha:** deadlock and livelock look different on a profiler. In a deadlock, threads are `BLOCKED` and CPU usage is near zero. In a livelock, threads are `RUNNABLE` and CPU usage is high — they are busy doing nothing useful.

## Best Practices

- **Prefer immutability**: immutable objects are inherently thread-safe — no synchronization needed
- **Minimise shared state**: less sharing means fewer synchronization problems
- **Use thread-safe collections**: `ConcurrentHashMap`, `CopyOnWriteArrayList` over manual synchronization
- **Prefer high-level abstractions**: `ExecutorService` over raw `Thread`, `CompletableFuture` over `Future.get()`
- **Use atomic classes**: `AtomicInteger` instead of a `synchronized int` for counters
- **Keep synchronized blocks small**: hold locks for the minimum time needed
- **Never call unknown code inside a synchronized block**: if that code also acquires locks, deadlock risk rises sharply
- **Document thread safety**: state clearly in Javadoc whether a class is thread-safe, conditionally safe, or not safe

## FinTech Use Cases

**Payment processing**: `ExecutorService` for parallel payment validation. `ConcurrentHashMap` for tracking in-flight transactions. Atomic operations for balance updates. Synchronized blocks for double-spend prevention.

**Market data processing**: Fork/Join for parallel price calculations. `volatile` for real-time price flag updates. Lock-free structures for order book updates.

**Risk calculation**: thread pools for portfolio risk analysis. `CompletableFuture` for async, non-blocking pipelines. Parallel streams for large dataset processing.

**API gateway**: `ThreadPoolExecutor` for handling concurrent requests. Rate limiting with `ConcurrentHashMap` and `AtomicLong`. `Semaphore` for connection pool throttling.

## Interview Questions

**Q: Difference between `synchronized` and `ReentrantLock`?**
`synchronized` is built-in, simpler, releases automatically on exit or exception, and is always unfair. `ReentrantLock` offers `tryLock(timeout)`, interruptible locking, a fair mode, and condition variables — but you must call `unlock()` manually, always in a `finally` block.

**Q: When to use `volatile` vs `synchronized`?**
`volatile`: single variable, visibility only, no compound operations needed. `synchronized`: multiple variables, atomicity required, compound operations (check-then-act, read-modify-write).

**Q: How does `ConcurrentHashMap` work in Java 8+?**
Segments were replaced with per-bucket locking. Writes use CAS on empty buckets, `synchronized` on the first node of a non-empty bucket. Reads are non-blocking. Far more granular than the old segment approach.

**Q: What is `ThreadLocal` and when should you use it?**
Each thread gets its own independent copy of the variable. Common uses: `SimpleDateFormat` instances, per-thread database connections, per-request context in web servers.

> **Gotcha:** `ThreadLocal` in thread pools is dangerous. Threads are reused, so a value set in one request will still be present in the next request handled by the same thread unless you explicitly call `remove()`.

**Q: How to handle `InterruptedException`?**
Two valid options: propagate it upward by declaring `throws InterruptedException`, or catch it and restore the interrupt flag with `Thread.currentThread().interrupt()`. Never silently swallow it — you destroy the interruption signal and the thread can never be cleanly shut down.

**Q: Why is double-checked locking broken without `volatile`?**
Without `volatile`, the JIT can reorder the write to the instance field before the constructor finishes. Another thread can observe a non-null but partially constructed object. Adding `volatile` to the field prevents this reordering.
