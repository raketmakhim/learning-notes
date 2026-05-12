# synchronized vs ReentrantLock

## synchronized — Intrinsic Lock

Every object in Java has an intrinsic lock (monitor lock). `synchronized` is built into the language and uses it automatically.

**Key characteristics:**
- No import needed — built into the language
- Lock is released automatically even if an exception is thrown
- Reentrant — the same thread can acquire the lock multiple times
- Non-interruptible — a thread blocked waiting cannot be interrupted
- No timeout — waits indefinitely

**Monitor lock internals:** every object tracks an owner thread, an entry set (threads waiting to acquire), a wait set (threads that called `wait()`), and a recursion counter for reentrancy.

**Synchronized method (instance):**

```java
public synchronized void method() {
    count++; // locks on 'this'
}
```

**Synchronized method (static):**

```java
public static synchronized void method() {
    // locks on MyClass.class
}
```

**Synchronized block with a dedicated lock object:**

```java
private final Object lock = new Object();

public void method() {
    synchronized(lock) {
        // finer-grained control than locking on 'this'
    }
}
```

**Reentrancy in practice:**

```java
public synchronized void increment() {
    count++;
    log(); // also synchronized — same thread enters immediately
    // recursion counter: 1 → 2 on entry, 2 → 1 on log() exit, 1 → 0 on increment() exit
}
public synchronized void log() {
    System.out.println(count);
}
```

**Limitations:**
- No timeout — thread waits indefinitely for the lock
- Cannot interrupt a blocked thread
- No try-lock — no way to attempt acquisition without committing to block
- No fairness guarantee — can cause starvation
- Single condition only — `wait()` / `notify()` share one wait set
- Block-structured — must acquire and release in the same method

## ReentrantLock — Explicit Lock

`ReentrantLock` from `java.util.concurrent.locks` provides everything `synchronized` does plus explicit control over acquisition, timeout, interruption, fairness, and multiple condition variables.

```java
import java.util.concurrent.locks.ReentrantLock;
private final ReentrantLock lock = new ReentrantLock();
```

**Standard pattern — always unlock in `finally`:**

```java
lock.lock();
try {
    count++;
} finally {
    lock.unlock(); // runs even if exception thrown
}
```

**`tryLock()` — non-blocking attempt:**

```java
if (lock.tryLock()) {
    try {
        // acquired lock
    } finally {
        lock.unlock();
    }
} else {
    // lock not available — do something else
}
```

**`tryLock(timeout)` — bounded wait:**

```java
if (lock.tryLock(5, TimeUnit.SECONDS)) {
    try {
        // acquired within 5 seconds
    } finally {
        lock.unlock();
    }
} else {
    // timed out
}
```

**`lockInterruptibly()` — responds to interrupts:**

```java
try {
    lock.lockInterruptibly();
    try {
        // critical section
    } finally {
        lock.unlock();
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt(); // restore interrupt flag
}
```

**Fair vs unfair:**

```java
new ReentrantLock();       // unfair (default) — higher throughput
new ReentrantLock(true);   // fair — FIFO ordering, no starvation, lower throughput
```

Unfair: a newly arriving thread can barge ahead of waiting threads. Fair: strictly first-come, first-served.

**Multiple condition variables:**

```java
private final Condition notEmpty = lock.newCondition();
private final Condition notFull  = lock.newCondition();

public void put(Item item) throws InterruptedException {
    lock.lock();
    try {
        while (queue.isFull()) notFull.await();
        queue.add(item);
        notEmpty.signal();
    } finally {
        lock.unlock();
    }
}

public Item take() throws InterruptedException {
    lock.lock();
    try {
        while (queue.isEmpty()) notEmpty.await();
        Item item = queue.remove();
        notFull.signal();
        return item;
    } finally {
        lock.unlock();
    }
}
```

**Diagnostic methods:**

```java
lock.isLocked();               // held by any thread?
lock.isHeldByCurrentThread();  // held by this thread?
lock.getHoldCount();           // reentrancy depth
lock.getQueueLength();         // threads waiting to acquire
```

