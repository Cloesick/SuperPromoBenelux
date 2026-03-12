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
