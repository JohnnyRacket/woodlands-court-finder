import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, politeFetch } from "./http";

const reply = (status: number, headers: Record<string, string> = {}) => new Response(status === 200 ? "ok" : "error", { status, headers });

describe("politeFetch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Runs a request to completion through its waits and backoffs. */
  async function settle<T>(promise: Promise<T>): Promise<T> {
    const caught = promise.catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const result = await caught;
    if (result instanceof Error) throw result;
    return result as T;
  }

  it("retries server errors and rate limits, then returns the response", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(429, { "Retry-After": "30" })).mockResolvedValueOnce(reply(200));
    vi.stubGlobal("fetch", fetch);
    const response = await settle(politeFetch("https://a.example/data"));
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("doesn't retry other client errors", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(404));
    vi.stubGlobal("fetch", fetch);
    await expect(settle(politeFetch("https://b.example/missing"))).rejects.toThrow(HttpError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("spaces concurrent requests to the same host", async () => {
    const calledAt: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calledAt.push(Date.now());
        return reply(200);
      }),
    );
    await settle(Promise.all([1, 2, 3].map((n) => politeFetch(`https://d.example/${n}`))));
    expect(calledAt).toHaveLength(3);
    expect(calledAt[1] - calledAt[0]).toBeGreaterThanOrEqual(3000);
    expect(calledAt[2] - calledAt[1]).toBeGreaterThanOrEqual(3000);
  });

  it("gives up after three network failures, naming the URL", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);
    await expect(settle(politeFetch("https://c.example/down"))).rejects.toThrow("fetch failed (https://c.example/down)");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
