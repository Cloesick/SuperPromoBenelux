import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "folders");

function parseArgs(argv) {
  const args = { retailers: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--retailers") {
      args.retailers = argv[i + 1] ?? "";
      i++;
    }
  }
  return args;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isCurrent(folder, today) {
  const from = new Date(folder.validFrom);
  const until = new Date(folder.validUntil);
  from.setHours(0, 0, 0, 0);
  until.setHours(0, 0, 0, 0);
  return today >= from && today <= until;
}

function selectFoldersToValidate(retailersCsv) {
  if (retailersCsv && retailersCsv.trim().length > 0) {
    return retailersCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return ["albert-heijn", "lidl", "delhaize", "colruyt", "aldi", "action"];
}

const EXPECTED_MIN_PAGES = {
  aldi: 8,
  lidl: 8,
  delhaize: 8,
  colruyt: 8,
  action: 4,
};

function summarizeProblems(problems) {
  return problems
    .map((p) => `- ${p.retailer}: ${p.code}${p.detail ? ` (${p.detail})` : ""}`)
    .join("\n");
}

function isBlockingProblem(code) {
  return (
    code === "missing_file" ||
    code === "invalid_json" ||
    code === "no_folders" ||
    code === "pagecount_suspicious"
  );
}

async function notifyDiscord(message) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch {
    return;
  }
}

async function main() {
  const { retailers } = parseArgs(process.argv);
  const slugs = selectFoldersToValidate(retailers);
  const today = startOfToday();

  const problems = [];

  for (const slug of slugs) {
    const filePath = path.join(DATA_DIR, `${slug}.json`);

    if (!fs.existsSync(filePath)) {
      problems.push({ retailer: slug, code: "missing_file" });
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      problems.push({ retailer: slug, code: "invalid_json" });
      continue;
    }

    const folders = Array.isArray(data.folders) ? data.folders : [];
    if (folders.length === 0) {
      problems.push({ retailer: slug, code: "no_folders" });
      continue;
    }

    const current = folders.find((f) => isCurrent(f, today));
    if (!current) {
      problems.push({ retailer: slug, code: "no_current_folder" });
      continue;
    }

    const hasPages = Array.isArray(current.pages) && current.pages.length > 0;
    const minPages = EXPECTED_MIN_PAGES[slug];

    if (typeof minPages === "number" && hasPages && current.pages.length < minPages) {
      problems.push({
        retailer: slug,
        code: "pagecount_suspicious",
        detail: `pages=${current.pages.length}, expected>=${minPages}`,
      });
    }
  }

  if (problems.length > 0) {
    const blocking = problems.filter((p) => isBlockingProblem(p.code));
    const warnings = problems.filter((p) => !isBlockingProblem(p.code));

    if (warnings.length > 0) {
      const header = `Scrape validation WARN (${new Date().toISOString()})`;
      const body = summarizeProblems(warnings);
      const msg = `${header}\n\n${body}`;
      console.warn(msg);
      await notifyDiscord(msg);
    }

    if (blocking.length > 0) {
      const header = `Scrape validation FAILED (${new Date().toISOString()})`;
      const body = summarizeProblems(blocking);
      const msg = `${header}\n\n${body}`;
      console.error(msg);
      await notifyDiscord(msg);
      process.exit(1);
    }
  }

  console.log(`Scrape validation OK (${new Date().toISOString()}) for: ${slugs.join(", ")}`);
}

main();
