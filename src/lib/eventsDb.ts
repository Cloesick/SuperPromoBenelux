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

export type UtmContentMetric = {
  utm_content: string | null;
  retailer: string | null;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
};

export type RetailerMetric = {
  retailer: string | null;
  count: number;
  last_seen_at: string;
};

export type DailyMetric = {
  day: string;
  event_name: string;
  count: number;
};

export type UtmOnlyMetric = {
  utm_content: string | null;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
};

function clampInt(v: unknown, def: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.floor(n), min), max);
}

export async function getUtmOnlyMetrics(args: {
  eventName: string;
  limit?: number;
  days?: number;
}): Promise<UtmOnlyMetric[]> {
  const sql = getSql();
  if (!sql) return [];

  const safeLimit = clampInt(args.limit ?? 500, 500, 1, 5000);
  const days = clampInt(args.days ?? 365, 365, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        utm_content,
        COUNT(*)::int AS count,
        MIN(created_at)::text AS first_seen_at,
        MAX(created_at)::text AS last_seen_at
      FROM sp_events
      WHERE event_name = ${args.eventName}
        AND created_at >= ${since}
      GROUP BY utm_content
      ORDER BY count DESC
      LIMIT ${safeLimit}
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as UtmOnlyMetric[];
  } catch {
    return [];
  }
}

export async function getEventTotalCount(args: {
  eventName: string;
  days?: number;
}): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;

  const days = clampInt(args.days ?? 30, 30, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT COUNT(*)::int AS count
      FROM sp_events
      WHERE event_name = ${args.eventName}
        AND created_at >= ${since}
    `;
    if (!Array.isArray(result)) return 0;
    if (result.length === 0) return 0;
    const row = result[0] as { count?: unknown };
    const c = typeof row.count === "number" ? row.count : Number(row.count);
    return Number.isFinite(c) ? c : 0;
  } catch {
    return 0;
  }
}

export async function getEventCountForUtmContent(args: {
  eventName: string;
  utmContent: string;
  days?: number;
}): Promise<number> {
  const sql = getSql();
  if (!sql) return 0;

  const days = clampInt(args.days ?? 30, 30, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT COUNT(*)::int AS count
      FROM sp_events
      WHERE event_name = ${args.eventName}
        AND utm_content = ${args.utmContent}
        AND created_at >= ${since}
    `;
    if (!Array.isArray(result)) return 0;
    if (result.length === 0) return 0;
    const row = result[0] as { count?: unknown };
    const c = typeof row.count === "number" ? row.count : Number(row.count);
    return Number.isFinite(c) ? c : 0;
  } catch {
    return 0;
  }
}

export async function getOutboundClicksByRetailerForUtmContent(args: {
  utmContent: string;
  days?: number;
  limit?: number;
}): Promise<RetailerMetric[]> {
  const sql = getSql();
  if (!sql) return [];

  const limit = clampInt(args.limit ?? 200, 200, 1, 2000);
  const days = clampInt(args.days ?? 30, 30, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        retailer,
        COUNT(*)::int AS count,
        MAX(created_at)::text AS last_seen_at
      FROM sp_events
      WHERE event_name = 'outbound_click'
        AND utm_content = ${args.utmContent}
        AND created_at >= ${since}
      GROUP BY retailer
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as RetailerMetric[];
  } catch {
    return [];
  }
}

export async function getRecentEventsForUtmContent(args: {
  utmContent: string;
  days?: number;
  limit?: number;
}): Promise<RecentEvent[]> {
  const sql = getSql();
  if (!sql) return [];

  const limit = clampInt(args.limit ?? 200, 200, 1, 2000);
  const days = clampInt(args.days ?? 30, 30, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        created_at::text,
        event_name,
        path,
        retailer,
        destination_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content
      FROM sp_events
      WHERE utm_content = ${args.utmContent}
        AND created_at >= ${since}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as RecentEvent[];
  } catch {
    return [];
  }
}

export async function getUtmContentMetrics(args: {
  eventName: string;
  limit?: number;
  days?: number;
}): Promise<UtmContentMetric[]> {
  const sql = getSql();
  if (!sql) return [];

  const safeLimit = clampInt(args.limit ?? 200, 200, 1, 2000);
  const days = clampInt(args.days ?? 365, 365, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        utm_content,
        retailer,
        COUNT(*)::int AS count,
        MIN(created_at)::text AS first_seen_at,
        MAX(created_at)::text AS last_seen_at
      FROM sp_events
      WHERE event_name = ${args.eventName}
        AND created_at >= ${since}
      GROUP BY utm_content, retailer
      ORDER BY count DESC
      LIMIT ${safeLimit}
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as UtmContentMetric[];
  } catch {
    return [];
  }
}

export async function getRetailerMetrics(args: {
  eventName: string;
  limit?: number;
  days?: number;
}): Promise<RetailerMetric[]> {
  const sql = getSql();
  if (!sql) return [];

  const safeLimit = clampInt(args.limit ?? 200, 200, 1, 2000);
  const days = clampInt(args.days ?? 365, 365, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        retailer,
        COUNT(*)::int AS count,
        MAX(created_at)::text AS last_seen_at
      FROM sp_events
      WHERE event_name = ${args.eventName}
        AND created_at >= ${since}
      GROUP BY retailer
      ORDER BY count DESC
      LIMIT ${safeLimit}
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as RetailerMetric[];
  } catch {
    return [];
  }
}

export async function getDailyMetrics(args: {
  days?: number;
}): Promise<DailyMetric[]> {
  const sql = getSql();
  if (!sql) return [];

  const days = clampInt(args.days ?? 30, 30, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        event_name,
        COUNT(*)::int AS count
      FROM sp_events
      WHERE created_at >= ${since}
      GROUP BY day, event_name
      ORDER BY day DESC, event_name ASC
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as DailyMetric[];
  } catch {
    return [];
  }
}

export async function getEventsForExport(args: {
  eventName?: string;
  utmContent?: string;
  retailer?: string;
  limit?: number;
  days?: number;
}): Promise<RecentEvent[]> {
  const sql = getSql();
  if (!sql) return [];

  const limit = clampInt(args.limit ?? 5000, 5000, 1, 50000);
  const days = clampInt(args.days ?? 30, 30, 1, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await sql`
      SELECT
        created_at::text,
        event_name,
        path,
        retailer,
        destination_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content
      FROM sp_events
      WHERE created_at >= ${since}
        AND (${args.eventName ?? null} IS NULL OR event_name = ${args.eventName ?? null})
        AND (${args.utmContent ?? null} IS NULL OR utm_content = ${args.utmContent ?? null})
        AND (${args.retailer ?? null} IS NULL OR retailer = ${args.retailer ?? null})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    if (!Array.isArray(result)) return [];
    if (result.length > 0 && Array.isArray(result[0])) return [];
    return result as unknown as RecentEvent[];
  } catch {
    return [];
  }
}

export async function getRecentEvents(limit = 100): Promise<RecentEvent[]> {
  const sql = getSql();
  if (!sql) return [];

  const safeLimit = clampInt(limit, 100, 1, 500);

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
