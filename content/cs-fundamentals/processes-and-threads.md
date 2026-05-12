# Processes and Threads

## Process

A process is an independent running program. The OS gives each process its own isolated memory space — it cannot read or write another process's memory directly. Processes communicate via IPC (pipes, sockets, shared memory segments).

**What a process owns:**
- Virtual address space (heap, stack, code, data segments)
- File descriptors
- OS resources (sockets, handles)
- At least one thread

Creating a process is expensive: the OS must allocate a new address space, copy (or copy-on-write) the parent's memory, and set up kernel data structures.

## Thread

A thread is a unit of execution that lives inside a process. All threads in a process share the same heap memory, code, and file descriptors. Each thread has its own stack and program counter.

**What a thread owns (private):**
- Stack (local variables, call frames)
- Program counter (where it is in the code)
- Register state

**What threads share (with all threads in the process):**
- Heap (objects, global variables)
- Code
- File descriptors and sockets

This shared memory is what makes threads fast to communicate but also what makes them dangerous — any thread can corrupt shared state.

## Context Switching

When the OS switches between threads or processes it must save the current execution state and restore another. This is a context switch.

**What happens in a thread context switch:**
1. Save current thread's registers, stack pointer, program counter to its kernel thread structure
2. Load the next thread's saved state
3. If different process: also switch the virtual memory mapping (TLB flush) — much more expensive

**Cost:**
- Thread switch (same process): roughly 1–10 microseconds
- Process switch: roughly 10–100 microseconds (TLB flush, cache cold-start)

These numbers sound small but compound fast. A server doing 10,000 context switches per second spends meaningful CPU time just on switching, not on actual work. This is why event-loop models (Node.js, asyncio) and thread pools exist — they minimise context switching.

> **Gotcha:** more threads does not mean more throughput. Beyond the point where threads outnumber cores, adding threads increases context switching overhead without adding parallelism. The optimal thread count for CPU-bound work is roughly the number of CPU cores. For I/O-bound work it can be higher, but unbounded thread creation (e.g. `newCachedThreadPool` under load) will eventually hurt more than help.

## Comparison

| | Process | Thread |
|---|---|---|
| Memory | Isolated | Shared with siblings |
| Creation cost | High | Low |
| Context switch cost | High (TLB flush) | Low |
| Communication | IPC (pipes, sockets) | Shared memory (fast but risky) |
| Crash impact | Isolated — one crash doesn't kill others | Shared — one crash can kill the whole process |
| Parallelism | True (separate GIL/locks per process) | Depends on runtime (Java: yes, Python: no for CPU) |

## When to Use Each

**Multiple processes:** CPU-bound work in Python (bypasses the GIL), strong isolation between components (a crash in one worker doesn't affect others), microservices.

**Multiple threads:** I/O-bound work, shared in-memory data structures, low-latency coordination, any language without a GIL (Java, C++, Go).

**Neither (async/event loop):** very high numbers of concurrent I/O operations where most time is spent waiting — web scraping, API fan-out, chat servers.

> **Gotcha:** shared memory between threads is fast but requires synchronisation. Forgetting that two threads share the same object is the root cause of most concurrency bugs. When you see a bug that only appears under load or disappears when you add logging, suspect a race condition on shared state.
