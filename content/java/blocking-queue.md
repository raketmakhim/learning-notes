# BlockingQueue and Producer-Consumer

## What is BlockingQueue

`BlockingQueue<E>` is a thread-safe queue that blocks the calling thread when the queue is full (on put) or empty (on take). It eliminates the need for manual `wait()`/`notify()` coordination between producer and consumer threads.

```java
BlockingQueue<Order> queue = new LinkedBlockingQueue<>(100);

// Producer thread — blocks if queue is full
queue.put(order);

// Consumer thread — blocks if queue is empty
Order order = queue.take();
```

This is the standard Java implementation of the producer-consumer pattern.

## Queue Implementations

**`LinkedBlockingQueue`** — linked-node queue, optionally bounded.

```java
new LinkedBlockingQueue<>();        // unbounded (Integer.MAX_VALUE capacity)
new LinkedBlockingQueue<>(1000);    // bounded — recommended in production
```

Separate locks for head and tail — producers and consumers don't contend with each other. Best general-purpose choice.

**`ArrayBlockingQueue`** — array-backed, always bounded, single lock.

```java
new ArrayBlockingQueue<>(1000);              // fair: false (default)
new ArrayBlockingQueue<>(1000, true);        // fair: true — FIFO thread ordering
```

Lower memory overhead than `LinkedBlockingQueue`. Single lock means producers and consumers do contend. Use when memory matters or fairness is required.

**`PriorityBlockingQueue`** — unbounded, elements ordered by priority.

```java
new PriorityBlockingQueue<>(100, Comparator.comparing(Order::getPriority));
```

`take()` always returns the highest-priority element. Unbounded — never blocks on put. Use for task queues where some work must jump ahead of others.

**`SynchronousQueue`** — zero capacity. Every `put` blocks until a consumer calls `take`, and vice versa. A direct handoff between threads.

```java
new SynchronousQueue<>();
```

Used internally by `Executors.newCachedThreadPool()`. Useful when you want the producer to wait for acknowledgement before producing more.

**`DelayQueue`** — elements become available only after a delay expires.

```java
DelayQueue<ScheduledTask> queue = new DelayQueue<>();
```

Use for retry queues, scheduled execution, or rate limiting.

> **Gotcha:** `LinkedBlockingQueue` without a capacity bound can grow without limit if producers outpace consumers, eventually causing `OutOfMemoryError`. Always set a capacity in production.

## Key Methods

| Method | Queue full | Queue empty |
|---|---|---|
| `put(e)` | Blocks | — |
| `take()` | — | Blocks |
| `offer(e)` | Returns `false` | — |
| `offer(e, timeout)` | Blocks up to timeout | — |
| `poll()` | — | Returns `null` |
| `poll(timeout)` | — | Blocks up to timeout |
| `add(e)` | Throws exception | — |

In production, prefer `put`/`take` for the blocking behaviour, or `offer(timeout)`/`poll(timeout)` when you need to handle timeouts gracefully.

## Producer-Consumer Pattern

The classic use case: one or more threads produce work items, one or more threads consume them. The queue decouples their speeds — producers don't need to wait for consumers and vice versa (up to queue capacity).

```java
BlockingQueue<Task> queue = new LinkedBlockingQueue<>(500);

// Producer
class Producer implements Runnable {
    public void run() {
        while (!Thread.interrupted()) {
            Task task = generateTask();
            queue.put(task);           // blocks if full
        }
    }
}

// Consumer
class Consumer implements Runnable {
    public void run() {
        while (!Thread.interrupted()) {
            Task task = queue.take();  // blocks if empty
            process(task);
        }
    }
}

// Wire up
ExecutorService producers = Executors.newFixedThreadPool(2);
ExecutorService consumers = Executors.newFixedThreadPool(4);

producers.submit(new Producer());
consumers.submit(new Consumer());
consumers.submit(new Consumer());
consumers.submit(new Consumer());
consumers.submit(new Consumer());
```

**Poison pill shutdown** — a sentinel value that tells consumers to stop:

```java
static final Order POISON_PILL = new Order("STOP");

// Producer signals done
queue.put(POISON_PILL);

// Consumer checks for it
Order order = queue.take();
if (order == POISON_PILL) {
    queue.put(POISON_PILL); // requeue for other consumers
    return;
}
```

> **Gotcha:** if you have multiple consumers, put one poison pill per consumer thread — each consumer takes one and re-queues for the next. A single pill will only stop one consumer.

## Monitoring Queue Health

In a production system, queue depth is a key metric. A growing queue means consumers can't keep up.

```java
queue.size();           // current number of elements
queue.remainingCapacity(); // how much room is left
```

Wire these to a metrics system (Micrometer, Prometheus) and alert if `size()` approaches capacity or `remainingCapacity()` approaches zero.

## FinTech Examples

**Order processing pipeline:**

```java
BlockingQueue<Order> inbound = new LinkedBlockingQueue<>(1000);

// Market connectivity layer puts orders on the queue
inbound.put(new Order("BUY AAPL 100 @ 150.00"));

// Risk engine consumes and validates
Order order = inbound.take();
if (riskEngine.approve(order)) {
    executionQueue.put(order);
}
```

**Priority order book — urgent orders first:**

```java
PriorityBlockingQueue<Order> queue = new PriorityBlockingQueue<>(
    100,
    Comparator.comparingInt(Order::getPriority).reversed()
);

queue.put(new Order(NORMAL,  "BUY MSFT"));
queue.put(new Order(URGENT,  "SELL AAPL"));  // comes out first

Order next = queue.take(); // always returns highest priority
```

**Rate-limited submission with timeout:**

```java
BlockingQueue<TradeRequest> queue = new ArrayBlockingQueue<>(200);

public boolean submitTrade(TradeRequest req) {
    // Don't block forever — if queue is full, the system is overloaded
    boolean accepted = queue.offer(req, 100, TimeUnit.MILLISECONDS);
    if (!accepted) {
        metrics.increment("trade.rejected.queue_full");
    }
    return accepted;
}
```