> **Gotcha:** always acquire the lock before the `try` block, not inside it. If you lock inside `try` and the lock throws (unlikely but possible), the `finally` will call `unlock()` on a lock that was never acquired.
>
> ```java
> // Wrong
> try { lock.lock(); /* work */ } finally { lock.unlock(); }
>
> // Correct
> lock.lock();
> try { /* work */ } finally { lock.unlock(); }
> ```

## Comparison

| Feature | `synchronized` | `ReentrantLock` |
|---|---|---|
| Lock release | Automatic | Must call `unlock()` in `finally` |
| Try-lock | No | `tryLock()` |
| Timeout | No | `tryLock(timeout)` |
| Interruptible | No | `lockInterruptibly()` |
| Fairness | Unfair only | Fair or unfair |
| Conditions | One (`wait`/`notify`) | Multiple (`Condition`) |
| Lock scope | Block-structured | Can span methods |
| JVM optimisations | Yes (biased locking, elision) | No |
| Monitoring | Thread dumps only | Rich API |
| Safety | Higher (automatic) | Lower (manual unlock) |

**Performance:** `synchronized` is slightly faster at low contention thanks to JVM optimisations (biased locking, lock coarsening, lock elision). `ReentrantLock` in fair mode is slower but more predictable under high contention.

## When to Use Which

**Use `synchronized` when:**
- You just need mutual exclusion — the common case
- Contention is low to moderate
- You want simplicity and automatic unlock
- The lock scope fits neatly in one method

**Use `ReentrantLock` when:**
- You need a timeout on lock acquisition
- You need try-lock without blocking
- You need to respond to interrupts while waiting
- You need fair (FIFO) ordering
- You need multiple condition variables
- You need to acquire in one method and release in another
- You want runtime diagnostics on the lock

> **Gotcha:** `ReentrantLock` with a forgotten `unlock()` — particularly on an exception path that bypasses `finally` — deadlocks every thread that subsequently tries to acquire the lock. The cost of flexibility is the responsibility to always release.

## FinTech Examples

**Bank account — `synchronized` is sufficient:**

```java
class BankAccount {
    private BigDecimal balance;

    public synchronized void withdraw(BigDecimal amount) {
        if (balance.compareTo(amount) < 0) throw new InsufficientFundsException();
        balance = balance.subtract(amount);
    }
    public synchronized void deposit(BigDecimal amount) {
        balance = balance.add(amount);
    }
}
```

**Payment processor — timeout matters:**

```java
class PaymentProcessor {
    private final ReentrantLock lock = new ReentrantLock();

    public PaymentResult process(Payment payment) {
        try {
            if (!lock.tryLock(5, TimeUnit.SECONDS)) {
                return PaymentResult.timeout(); // system too busy
            }
            try {
                return executePayment(payment);
            } finally {
                lock.unlock();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return PaymentResult.interrupted();
        }
    }
}
```

**Transaction queue — fair ordering for regulatory compliance:**

```java
class TransactionQueue {
    private final ReentrantLock lock = new ReentrantLock(true); // fair
    private final Queue<Transaction> queue = new LinkedList<>();

    public void add(Transaction tx) {
        lock.lock();
        try {
            queue.offer(tx);
        } finally {
            lock.unlock();
        }
    }
}
```

**Order book — multiple conditions:**

```java
class OrderBook {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition hasBuys  = lock.newCondition();
    private final Condition hasSells = lock.newCondition();

    public void addBuyOrder(Order order) {
        lock.lock();
        try {
            buyOrders.add(order);
            hasBuys.signal();
        } finally {
            lock.unlock();
        }
    }

    public Order waitForBuyOrder() throws InterruptedException {
        lock.lock();
        try {
            while (buyOrders.isEmpty()) hasBuys.await();
            return buyOrders.poll();
        } finally {
            lock.unlock();
        }
    }
}
```
