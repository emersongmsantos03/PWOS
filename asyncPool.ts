export async function forEachConcurrent<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let index = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(items.length, Math.max(1, concurrency)) }, async () => {
    while (!failed && index < items.length) {
      const item = items[index++];
      try { await task(item); } catch (error) { failed = true; throw error; }
    }
  });
  const results = await Promise.allSettled(workers);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failure) throw failure.reason;
}
