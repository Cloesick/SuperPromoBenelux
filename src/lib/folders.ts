import fs from "fs";
import path from "path";
import { Folder, Deal, ScrapedData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "folders");

function readScrapedData(retailerSlug: string): ScrapedData | null {
  const filePath = path.join(DATA_DIR, `${retailerSlug}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    console.error(`Failed to read folder data for ${retailerSlug}`);
    return null;
  }
}

export function getFoldersForRetailer(retailerSlug: string): Folder[] {
  const data = readScrapedData(retailerSlug);
  return data?.folders ?? [];
}

export function getDealsForRetailer(retailerSlug: string): Deal[] {
  const data = readScrapedData(retailerSlug);
  return data?.deals ?? [];
}

export function getCurrentFolder(retailerSlug: string): Folder | null {
  const folders = getFoldersForRetailer(retailerSlug);
  if (folders.length === 0) return null;

  const now = new Date();
  const current = folders.find((f) => {
    const from = new Date(f.validFrom);
    const until = new Date(f.validUntil);
    return now >= from && now <= until;
  });

  return current ?? folders[0];
}

export function getScrapedAt(retailerSlug: string): Date | null {
  const data = readScrapedData(retailerSlug);
  return data?.scrapedAt ? new Date(data.scrapedAt) : null;
}

export function getAllCurrentFolders(): { slug: string; folder: Folder }[] {
  if (!fs.existsSync(DATA_DIR)) return [];

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));

  return files
    .map((file) => {
      const slug = file.replace(".json", "");
      const folder = getCurrentFolder(slug);
      if (!folder) return null;
      return { slug, folder };
    })
    .filter(Boolean) as { slug: string; folder: Folder }[];
}
