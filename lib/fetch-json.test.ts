import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, FetchStatusError } from "./fetch-json";

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe("fetchJson", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function settle<T>(promise: Promise<T>): Promise<T | unknown> {
    const caught = promise.catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    return caught;
  }

  it("retries a server error or network failure once", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(503)).mockResolvedValueOnce(json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetch);
    expect(await settle(fetchJson("/api/a", new AbortController().signal))).toEqual({ ok: 1 });

    fetch.mockReset().mockRejectedValue(new TypeError("Load failed"));
    expect(await settle(fetchJson("/api/a", new AbortController().signal))).toBeInstanceOf(TypeError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry client errors", async () => {
    const fetch = vi.fn().mockResolvedValue(json(400));
    vi.stubGlobal("fetch", fetch);
    const err = await settle(fetchJson("/api/a", new AbortController().signal));
    expect(err).toBeInstanceOf(FetchStatusError);
    expect((err as FetchStatusError).status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("times out a request that hangs, and stops when the caller aborts", async () => {
    // A fetch that only ends when its signal aborts.
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason))));
    vi.stubGlobal("fetch", fetch);
    const timedOut = await settle(fetchJson("/api/a", new AbortController().signal));
    expect((timedOut as DOMException).name).toBe("TimeoutError");
    expect(fetch).toHaveBeenCalledTimes(2);

    fetch.mockClear();
    const controller = new AbortController();
    const pending = settle(fetchJson("/api/a", controller.signal));
    controller.abort();
    expect(((await pending) as DOMException).name).toBe("AbortError");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
