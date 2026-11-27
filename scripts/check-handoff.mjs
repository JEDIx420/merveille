#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const files = [];
const skip = new Set([
  ".git",
  ".private",
  ".next-ui",
  "test-results",
  "playwright-report",
  "node_modules",
  ".wrangler",
  ".next",
  ".open-next",
  "dist",
  "coverage",
]);
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) files.push(path);
  }
}
await walk(root);
const rel = (path) => relative(root, path).split(sep).join("/");
const inventory = new Set(files.map(rel));
const textCache = new Map();
async function text(path) {
  if (!textCache.has(path)) textCache.set(path, await readFile(path, "utf8"));
  return textCache.get(path);
}
function fail(message) {
  failures.push(message);
}
async function json(path) {
  try {
    return JSON.parse(await text(resolve(root, path)));
  } catch (error) {
    fail(path + ": invalid/missing JSON: " + error.message);
    return null;
  }
}
let checkedLinks = 0;
async function link(source, raw) {
  if (/^(https?:|mailto:|data:|tel:|#)/i.test(raw)) return;
  const noAnchor = raw.split("#")[0].split("?")[0];
  if (!noAnchor) return;
  let path;
  try {
    path = resolve(dirname(source), decodeURIComponent(noAnchor));
  } catch {
    fail(rel(source) + ": malformed local link " + raw);
    return;
  }
  if (relative(root, path).startsWith("..")) {
    fail(rel(source) + ": local link escapes repository " + raw);
    return;
  }
  checkedLinks++;
  try {
    await stat(path);
  } catch {
    fail(rel(source) + ": missing link target " + raw);
  }
}
const fence = String.fromCharCode(96).repeat(3);
const fencedCode = new RegExp("^" + fence + "[\\s\\S]*?^" + fence, "gm");
for (const file of files) {
  if (extname(file) === ".md") {
    const content = (await text(file)).replace(fencedCode, "");
    const pattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
    for (const match of content.matchAll(pattern)) await link(file, match[1]);
  }
  if (extname(file) === ".html") {
    for (const match of (await text(file)).matchAll(
      /(?:href|src)=["']([^"']+)["']/g,
    ))
      await link(file, match[1]);
  }
}
const lower = new Map();
for (const path of inventory) {
  const folded = path.toLowerCase();
  if (lower.has(folded) && lower.get(folded) !== path)
    fail("Case-insensitive path collision: " + path);
  lower.set(folded, path);
}
const manifest = await json("docs/implementation/manifest.json");
const acceptance = await json("docs/quality/acceptance-cases.json");
const brand = await json("assets/brand/brand.json");
const brandSources = await json("assets/brand/sources.json");
const cases = acceptance?.cases || [];
const caseMap = new Map();
const requirementText = await text(
  resolve(root, "docs/product/requirements.md"),
);
const requirements = new Set(
  [...requirementText.matchAll(/^\|\s*(REQ-[A-Z]+-\d+)\s*\|/gm)].map(
    (m) => m[1],
  ),
);
const covered = new Set();
for (const item of cases) {
  if (caseMap.has(item.id)) fail("Duplicate acceptance ID " + item.id);
  caseMap.set(item.id, item);
  for (const field of ["suite", "title", "given", "when", "then"])
    if (!item[field]) fail(item.id + ": missing " + field);
  if (!["not-run", "pass", "fail", "blocked"].includes(item.status))
    fail(item.id + ": invalid status");
  if (item.status === "pass" && !item.evidence)
    fail(item.id + ": pass without evidence");
  for (const id of item.requirements || []) {
    if (!requirements.has(id)) fail(item.id + ": unknown requirement " + id);
    covered.add(id);
  }
}
for (const id of requirements)
  if (!covered.has(id)) fail("Requirement has no acceptance case: " + id);
const phases = manifest?.phases || [];
const phaseMap = new Map();
for (const phase of phases) {
  if (phaseMap.has(phase.id)) fail("Duplicate phase " + phase.id);
  phaseMap.set(phase.id, phase);
  if (!inventory.has(phase.file))
    fail(phase.id + ": missing phase file " + phase.file);
}
const assigned = new Set();
const positions = new Map(phases.map((p, i) => [p.id, i]));
for (const phase of phases) {
  for (const dependency of phase.dependsOn || []) {
    if (!phaseMap.has(dependency))
      fail(phase.id + ": unknown dependency " + dependency);
    if (positions.get(dependency) >= positions.get(phase.id))
      fail(phase.id + ": dependency order is not topological");
  }
  if (!phase.acceptance?.length) fail(phase.id + ": no acceptance cases");
  for (const id of phase.acceptance || []) {
    if (!caseMap.has(id)) fail(phase.id + ": unknown acceptance " + id);
    assigned.add(id);
  }
}
for (const id of caseMap.keys())
  if (!assigned.has(id)) fail("Acceptance case has no phase: " + id);
for (const asset of Object.values(brand?.assets || {})) {
  if (!inventory.has("assets/brand/" + asset))
    fail("Missing brand asset " + asset);
}
if (
  brand?.name !== "Merveille Designs" ||
  brand?.nameStatus !== "confirmed-company-identity"
) {
  fail("Brand metadata must preserve the confirmed Merveille Designs identity");
}
const sourcedAssets = new Set();
for (const source of brandSources?.assets || []) {
  sourcedAssets.add(source.path);
  const assetPath = "assets/brand/" + source.path;
  if (!inventory.has(assetPath)) {
    fail("Missing sourced brand asset " + assetPath);
    continue;
  }
  const digest = createHash("sha256")
    .update(await readFile(resolve(root, assetPath)))
    .digest("hex");
  if (digest !== source.sha256)
    fail("Brand source integrity mismatch: " + assetPath);
}
for (const asset of Object.values(brand?.assets || {})) {
  if (!sourcedAssets.has(asset))
    fail("Brand asset has no source record: " + asset);
}
const requiredEntrypoints = [
  "README.md",
  "START_HERE.md",
  "AGENTS.md",
  "GEMINI.md",
  "agent.md",
  "task.md",
  "implementation_plan.md",
  "walkthrough.md",
  ".agents/skills/build-merveille/SKILL.md",
  "docs/implementation/antigravity-kickoff.md",
  "docs/implementation/skills-and-tools.md",
];
for (const path of requiredEntrypoints)
  if (!inventory.has(path)) fail("Missing entry point " + path);
const skill = await text(
  resolve(root, ".agents/skills/build-merveille/SKILL.md"),
);
if (!/^---\nname: build-merveille\ndescription: .+\n---\n/.test(skill))
  fail("Build skill frontmatter missing name/description");
if (/\[TODO:/.test(skill)) fail("Build skill contains template TODO");
for (const path of inventory) {
  if (/\.agents\/rules\/[^/]+\.md$/.test(path)) {
    const content = await text(resolve(root, path));
    if (
      !/^---\ntrigger: (always_on|model_decision|glob|manual)\n/m.test(content)
    )
      fail(path + ": invalid rule trigger");
  }
}
const remediation=await json('docs/remediation/manifest.json');
const stages=remediation?.stages??[];
const seenStages=new Set();
const statuses=new Set(['not-started','in-progress','passed','failed','blocked']);
for(const stage of stages){
 if(seenStages.has(stage.id))fail('Duplicate remediation stage '+stage.id);
 for(const dependency of stage.dependsOn??[])if(!seenStages.has(dependency))fail(stage.id+': unordered/unknown dependency '+dependency);
 for(const field of ['implementation','localVerification','hostedVerification','teamAcceptance'])if(!statuses.has(stage[field]))fail(stage.id+': invalid '+field);
 for(const evidence of stage.evidence??[])if(!inventory.has(evidence))fail(stage.id+': missing evidence '+evidence);
 seenStages.add(stage.id);
}
if(stages.length!==6)fail('Expected six preserved remediation stages');

// The next-phase work order is additive. Keep checking the historical manifests,
// requirement coverage and brand integrity rather than replacing their evidence.
const nextPhase = await json("docs/next-phase/manifest.json");
const nextStages = nextPhase?.stages || [];
const nextStageIds = new Set();
const nextAssigned = new Set();
const nextAcceptancePath = nextPhase?.acceptanceFile;
let nextAcceptanceText = "";
if (inventory.has(nextAcceptancePath)) {
  nextAcceptanceText = await text(resolve(root, nextAcceptancePath));
} else {
  fail("Next phase: missing acceptance file " + nextAcceptancePath);
}
const nextCases = new Set(
  [...nextAcceptanceText.matchAll(/^\|\s*(NAC-\d{3})\s*\|/gm)].map(
    (match) => match[1],
  ),
);
if (nextPhase?.kind !== "active-free-tier-next-phase-plan")
  fail("Next phase: missing active work-order kind");
for (const path of [
  nextPhase?.activeAmendment,
  nextPhase?.entryPoint,
  nextPhase?.sourcesFile,
  ...(nextPhase?.historicalManifests || []),
]) {
  if (!inventory.has(path)) fail("Next phase: missing referenced file " + path);
}
const expectedConstraints = {
  cloudflarePlan: "free",
  paidFallback: false,
  speech: "disabled",
  whatsapp: "manual-prepared-share",
  externalWhatsAppDispatch: false,
  billing: "external",
  existingData: "preserve",
  actualFreeDeploymentRequired: true,
};
for (const [key, value] of Object.entries(expectedConstraints)) {
  if (nextPhase?.constraints?.[key] !== value)
    fail("Next phase: current scope constraint mismatch for " + key);
}
for (const stage of nextStages) {
  if (nextStageIds.has(stage.id)) fail("Duplicate next-phase stage " + stage.id);
  for (const dependency of stage.dependsOn || []) {
    if (!nextStageIds.has(dependency))
      fail(stage.id + ": unordered/unknown dependency " + dependency);
  }
  for (const path of [stage.file, ...(stage.read || []), ...(stage.evidence || [])]) {
    if (!inventory.has(path)) fail(stage.id + ": missing referenced file " + path);
  }
  for (const field of [
    "implementation", "localVerification", "hostedVerification", "teamAcceptance",
  ]) {
    if (!statuses.has(stage[field]) && !(stage.id==="N03" && stage[field]==="deferred" && nextPhase.activeAmendment==="docs/design/simple-workspace.md")) fail(stage.id + ": invalid " + field);
    if (stage[field] === "passed" && !stage.evidence?.length)
      fail(stage.id + ": " + field + " passed without evidence");
    if (stage[field] === "blocked" && !stage.blockers?.length)
      fail(stage.id + ": " + field + " blocked without an explanation");
  }
  if (!stage.acceptance?.length) fail(stage.id + ": no acceptance cases");
  for (const id of stage.acceptance || []) {
    if (!nextCases.has(id)) fail(stage.id + ": unknown acceptance " + id);
    nextAssigned.add(id);
  }
  nextStageIds.add(stage.id);
}
if (nextStages.map((stage) => stage.id).join(",") !== "N00,N01,N02,N03,N04,N05")
  fail("Expected next-phase stages N00-N05 in order");
for (const id of nextCases) {
  if (!nextAssigned.has(id)) fail("Next-phase acceptance has no stage: " + id);
}
if (nextCases.size !== 13) fail("Expected thirteen next-phase acceptance cases");
if (remediation?.supersededForExecutionBy !== "docs/next-phase/manifest.json")
  fail("Remediation manifest must identify the current execution manifest");
const result = {
  ok: failures.length === 0,
  files: files.length,
  markdownFiles: files.filter((f) => extname(f) === ".md").length,
  checkedLocalLinks: checkedLinks,
  phases: phases.length,
  remediationStages: stages.length,
  nextPhaseStages: nextStages.length,
  nextPhaseAcceptanceCases: nextCases.size,
  acceptanceCases: cases.length,
  requirements: requirements.size,
  coveredRequirements: [...requirements].filter((x) => covered.has(x)).length,
  applicationTestsRun: false,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
