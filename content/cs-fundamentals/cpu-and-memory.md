# CPU Architecture and Memory

## Cache Hierarchy

Modern CPUs do not read directly from RAM — they load data through a hierarchy of caches. Each level is faster but smaller.

```
CPU Core 1          CPU Core 2
  L1 cache (~32KB)    L1 cache (~32KB)    — per core, ~1ns access
  L2 cache (~256KB)   L2 cache (~256KB)   — per core, ~5ns access
      L3 cache (~8-32MB)                  — shared across cores, ~20ns
          Main Memory (RAM, GBs)          — ~100ns access
```

When a thread reads a variable, the CPU checks L1 first, then L2, then L3, then RAM. A cache miss to RAM is 100x slower than an L1 hit.

**Cache lines:** memory is not loaded byte by byte. It is loaded in blocks of typically 64 bytes called cache lines. When you read one variable, the CPU pulls its entire 64-byte neighbourhood into cache.

## Why Caches Cause Concurrency Problems

Each core has its own L1 and L2 cache. If Thread 1 (on Core 1) writes a value, that write goes to Core 1's L1 cache first. Thread 2 (on Core 2) may still see the old value in its own cache. This is the visibility problem that `volatile` and `synchronized` exist to solve.

```
Core 1 writes x = 5  →  sits in Core 1's L1
Core 2 reads x       →  gets stale 0 from its own L1
```

## Cache Coherence

Hardware maintains coherence across cores using protocols (typically MESI). Each cache line can be in one of four states:

- **Modified**: this core has a dirty copy — no other core has it
- **Exclusive**: this core has a clean copy — no other core has it
- **Shared**: multiple cores have a clean read-only copy
- **Invalid**: this core's copy is stale

When a core writes to a shared cache line, it broadcasts an invalidation to other cores. They must re-fetch from L3 or RAM on next access. This invalidation traffic is the hardware-level cost of sharing writable data between threads.

## False Sharing

Two threads modify different variables, but those variables happen to live in the same 64-byte cache line. Every write by either thread invalidates the other's cache line, forcing a reload — even though they are not logically sharing data.

```java
class Counters {
    long counterA;  // bytes 0-7
    long counterB;  // bytes 8-15
    // Both live in the same cache line
}

// Thread 1 increments counterA, Thread 2 increments counterB
// They constantly invalidate each other's cache — performance collapses
```

**Fix:** pad to separate them onto different cache lines.

```java
class Counters {
    long counterA;
    long pad1, pad2, pad3, pad4, pad5, pad6, pad7; // fill the rest of the cache line
    long counterB;
}
```

`LongAdder` in Java uses this technique internally — each thread updates a separate cell, preventing false sharing.

> **Gotcha:** false sharing can cause a 10-20x performance drop on highly contested data without any correctness issue. It won't cause bugs — just unexplained slowdowns under concurrency. Profile with hardware counters (cache miss rates) to diagnose it.

## Memory Reordering

For performance, CPUs and compilers are allowed to reorder memory operations as long as the result looks correct from the perspective of a single thread. But this reordering is visible to other threads.

```java
// As written:
x = 1;
ready = true;

// CPU or compiler may reorder to:
ready = true;
x = 1;

// Thread 2 sees ready=true but x=0
```

This is why language-level memory models (Java's JMM, C++'s memory model) exist — they define which reorderings are legal and what synchronisation operations (volatile, synchronized) prevent them. `volatile` inserts memory barriers that forbid the CPU from reordering across the barrier.

> **Gotcha:** this is not hypothetical. On ARM and POWER architectures, reordering happens regularly. x86 has a stronger memory model and masks many of these bugs — code that runs correctly on x86 can fail on ARM. Always use the language's memory model guarantees rather than relying on observed hardware behaviour.
