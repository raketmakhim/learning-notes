# Concurrency

## GIL

The Global Interpreter Lock is a mutex inside CPython that ensures only one thread executes Python bytecode at a time, even on a multi-core machine.

**Why it exists:** CPython's memory management (reference counting) is not thread-safe. The GIL is the simplest way to protect it without fine-grained locking on every object.

**What it blocks:** true parallel execution of Python threads. Two threads cannot run Python code simultaneously in the same process, regardless of how many CPU cores are available.

**What it does not block:**
- I/O operations — the GIL is released while a thread waits on network, disk, or subprocess calls, so other threads can run
- C extensions that explicitly release the GIL — NumPy, pandas, and most database drivers do this, so heavy number crunching in those libraries can run in parallel

> **Gotcha:** the GIL makes individual Python operations thread-safe in a limited sense (a reference count won't corrupt), but it does not make your application logic thread-safe. Race conditions on shared data structures still happen — the GIL just means threads take turns, not that they coordinate correctly.

## threading vs multiprocessing

The right tool depends on what is slowing your code down.

**I/O-bound tasks** (network requests, file reads, database queries): the bottleneck is waiting, not computing. `threading` works well here because the GIL is released during I/O, so threads genuinely run concurrently while waiting.

**CPU-bound tasks** (parsing, compression, numerical computation): the bottleneck is the CPU. `threading` won't help — threads still take turns on one core. Use `multiprocessing` instead: each process has its own Python interpreter and GIL, so they run truly in parallel across cores.

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# I/O-bound: threads
with ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(fetch_url, urls))

# CPU-bound: processes
with ProcessPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(compress_file, files))
```

**`concurrent.futures`** is the modern high-level API for both. Prefer it over managing `Thread` or `Process` objects directly unless you need low-level control.

**Key differences:**

| | threading | multiprocessing |
|---|---|---|
| Memory | Shared | Separate (copied) |
| Communication | Shared objects, Queue | Queue, Pipe, shared memory |
| Overhead | Low | Higher (process spawn) |
| GIL | Still applies | Each process has its own |
| Best for | I/O-bound | CPU-bound |

> **Gotcha:** `multiprocessing` spawns new processes, which on Windows means re-importing your module from scratch. Always guard your entry point with `if __name__ == "__main__":` or spawned processes will recursively launch more processes.

## asyncio

A single-threaded concurrency model based on an event loop. Instead of blocking while waiting for I/O, a coroutine suspends itself and hands control back to the loop, which runs another coroutine in the meantime.

**Key concepts:**
- **Event loop:** the scheduler that runs coroutines, handles I/O callbacks, and decides what runs next
- **Coroutine:** a function defined with `async def`. It can pause at `await` points without blocking the thread
- **`await`:** suspends the current coroutine until the awaited thing completes, allowing the event loop to run other work

```python
import asyncio
import aiohttp

async def fetch(session, url):
    async with session.get(url) as response:
        return await response.text()

async def main():
    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(
            fetch(session, "https://example.com"),
            fetch(session, "https://example.org"),
        )

asyncio.run(main())
```

**`asyncio.gather`** runs multiple coroutines concurrently. While one is waiting on a network response, others make progress.

**When to use asyncio:** high-concurrency I/O — thousands of simultaneous connections, web servers, chat systems. `asyncio` handles this with a single thread and far less overhead than spawning thousands of threads.

**When not to use asyncio:** CPU-bound work. A coroutine that burns CPU blocks the entire event loop — no other coroutines can run until it finishes. For CPU work within an async app, offload to a `ProcessPoolExecutor` via `loop.run_in_executor()`.

> **Gotcha:** you cannot call a regular blocking function (like `time.sleep()`, `requests.get()`) inside a coroutine without freezing the entire event loop. Use the async equivalents: `asyncio.sleep()`, `aiohttp`, `asyncpg`, etc. Mixing sync blocking calls into async code is the most common source of asyncio performance problems.
