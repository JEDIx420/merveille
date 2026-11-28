/** Generates a preview-only config; never changes the current staging deployment. */
import fs from "node:fs/promises";
import path from "node:path";
const source=JSON.parse(await fs.readFile("wrangler.jsonc","utf8"));
const stage=source.env.staging;
if(stage.name!=="merveille-web-staging" || stage.d1_databases[0].database_id!=="55b52363-a87e-4b4f-a551-607ad26c6b20")throw new Error("Review the staging target before generating a preview config.");
const origin=process.env.STUDIO_PREVIEW_ORIGIN||"https://preview-not-ready.invalid";
if(origin!=="https://preview-not-ready.invalid" && !/^https:\/\/[a-z0-9-]+\.rhelo-bible\.workers\.dev$/.test(origin))throw new Error("Use the actual protected staging Preview origin.");
const config={
 "$schema":path.resolve("node_modules/wrangler/config-schema.json"),
 name:stage.name,account_id:stage.vars.ACCESS_ACCOUNT_ID,main:path.resolve(source.main),
 compatibility_date:source.compatibility_date,compatibility_flags:source.compatibility_flags,
 assets:{...source.assets,directory:path.resolve(source.assets.directory)},
 workers_dev:true,preview_urls:true,observability:{enabled:true,traces:{enabled:true}},
 previews:{vars:{...stage.vars,APP_ORIGIN:origin,AUTOMATIONS_ENABLED:"false",GEMINI_FREE_VERIFIED:"false"},
 d1_databases:stage.d1_databases.map(d=>({...d,migrations_dir:path.resolve(d.migrations_dir)})),r2_buckets:stage.r2_buckets},
};
await fs.mkdir(".private",{recursive:true});
await fs.writeFile(".private/studio-preview.wrangler.jsonc",JSON.stringify(config,null,2));
console.log("Generated preview-only configuration using the existing staging resources; automation execution and Gemini are disabled.");
