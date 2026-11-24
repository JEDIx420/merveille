/** Infrastructure-authenticated recovery. No password or public recovery endpoint. */
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRemoteJWKSet, jwtVerify } from "jose";
const [environment, inputFile] = process.argv.slice(2);
if (!["local", "staging", "production"].includes(environment) || !inputFile)
  throw new Error(
    "Usage: node scripts/recover-identity.mjs <environment> <private input JSON>",
  );
const input = JSON.parse(await fs.readFile(inputFile, "utf8"));
if (
  !input.reason?.trim() ||
  !input.userId ||
  (!input.expectedOldSubject && input.linkUnbound !== true) ||
  !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(input.issuer) ||
  !input.audience
)
  throw new Error(
    "Supply verified recovery evidence and expected previous binding in private input.",
  );
const { payload } = await jwtVerify(
  input.assertion,
  createRemoteJWKSet(new URL(`${input.issuer}/cdn-cgi/access/certs`)),
  {
    issuer: input.issuer,
    audience: input.audience,
    algorithms: ["RS256"],
    requiredClaims: ["sub", "email", "exp", "iat"],
  },
);
if (
  payload.type !== "app" ||
  !payload.sub ||
  String(payload.email).toLowerCase().trim() !==
    input.email?.toLowerCase().trim() ||
  Date.now() / 1000 - Number(payload.iat) > 900 ||
  Number(payload.iat) > Date.now() / 1000 + 30
)
  throw new Error(
    "A fresh exact-account verified Google/Access identity is required.",
  );
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
// The migration trigger updates only an explicitly operator-verified binding, atomically with audit.
const statement = `INSERT INTO identity_recovery_requests(id,user_id,issuer,old_subject,new_subject,email,reason,created_at) VALUES(${q(crypto.randomUUID())},${q(input.userId)},${q(input.issuer)},${q(input.linkUnbound === true ? "" : input.expectedOldSubject)},${q(payload.sub)},${q(input.email.toLowerCase().trim())},${q(input.reason)},${Date.now()});`;
await fs.mkdir(".private", { recursive: true, mode: 0o700 });
const file = ".private/recovery.sql";
await fs.writeFile(file, statement, { mode: 0o600 });
const result = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    environment === "local" ? "--local" : "--remote",
    ...(environment === "local" ? [] : ["--env", environment]),
    "--file",
    file,
  ],
  { encoding: "utf8" },
);
await fs.unlink(file);
if (result.status !== 0) {
  console.error("Recovery failed. Review infrastructure logs privately.");
  process.exit(1);
}
console.log(
  "Identity binding recovered and audited. Capabilities and suspensions were preserved. Revoke old Access sessions before reopening access.",
);
