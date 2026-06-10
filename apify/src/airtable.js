// Minimal Airtable REST client — upserts Folders and Deals into the
// "SuperPromo — Deals Engine" base (appILxwPpKEWomToC).
//
// Credentials come from Apify input / env, never hard-coded:
//   AIRTABLE_TOKEN  — personal access token with data.records:write on the base
//   AIRTABLE_BASE   — base id (default appILxwPpKEWomToC)

const API = 'https://api.airtable.com/v0';

export class Airtable {
  constructor({ token, baseId }) {
    if (!token) throw new Error('AIRTABLE_TOKEN missing');
    this.token = token;
    this.baseId = baseId || 'appILxwPpKEWomToC';
  }

  async #req(method, table, body) {
    const res = await fetch(`${API}/${this.baseId}/${encodeURIComponent(table)}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable ${method} ${table} ${res.status}: ${text}`);
    }
    return res.json();
  }

  /** Upsert one folder row, merging on "Folder ID". Returns the record id. */
  async upsertFolder(folder) {
    const payload = {
      performUpsert: { fieldsToMergeOn: ['Folder ID'] },
      records: [
        {
          fields: {
            'Folder ID': folder.id,
            Title: folder.title,
            'Valid From': folder.validFrom,
            'Valid Until': folder.validUntil,
            'Page Count': folder.pageCount,
            'Thumbnail URL': folder.thumbnailUrl,
            'Source URL': folder.sourceUrl,
            'Scraped At': folder.scrapedAt,
            Status: 'Active',
          },
        },
      ],
      typecast: true,
    };
    const out = await this.#req('PATCH', 'Folders', payload);
    return out.records[0].id;
  }

  /** Create deal rows in batches of 10, linked to a folder record. */
  async createDeals(deals, folderRecordId) {
    for (let i = 0; i < deals.length; i += 10) {
      const batch = deals.slice(i, i + 10).map((d) => ({
        fields: {
          Product: d.product,
          'Original Price': d.originalPrice,
          'Promo Price': d.promoPrice,
          Discount: d.discount,
          'Valid From': d.validFrom,
          'Valid Until': d.validUntil,
          Source: 'Apify',
          'Scraped At': d.scrapedAt,
          Status: 'Active',
          ...(folderRecordId ? { Folder: [folderRecordId] } : {}),
        },
      }));
      await this.#req('POST', 'Deals', { records: batch, typecast: true });
    }
  }
}
