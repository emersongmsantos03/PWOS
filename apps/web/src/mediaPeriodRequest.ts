// Retry only the explicit "sync busy" response; other failures reach the UI.
export async function requestMediaPeriod(url: string, signal: AbortSignal) {
  while (true) {
    signal.throwIfAborted();
    const response = await fetch(url, { signal });
    const payload = await response.json();
    if (response.status !== 409 || payload.code !== "GOOGLE_SYNC_BUSY") return { response, payload };
    await new Promise<void>((resolve, reject) => {
      const aborted = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, 1500);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) aborted();
    });
  }
}
