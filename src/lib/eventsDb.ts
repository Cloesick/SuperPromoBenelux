import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (cachedSql) return cachedSql;
  const conn = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!conn) return null;
  cachedSql = neon(conn);
  return cachedSql;
}

export type UtmAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

export type RecentEvent = {
  created_at: string;
  event_name: string;
  path: string | null;
  retailer: string | null;
  destination_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

export async function getRecentEvents(limit = 100): Promise<RecentEvent[]> {
  const sql = getSql();
  if (!sql) return [];

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 500) : 100;

  try {
    const result = await sql`
      SELECT
        created_at,
        event_name,
        path,
        retailer,
        destination_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content
      FROM sp_events
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;

    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as RecentEvent[];
  } catch {
    return [];
  }
}

export async function logEventToDb(args: {
  eventName: string;
  path?: string;
  retailer?: string;
  destinationUrl?: string;
  utm?: UtmAttribution;
  userAgent?: string | null;
  referrer?: string | null;
}) {
  const sql = getSql();
  if (!sql) return;

  const { utm } = args;

  try {
    await sql`
      INSERT INTO sp_events (
        event_name,
        path,
        retailer,
        destination_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        user_agent,
        referrer
      ) VALUES (
        ${args.eventName},
        ${args.path ?? null},
        ${args.retailer ?? null},
        ${args.destinationUrl ?? null},
        ${utm?.utm_source ?? null},
        ${utm?.utm_medium ?? null},
        ${utm?.utm_campaign ?? null},
        ${utm?.utm_content ?? null},
        ${args.userAgent ?? null},
        ${args.referrer ?? null}
      );
    `;
  } catch {
    return;
  }
}
