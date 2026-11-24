/** Operator-only, never a web endpoint. Input file must be private and ignored. */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const [environment, inputFile] = process.argv.slice(2);
if (!["local", "staging", "production"].includes(environment) || !inputFile) {
  throw new Error(
    "Usage: node scripts/bootstrap-admin.mjs <local|staging|production> <private JSON file>",
  );
}
const input = JSON.parse(await fs.readFile(inputFile, "utf8"));
const email = input.email?.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? ""))
  throw new Error("Supply the exact Google email privately.");
const raw = crypto.randomBytes(32).toString("hex"),
  hash = crypto.createHash("sha256").update(raw).digest("hex"),
  now = Date.now(),
  inv = crypto.randomUUID(),
  operator = crypto.randomUUID();
const quote = (v) => `'${String(v).replaceAll("'", "''")}'`;
if (!input.origin || !/^https?:\/\//.test(input.origin))
  throw new Error("Supply the canonical review origin.");
const sql = `INSERT INTO bootstrap_setup(id,email,token_digest,invitation_id,operator_id,expires_at,admission_status,created_at) VALUES(1,${quote(email)},'${hash}','${inv}','${operator}',${now + 72 * 3600000},${input.accessAdmissionConfirmed === true ? "'READY'" : "'PENDING_SETUP'"},${now});`;

await fs.mkdir(".private", { recursive: true, mode: 0o700 });
const file = ".private/bootstrap.sql";
await fs.writeFile(file, sql, { mode: 0o600 });
// Execute supports SQL transaction files. Never put private email/token on command arguments or stdout.
const args = [
  "wrangler",
  "d1",
  "execute",
  "DB",
  environment === "local" ? "--local" : "--remote",
  ...(environment === "local" ? [] : ["--env", environment]),
  "--file",
  file,
];
const result = spawnSync("npx", args, { encoding: "utf8" });
await fs.unlink(file);
if (result.status !== 0) {
  console.error(
    "Bootstrap failed. Inspect private infrastructure logs; no invitation link was produced.",
  );
  process.exit(1);
}
await fs.writeFile(
  ".private/bootstrap-link.txt",
  `${input.origin}/invite/accept#token=${raw}\n`,
  { mode: 0o600 },
);
console.log(
  "Bootstrap created. Read the private link in .private/bootstrap-link.txt. Admission must be confirmed before acceptance.",
);
