import { z } from "zod";
import { politeFetch } from "@/lib/http";

// Client for the Township's public ActiveNet site. This is the internal API its own
// web pages use (no login), so every response is validated before it is trusted.

const SITE = "https://anc.apm.activecommunities.com/wcscparksandrec";
const LANDING = `${SITE}/reservation/landing/quick?locale=en-US&groupId=20`;

export const FACILITY_GROUPS = { tennis: 20, pickleball: 25 } as const;

const envelopeSchema = z.object({
  headers: z.object({
    response_code: z.string(),
    response_message: z.string(),
    page_info: z.object({ total_page: z.number() }).optional(),
  }),
  body: z.unknown(),
});

/** The largest page ActiveNet returns, whatever is requested. */
const PAGE_SIZE = 20;

export class ActiveNetClient {
  private session?: { cookie: string; csrf: string };

  private async getSession() {
    if (this.session) return this.session;
    const response = await politeFetch(LANDING, { headers: { Accept: "text/html" } });
    const html = await response.text();
    const csrf = html.match(/__csrfToken\s*=\s*"([^"]+)"/)?.[1];
    if (!csrf) throw new Error("ActiveNet landing page no longer contains __csrfToken");
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    this.session = { cookie, csrf };
    return this.session;
  }

  async request<T extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: T,
    options: { body?: unknown; page?: number } = {},
  ): Promise<z.infer<T>> {
    return (await this.send(method, path, schema, options)).body;
  }

  /** Fetches every page of a paged list endpoint and returns the bodies in order. */
  async requestAllPages<T extends z.ZodType>(path: string, schema: T, body: unknown): Promise<z.infer<T>[]> {
    const bodies: z.infer<T>[] = [];
    for (let page = 1; ; page++) {
      const result = await this.send("POST", path, schema, { body, page });
      bodies.push(result.body);
      if (page >= (result.totalPages ?? 1)) return bodies;
    }
  }

  private async send<T extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: T,
    options: { body?: unknown; page?: number },
  ): Promise<{ body: z.infer<T>; totalPages?: number }> {
    const { cookie, csrf } = await this.getSession();
    const url = `${SITE}/rest${path}${path.includes("?") ? "&" : "?"}locale=en-US`;
    const response = await politeFetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        Cookie: cookie,
        ...(options.page && {
          page_info: JSON.stringify({ order_by: "", page_number: options.page, total_records_per_page: PAGE_SIZE }),
        }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const { headers, body } = envelopeSchema.parse(await response.json());
    if (headers.response_code !== "0000") {
      throw new Error(`ActiveNet ${path}: ${headers.response_code} ${headers.response_message}`);
    }
    return { body: schema.parse(body), totalPages: headers.page_info?.total_page };
  }
}

export const availabilitySchema = z.object({
  availability: z.object({
    time_slots: z.array(z.string()),
    resources: z.array(
      z.object({
        resource_id: z.number(),
        resource_name: z.string(),
        time_slot_details: z.array(z.object({ status: z.number() })),
      }),
    ),
  }),
});

export type Availability = z.infer<typeof availabilitySchema>["availability"];

/** One request returns every court in a facility group with its hourly slots for that date. */
export async function fetchAvailability(client: ActiveNetClient, groupId: number, date: string): Promise<Availability> {
  const body = await client.request("POST", "/reservation/quickreservation/availability", availabilitySchema, {
    body: {
      facility_group_id: groupId,
      customer_id: 0,
      company_id: 0,
      reserve_date: date,
      start_time: "07:00:00",
      end_time: "23:00:00",
      resident: true,
      reload: false,
      change_time_range: false,
    },
  });
  return body.availability;
}
