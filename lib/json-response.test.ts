import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { jsonResponse } from "./json-response";

const request = (acceptEncoding?: string) => new Request("http://localhost/api", { headers: acceptEncoding ? { "Accept-Encoding": acceptEncoding } : {} });
const large = { courts: Array.from({ length: 100 }, (_, i) => ({ id: `court-${i}`, name: "Tennis" })) };

describe("jsonResponse", () => {
  it("gzips large bodies for clients that accept it", async () => {
    const response = jsonResponse(request("gzip, deflate, br"), large);
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
    expect(JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString())).toEqual(large);
  });

  it("sends plain JSON to clients that don't, and for small bodies", async () => {
    expect(await jsonResponse(request(), large).json()).toEqual(large);
    const small = jsonResponse(request("gzip"), { ok: true }, { status: 201 });
    expect(small.headers.get("Content-Encoding")).toBeNull();
    expect(small.status).toBe(201);
    expect(await small.json()).toEqual({ ok: true });
  });
});
