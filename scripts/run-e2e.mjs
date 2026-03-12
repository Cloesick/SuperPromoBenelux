import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    open: args.has("--open"),
    port: (() => {
      const idx = argv.indexOf("--port");
      if (idx === -1) return null;
      const v = argv[idx + 1];
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
  };
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        server.close(() => resolve(true));
      })
      .listen(port, "127.0.0.1");
  });
}

async function findFreePort(start, end) {
  for (let port = start; port <= end; port++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  return null;
}

async function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.ok) return;
    } catch {
      // ignore
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }

    await new Promise((r) => setTimeout(r, 250));
  }
}

async function assertLooksLikeSuperPromo(baseUrl) {
  const homeRes = await fetch(`${baseUrl}/`, { redirect: "follow" });
  if (!homeRes.ok) {
    throw new Error(`Expected ${baseUrl}/ to be OK, got ${homeRes.status}`);
  }

  const homeHtml = await homeRes.text();
  if (!homeHtml.includes("SuperPromo")) {
    throw new Error(
      `Server at ${baseUrl} does not look like SuperPromo (missing 'SuperPromo' in homepage HTML)`
    );
  }

  const foldersRes = await fetch(`${baseUrl}/folders`, { redirect: "follow" });
  if (!foldersRes.ok) {
    throw new Error(
      `Expected ${baseUrl}/folders to be OK, got ${foldersRes.status}`
    );
  }

  const robotsRes = await fetch(`${baseUrl}/robots.txt`, { redirect: "follow" });
  if (!robotsRes.ok) {
    throw new Error(
      `Expected ${baseUrl}/robots.txt to be OK, got ${robotsRes.status}`
    );
  }
}

function killProcessTree(child) {
  if (!child.pid) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function withWindowsSystemPaths(env) {
  if (process.platform !== "win32") return env;

  const systemRoot = env.SystemRoot || env.SYSTEMROOT || "C:\\Windows";
  const required = [
    path.join(systemRoot, "System32"),
    path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0"),
  ];

  const currentPath = env.Path || env.PATH || "";
  const parts = currentPath.split(";").filter(Boolean);

  const has = (p) =>
    parts.some((x) => x.toLowerCase() === p.toLowerCase());

  for (const p of required) {
    if (!has(p)) parts.push(p);
  }

  const nextPath = parts.join(";");
  return {
    ...env,
    PATH: nextPath,
    Path: nextPath,
  };
}

async function main() {
  const { open, port: requestedPort } = parseArgs(process.argv.slice(2));

  const nextCmd =
    process.platform === "win32"
      ? path.resolve(process.cwd(), "node_modules", ".bin", "next.cmd")
      : path.resolve(process.cwd(), "node_modules", ".bin", "next");

  const cypressCmd =
    process.platform === "win32"
      ? path.resolve(process.cwd(), "node_modules", ".bin", "cypress.cmd")
      : path.resolve(process.cwd(), "node_modules", ".bin", "cypress");

  const port =
    requestedPort ??
    (await findFreePort(3100, 3199)) ??
    (() => {
      throw new Error("No free port found in range 3100-3199");
    })();

  const baseUrl = `http://localhost:${port}`;

  const childEnv = withWindowsSystemPaths({
    ...process.env,
    PORT: String(port),
  });

  const next = spawn(
    nextCmd,
    ["dev", "-p", String(port)],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: childEnv,
    },
  );

  const nextExit = new Promise((resolve) => {
    next.on("exit", (code, signal) => {
      resolve({ code: code ?? null, signal: signal ?? null });
    });
  });

  const cleanup = () => killProcessTree(next);
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  try {
    await Promise.race([
      (async () => {
        await waitForHttpOk(`${baseUrl}/`, 60_000);
        await assertLooksLikeSuperPromo(baseUrl);
      })(),
      (async () => {
        const { code, signal } = await nextExit;
        throw new Error(
          `next dev exited before tests ran (code=${code ?? "null"}, signal=${signal ?? "null"})`
        );
      })(),
    ]);

    const cypressArgs = open
      ? ["open", "--config", `baseUrl=${baseUrl}`]
      : ["run", "--config", `baseUrl=${baseUrl}`];

    const cypress = spawn(
      cypressCmd,
      cypressArgs,
      {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: childEnv,
      },
    );

    const exitCode = await new Promise((resolve, reject) => {
      cypress.on("error", reject);
      cypress.on("exit", (code) => resolve(code ?? 1));
    });

    process.exitCode = exitCode;
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
