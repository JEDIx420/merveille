/** Isolated, disposable workerd verification. Never uses remote bindings. */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  config = "tests/workerd/wrangler.jsonc",
  state = path.join(
    root,
    ".private/workerd-tests",
    new Date().toISOString().replaceAll(":", "-"),
  );
await mkdir(state, { recursive: true });
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
async function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    p.stdout.on("data", (c) => (log += c));
    p.stderr.on("data", (c) => (log += c));
    p.on("exit", (code) =>
      code === 0 ? resolve(log) : reject(new Error(log)),
    );
  });
}
for (const db of ["DB", "RESTORE_DB", "IDENTITY_DB"])
  await run([
    "d1",
    "migrations",
    "apply",
    db,
    "--local",
    "--force",
    "--config",
    config,
    "--persist-to",
    state,
  ]);
const child = spawn(
  process.execPath,
  [
    wrangler,
    "dev",
    "--local",
    "--config",
    config,
    "--persist-to",
    state,
    "--port",
    "8794",
    "--inspector-port",
    "9294",
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (c) => (logs += c));
child.stderr.on("data", (c) => (logs += c));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch("http://localhost:8794/");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!ready) throw new Error("Isolated workerd did not start. " + logs);
  const response = await fetch("http://localhost:8794/run", { method: "POST" });
  const result = await response.json();
  await writeFile(
    path.join(state, "result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok || !result.ok) process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await writeFile(path.join(state, "wrangler.log"), logs);
}
