# CompletableFuture

## The Problem with Future

`Future<T>` represents a result that isn't ready yet. The problem: the only way to get the result is `get()`, which blocks the calling thread until the computation finishes.

```java
Future<Price> future = executor.submit(() -> fetchPrice("AAPL"));
Price price = future.get(); // blocks — this thread does nothing while waiting
```

In a system making dozens of async calls, blocking threads per call wastes resources and kills throughput. `CompletableFuture` solves this by letting you attach callbacks that run when the result is ready, so threads are never blocked waiting.

## Creating a CompletableFuture

```java
// Run async, returns CompletableFuture<Void>
CompletableFuture.runAsync(() -> System.out.println("fire and forget"));

// Supply a value async, returns CompletableFuture<T>
CompletableFuture<Price> cf = CompletableFuture.supplyAsync(() -> fetchPrice("AAPL"));

// With a custom executor (recommended in production)
CompletableFuture<Price> cf = CompletableFuture.supplyAsync(
    () -> fetchPrice("AAPL"),
    myExecutorService
);
```

Without a custom executor, `supplyAsync` uses the common `ForkJoinPool`. In production, always supply your own executor so you control thread count and naming.

> **Gotcha:** the common `ForkJoinPool` is shared across the entire JVM. Blocking operations or CPU-heavy tasks submitted to it can starve other users of the pool (e.g. parallel streams). Always use a dedicated executor for I/O-bound async work.

## Transforming Results — thenApply and thenCompose

**`thenApply`** — transforms the result synchronously (like `map`). Runs on the completing thread.

```java
CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> fetchPrice("AAPL"))   // CompletableFuture<Price>
    .thenApply(price -> format(price));       // CompletableFuture<String>
```

**`thenCompose`** — chains another async operation (like `flatMap`). Use when the next step also returns a `CompletableFuture`.

```java
CompletableFuture<Order> result = CompletableFuture
    .supplyAsync(() -> validateOrder(order))    // CompletableFuture<Order>
    .thenCompose(o -> submitToExchange(o));     // returns CompletableFuture<Order>
```

**Key difference:** `thenApply(f)` where `f` returns `CompletableFuture<T>` gives you `CompletableFuture<CompletableFuture<T>>` — nested and unusable. `thenCompose` flattens it to `CompletableFuture<T>`.

**`thenApplyAsync`** — same transformation but runs the function on a separate thread, not the completing thread. Use when the transformation is expensive.

```java
.thenApplyAsync(price -> expensiveConversion(price), executor)
```

> **Gotcha:** `thenApply` vs `thenApplyAsync` — the non-async variant runs on whichever thread completed the previous stage. If that thread is a critical I/O thread, you can accidentally block it with a slow transformation. When in doubt in production, use the `Async` variant with an explicit executor.

## Combining Results — thenCombine and allOf

**`thenCombine`** — waits for two independent futures and combines their results.

```java
CompletableFuture<Price>  priceFuture  = fetchPriceAsync("AAPL");
CompletableFuture<Volume> volumeFuture = fetchVolumeAsync("AAPL");

CompletableFuture<String> summary = priceFuture.thenCombine(
    volumeFuture,
    (price, volume) -> price + " vol:" + volume
);
```

Both fetches run in parallel — `thenCombine` fires only when both are done.

**`allOf`** — waits for all futures in a collection. Returns `CompletableFuture<Void>`, so you retrieve results separately.

```java
List<String> symbols = List.of("AAPL", "GOOG", "MSFT");

List<CompletableFuture<Price>> futures = symbols.stream()
    .map(s -> fetchPriceAsync(s))
    .toList();

CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
    .thenRun(() -> {
        List<Price> prices = futures.stream()
            .map(CompletableFuture::join) // safe here — all are done
            .toList();
        processPrices(prices);
    });
```

**`anyOf`** — completes as soon as any one future completes. Returns the first result.

```java
CompletableFuture.anyOf(primary, fallback)
    .thenAccept(result -> use((Price) result));
```

> **Gotcha:** `allOf` does not short-circuit on failure. If one future fails, `allOf` still waits for the others before completing exceptionally. If you want to cancel remaining futures on first failure, you need to handle this manually.

## Error Handling

**`exceptionally`** — recover from an exception with a fallback value.

```java
CompletableFuture<Price> result = fetchPriceAsync("AAPL")
    .exceptionally(ex -> {
        log.warn("Price fetch failed: {}", ex.getMessage());
        return Price.ZERO; // fallback
    });
```

**`handle`** — runs regardless of success or failure. Receives both the result and the exception (one will be null).

```java
CompletableFuture<String> result = fetchPriceAsync("AAPL")
    .handle((price, ex) -> {
        if (ex != null) return "unavailable";
        return format(price);
    });
```

**`whenComplete`** — side-effect on completion (logging, metrics). Does not transform the value.

```java
fetchPriceAsync("AAPL")
    .whenComplete((price, ex) -> {
        if (ex != null) metrics.recordFailure();
        else metrics.recordSuccess();
    });
```

> **Gotcha:** if you don't attach an `exceptionally` or `handle` handler and the future fails, the exception is silently swallowed. You will never hear about it unless something calls `get()` or `join()` on the future. Always handle errors on async pipelines.

## join vs get

Both block until the future completes and return the result.

- `get()` throws checked `InterruptedException` and `ExecutionException` — must be caught
- `join()` throws unchecked `CompletionException` — cleaner in lambdas and streams

```java
// In a lambda — join is cleaner
futures.stream().map(CompletableFuture::join).toList();

// Outside a stream — get makes exception handling explicit
try {
    Price p = future.get(5, TimeUnit.SECONDS);
} catch (TimeoutException e) {
    // handle timeout
}
```

> **Gotcha:** calling `join()` or `get()` on a `CompletableFuture` inside another `CompletableFuture` stage can deadlock if both are running on the same single-threaded executor. The inner `join` blocks the thread that the outer stage needs to complete.

## FinTech Examples

**Parallel market data fetch:**

```java
CompletableFuture<Price>  price  = CompletableFuture.supplyAsync(() -> fetchPrice("AAPL"),  ioExecutor);
CompletableFuture<Volume> volume = CompletableFuture.supplyAsync(() -> fetchVolume("AAPL"), ioExecutor);
CompletableFuture<News>   news   = CompletableFuture.supplyAsync(() -> fetchNews("AAPL"),   ioExecutor);

CompletableFuture.allOf(price, volume, news).thenRun(() -> {
    buildReport(price.join(), volume.join(), news.join());
});
```

All three requests run in parallel — total latency is the slowest of the three, not the sum.

**Order pipeline with error handling:**

```java
CompletableFuture<OrderResult> result = CompletableFuture
    .supplyAsync(() -> validateOrder(order), executor)
    .thenCompose(o  -> checkRiskLimits(o))
    .thenCompose(o  -> submitToExchange(o))
    .thenApply(resp -> OrderResult.success(resp))
    .exceptionally(ex -> OrderResult.failed(ex.getMessage()));
```

**Timeout pattern:**

```java
CompletableFuture<Price> withTimeout = fetchPriceAsync("AAPL")
    .orTimeout(500, TimeUnit.MILLISECONDS)          // Java 9+
    .exceptionally(ex -> Price.STALE);              // use last known price on timeout
```
