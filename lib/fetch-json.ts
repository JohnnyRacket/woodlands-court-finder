// GET JSON from our own API, for client components. Client-safe.

const TIMEOUT_MS = 15_000;
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

export class FetchStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });
}

/**
 * Fetches with a timeout, retrying once after network errors, timeouts and 5xx
 * (a dropped phone connection, a server mid-restart). 4xx are answers, not retried.
 */
export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    // One signal for the caller's abort and the timeout (not AbortSignal.any: it needs Safari 17.4, and Next supports 16.4).
    const request = new AbortController();
    const abort = () => request.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => request.abort(new DOMException("The request timed out", "TimeoutError")), TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: request.signal });
      if (response.ok) return (await response.json()) as T;
      if (response.status < 500 || attempt >= ATTEMPTS) throw new FetchStatusError(response.status);
    } catch (err) {
      if (signal.aborted || err instanceof FetchStatusError || attempt >= ATTEMPTS) throw err;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
    await wait(RETRY_DELAY_MS, signal);
  }
}
