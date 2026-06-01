import fs from "node:fs";
import path from "node:path";

export function writeJsonAtomic(filePath: string, data: unknown): void {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

	const base = path.basename(filePath);
	const stamp = `${process.pid}.${Date.now()}`;
	const tmpPath = path.join(dir, `.${base}.${stamp}.tmp`);
	const bakPath = path.join(dir, `.${base}.${stamp}.bak`);

	fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");

	try {
		fs.renameSync(tmpPath, filePath);
		return;
	} catch {
		try {
			if (fs.existsSync(filePath)) {
				fs.renameSync(filePath, bakPath);
			}
			fs.renameSync(tmpPath, filePath);
			if (fs.existsSync(bakPath)) fs.rmSync(bakPath, { force: true });
			return;
		} catch (err2) {
			try {
				if (fs.existsSync(bakPath) && !fs.existsSync(filePath)) {
					fs.renameSync(bakPath, filePath);
				}
			} finally {
				if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
				if (fs.existsSync(bakPath)) fs.rmSync(bakPath, { force: true });
			}
			throw err2;
		}
	}
}
