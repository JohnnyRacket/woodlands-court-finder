import { gzipSync } from "node:zlib";

/** Smaller than this isn't worth compressing. */
const MIN_GZIP_BYTES = 1024;

/**
 * Response.json, gzipped when the client accepts it. Next compresses pages but not
 * route handler responses, and the explorer's JSON shrinks about 7×.
 */
export function jsonResponse(request: Request, data: unknown, init: ResponseInit = {}): Response {
  const body = JSON.stringify(data);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.append("Vary", "Accept-Encoding");
  if (body.length < MIN_GZIP_BYTES || !/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
    return new Response(body, { ...init, headers });
  }
  headers.set("Content-Encoding", "gzip");
  return new Response(gzipSync(body), { ...init, headers });
}
