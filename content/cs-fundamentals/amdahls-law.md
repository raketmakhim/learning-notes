# Amdahl's Law and Scalability Limits

## Amdahl's Law

Adding more threads or cores to a program has diminishing returns. The speedup is bounded by the portion of the program that must run serially.

**Formula:**

```
Speedup = 1 / (S + P/N)

S = fraction of work that is serial (cannot be parallelised)
P = fraction that is parallel  (S + P = 1)
N = number of parallel workers (threads, cores)
```

**Example — 10% serial code:**

| Cores (N) | Speedup |
|---|---|
| 1 | 1x |
| 2 | 1.82x |
| 4 | 3.08x |
| 8 | 4.71x |
| 16 | 6.40x |
| ∞ | 10x (ceiling) |

No matter how many cores you add, if 10% of the work is serial, you will never exceed a 10x speedup. The serial fraction is the hard ceiling.

**Why serial fractions are unavoidable:**
- Lock acquisition and release
- Single-threaded setup and teardown
- Aggregating results from parallel workers
- I/O that cannot be parallelised (a single database write)
- Coordination overhead between threads

> **Gotcha:** Amdahl's Law is often more pessimistic in practice than in theory. The serial fraction in most programs is larger than it appears because synchronisation itself adds serial sections. A program with no explicit serial code still serialises on every lock, every cache invalidation, and every result aggregation.

## Gustafson's Law

Amdahl's Law holds the problem size constant and asks: how much faster can we solve the same problem? Gustafson observed that in practice, as hardware scales, people solve larger problems rather than the same problem faster.

**Gustafson's insight:** the parallel portion grows with N (more cores = bigger problem), while the serial portion stays roughly constant. Scaled speedup can grow linearly with N even with a serial fraction.

Both laws are correct in their own framing:
- Fixed problem, more cores: Amdahl (diminishing returns)
- Bigger problem, more cores: Gustafson (linear scaling possible)

In practice, if you're tuning a latency-critical system (low-latency trading, real-time processing), Amdahl applies — you have a fixed job to do as fast as possible. If you're scaling a throughput system (more requests, bigger datasets), Gustafson applies.

## Little's Law

In any stable system:

```
L = λ × W

L = average number of items in the system (queue depth + in-flight)
λ = average arrival rate (requests per second)
W = average time spent in the system (latency)
```

**What it tells you:** if latency goes up, queue depth goes up proportionally for the same arrival rate. If you want to halve queue depth at the same throughput, you must halve latency.

This is why latency and queue depth are two sides of the same coin in production systems.

**Example:** a payment processor handles 1,000 payments/second, each taking 20ms on average.

```
L = 1000 × 0.020 = 20 payments in-flight at any moment
```

If processing latency spikes to 200ms:
```
L = 1000 × 0.200 = 200 in-flight — queues grow 10x
```

> **Gotcha:** Little's Law assumes a stable system (arrival rate ≤ processing rate). If arrival rate exceeds processing rate even briefly, queues grow without bound. This is why backpressure — slowing or rejecting producers when consumers can't keep up — is essential in any real system.

## The Cost of Context Switching

A context switch is not free. When the OS pre-empts a thread:

1. Save all CPU registers (~hundreds of bytes) to the thread's kernel structure
2. Load another thread's saved registers
3. If switching processes: flush the TLB (translation lookaside buffer), invalidating all virtual-to-physical address mappings — next memory access is a cold miss

**Rough costs:**
- Thread switch (same process): 1–10 µs
- Process switch: 10–100 µs
- L1 cache miss after switch: a further 4ns per miss, but thousands of misses in a newly scheduled thread

**When this matters:** a thread that blocks on a mutex, does a blocking I/O call, or calls `Thread.sleep()` yields to the OS and may not resume for hundreds of microseconds. In a low-latency system, this is unacceptable — which is why lock-free algorithms, busy-waiting, and kernel-bypass I/O exist.

> **Gotcha:** a thread pool with more threads than cores does not improve throughput for CPU-bound work — it only adds context-switch overhead. The right pool size for CPU-bound tasks is `number of CPU cores`. For I/O-bound tasks it can be higher because threads spend most of their time waiting, not running.
