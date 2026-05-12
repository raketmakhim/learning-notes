# Synchronisation Primitives

## Mutex

A mutex (mutual exclusion lock) ensures only one thread can execute a critical section at a time. A thread acquires the mutex before entering and releases it on exit. Any other thread that tries to acquire it blocks until it is released.

```
Thread 1: acquire → [critical section] → release
Thread 2: acquire (blocked) ........... → acquire → [critical section] → release
```

**Key property:** the thread that locked the mutex must be the one to unlock it. This distinguishes it from a semaphore.

**Reentrant mutex:** allows the same thread to acquire the lock multiple times without deadlocking. It maintains a count and releases only when the count returns to zero. Java's `synchronized` and `ReentrantLock` are reentrant.

## Semaphore

A semaphore is a counter. Two operations:
- **acquire** (P / wait / down): decrements the counter. Blocks if counter is already 0.
- **release** (V / signal / up): increments the counter. Wakes a blocked thread if any.

**Binary semaphore (counter = 1):** behaves like a mutex but with a key difference — any thread can release it, not just the one that acquired it. Useful for signalling between threads.

**Counting semaphore (counter = N):** allows up to N threads to access a resource simultaneously. Classic use: connection pool with a fixed size.

```
Semaphore(3):  allows 3 threads in simultaneously
T1 acquire → counter: 2
T2 acquire → counter: 1
T3 acquire → counter: 0
T4 acquire → blocks (counter = 0)
T1 release → counter: 1 → T4 unblocks
```

**Mutex vs binary semaphore:**
- Mutex: ownership — only the acquiring thread can release; used for mutual exclusion
- Binary semaphore: no ownership — any thread can signal; used for signalling/notification

> **Gotcha:** using a semaphore where you need a mutex (or vice versa) is a classic bug. A semaphore released by the wrong thread can allow more concurrent accesses than intended. Use mutex when protecting a resource; use semaphore when signalling between threads.

## Monitor

A monitor bundles a mutex and one or more condition variables into a single construct. It is the fundamental concurrency primitive in Java — every object is a monitor.

**Components:**
- **Mutex**: only one thread executes inside the monitor at a time
- **Condition variable**: allows a thread inside the monitor to wait for a condition, releasing the mutex while it waits and reacquiring it when signalled

Java's `synchronized` + `wait()`/`notify()` is a monitor. A `ReentrantLock` + `Condition` is an explicit monitor with multiple condition variables.

```
Monitor {
  mutex
  condition: notEmpty

  void take() {
    acquire mutex
    while (queue.isEmpty()) {
      notEmpty.wait()      // release mutex, sleep
                           // (another thread can now acquire and produce)
                           // woken by signal → reacquire mutex
    }
    item = queue.remove()
    release mutex
    return item
  }
}
```

## Condition Variable

A condition variable lets a thread wait inside a critical section for a condition to become true, without holding the lock while sleeping. It always works in conjunction with a mutex.

**Operations:**
- **wait**: atomically release the mutex and sleep. When woken, reacquire the mutex before returning.
- **signal** (notify): wake one waiting thread
- **broadcast** (notifyAll): wake all waiting threads

The "atomically release and sleep" part is critical — if they were two separate steps, another thread could signal between the release and the sleep, and the signal would be lost.

**Why loop on the condition (not `if`):**

```java
// Wrong
if (queue.isEmpty()) condition.await();

// Correct
while (queue.isEmpty()) condition.await();
```

Spurious wakeups — a thread can wake without being signalled — are permitted by most OS and JVM implementations. The loop re-checks the condition after every wakeup.

> **Gotcha:** `notify()` wakes one thread but gives no guarantee about which one. If you wake the wrong thread (one whose condition is still false) it goes back to sleep, but the thread that should have run stays sleeping. Use `notifyAll()` / `signalAll()` when multiple threads wait on the same condition for different reasons, or when in doubt.

## Spinlock

A spinlock is a lock where the waiting thread does not sleep — it loops continuously checking if the lock is free. No OS involvement, no context switch.

```
while (!lock.tryAcquire()) {
    // spin — burn CPU waiting
}
```

**When spinlocks win:** when the wait time is shorter than the cost of a context switch (~1-10µs). Common in OS kernels and low-latency systems.

**When spinlocks lose:** when the lock is held for a long time, spinning wastes entire CPU cores doing nothing. Always use a blocking lock for anything that might wait more than a few microseconds.

> **Gotcha:** a spinlock on a single-core machine can deadlock. If the thread holding the lock is pre-empted and the waiting thread spins, nothing can run to release the lock. Spinlocks only make sense on multi-core systems.
