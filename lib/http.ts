// Polite HTTP for every upstream: identifying User-Agent, timeout, retry with backoff,
// and a minimum gap between requests to the same host.

const MIN_GAP_MS = 2000;
const RETRIES = 3;
const TIMEOUT_MS = 20_000;

const lastRequestAt = new Map<string, number>();

export function userAgent(): string {
  const contact = process.env.APP_CONTACT_URL;
  return contact ? `WoodlandsCourtFinder/0.1 (+${contact})` : "WoodlandsCourtFinder/0.1";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTurn(host: string) {
  const wait = (lastRequestAt.get(host) ?? 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
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
    try {
      const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) return response;
      if (response.status < 500 || attempt >= RETRIES) throw new HttpError(response.status, url);
    } catch (err) {
      if (err instanceof HttpError || attempt >= RETRIES) throw err;
    }
    await sleep(1000 * 2 ** attempt);
  }
}
