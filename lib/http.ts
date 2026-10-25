// Polite HTTP for every upstream: identifying User-Agent, timeout, retry with backoff,
// and a minimum gap between requests to the same host.

const MIN_GAP_MS = 3000;
const RETRIES = 3;
const TIMEOUT_MS = 20_000;

const lastRequestAt = new Map<string, number>();

export function userAgent(): string {
  const contact = process.env.APP_CONTACT_URL;
  return contact ? `WoodlandsCourtFinder/0.1 (+${contact})` : "WoodlandsCourtFinder/0.1";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTurn(host: string) {
  // Claim the next turn before sleeping, so callers waiting at the same time queue up instead of firing together.
  const turn = Math.max(Date.now(), (lastRequestAt.get(host) ?? 0) + MIN_GAP_MS);
  lastRequestAt.set(host, turn);
  const wait = turn - Date.now();
  if (wait > 0) await sleep(wait);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} from ${url}`);
  }
}

export async function politeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const host = new URL(url).host;
  const headers = new Headers(init.headers);
  headers.set("User-Agent", userAgent());

  for (let attempt = 1; ; attempt++) {
    await waitForTurn(host);
    let backoff = 1000 * 2 ** attempt;
    try {
      const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) return response;
      // Release the connection; the body of an error response is never read.
      await response.body?.cancel().catch(() => {});
      const retryable = response.status >= 500 || response.status === 429;
      if (!retryable || attempt >= RETRIES) throw new HttpError(response.status, url);
      // Honor a rate limit's Retry-After (in seconds), within reason.
      const retryAfter = Number(response.headers.get("retry-after"));
      if (retryAfter > 0) backoff = Math.max(backoff, Math.min(retryAfter, 60) * 1000);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Timeouts and network errors don't name the URL; say which request gave up.
      if (attempt >= RETRIES) throw new Error(`${err instanceof Error ? err.message : String(err)} (${url})`, { cause: err });
    }
    await sleep(backoff);
  }
}
