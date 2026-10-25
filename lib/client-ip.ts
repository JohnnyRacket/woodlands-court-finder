/**
 * The client's address as the reverse proxy saw it. The proxy (Traefik on Dokploy) appends the
 * address it received the request from to X-Forwarded-For, so the rightmost entry is the only one
 * a client can't forge; anything to its left came from the client.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? headers.get("x-real-ip")?.trim() ?? "local";
}
