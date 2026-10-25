import { promisify } from "node:util";
import { gzip } from "node:zlib";

const gzipAsync = promisify(gzip);

/** Smaller than this isn't worth compressing. */
const MIN_GZIP_BYTES = 1024;

/**
 * Response.json, gzipped when the client accepts it. Next compresses pages but not
 * route handler responses, and court JSON (outlines, labels) shrinks several times over.
 * Compression runs on the thread pool, so it doesn't hold up other requests.
 */
export async function jsonResponse(request: Request, data: unknown, init: ResponseInit = {}): Promise<Response> {
  const body = JSON.stringify(data);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.append("Vary", "Accept-Encoding");
  if (body.length < MIN_GZIP_BYTES || !/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
    return new Response(body, { ...init, headers });
  }
  headers.set("Content-Encoding", "gzip");
  return new Response(new Uint8Array(await gzipAsync(body)), { ...init, headers });
}
