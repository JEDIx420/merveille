import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { FinanceService } from "../finance/service";
import { atomicGuard } from "@/server/db/atomic";
import { PROJECT_STAGES } from "@/shared/project-onboarding";

export interface ExistingProjectInput {
  requestKey: string; code: string; name: string; siteLocation: string;
  stage: string; managerUserId: string; mainClientUserId?: string;
  teamUserIds?: string[]; reportedStartDate?: string;
  handoverNotes: string; commercialNotes: string;
}
const invalid = (message: string) => new AuthorizationError(message, "INVALID_INPUT");
function text(value: unknown, label: string, max: number, optional = false) {
  if (typeof value !== "string" || (!optional && !value.trim()) || value.length > max)
    throw invalid(`${label} is required and must be at most ${max} characters.`);
  return value.trim();
}
export async function onboardExistingProject(actor: UserPrincipal, input: ExistingProjectInput, db: D1Database) {
  if (!hasCapability(actor, "ADMIN")) throw new AuthorizationError("Only administrators can onboard existing projects and assign access.", "FORBIDDEN");
  const currentAdmin = await db.prepare(`SELECT 1 FROM users u JOIN organization_memberships m ON m.user_id=u.id
    JOIN role_assignments r ON r.user_id=u.id AND r.org_id=m.org_id
    WHERE u.id=? AND u.status='ACTIVE' AND m.org_id=? AND m.is_active=1 AND r.role='ADMIN' AND r.revoked_at IS NULL`).bind(actor.id, actor.orgId).first();
  if (!currentAdmin) throw new AuthorizationError("Administrator access has changed. Sign in again.", "FORBIDDEN");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("Supply project details.");
  const v = {
    requestKey: text(input.requestKey, "Request reference", 100),
    code: text(input.code, "Project code", 40), name: text(input.name, "Project name", 160),
    siteLocation: text(input.siteLocation, "Site location", 250), stage: text(input.stage, "Current stage", 80),
    managerUserId: text(input.managerUserId, "Project manager", 100),
    mainClientUserId: text(input.mainClientUserId ?? "", "Client", 100, true),
    reportedStartDate: text(input.reportedStartDate ?? "", "Start date", 10, true),
    handoverNotes: text(input.handoverNotes, "Work completed and handover notes", 5000),
    commercialNotes: text(input.commercialNotes, "Commercial handover", 5000),
    teamUserIds: input.teamUserIds ?? [],
  };
  if (!PROJECT_STAGES.includes(v.stage as any)) throw invalid("Choose a supported project stage.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(v.code)) throw invalid("Use letters, numbers, dots, hyphens or slashes for the project code.");
  if (v.reportedStartDate && (!/^\d{4}-\d{2}-\d{2}$/.test(v.reportedStartDate) || !Number.isFinite(Date.parse(v.reportedStartDate)) || new Date(v.reportedStartDate).toISOString().slice(0,10)!==v.reportedStartDate || v.reportedStartDate > new Date().toISOString().slice(0,10))) throw invalid("Enter a valid start date that is not in the future.");
  if (!Array.isArray(v.teamUserIds) || v.teamUserIds.length > 100 || v.teamUserIds.some(id=>typeof id!=="string" || id.length>100)) throw invalid("Choose active team members.");
  v.teamUserIds = [...new Set(v.teamUserIds)].sort();
  if (v.mainClientUserId && (v.mainClientUserId === v.managerUserId || v.teamUserIds.includes(v.mainClientUserId))) throw invalid("Keep the client identity separate from the internal team.");
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(v))))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const replay = await db.prepare("SELECT project_id,request_fingerprint FROM project_onboarding WHERE org_id=? AND request_key=?").bind(actor.orgId,v.requestKey).first<any>();
  if (replay) {
    if (replay.request_fingerprint !== fingerprint) throw invalid("This request reference was already used for different project details.");
    return {projectId:replay.project_id,status:"DRAFT",replayed:true};
  }
  if (await db.prepare("SELECT id FROM projects WHERE code=?").bind(v.code).first()) throw invalid("This project code is already in use. Choose another code.");
  const people = [...new Set([v.managerUserId,...v.teamUserIds,...(v.mainClientUserId?[v.mainClientUserId]:[])])];
  const plan = [FinanceService.activeGuard(db,actor), atomicGuard(db,"EXISTS(SELECT 1 FROM role_assignments WHERE user_id=? AND org_id=? AND role='ADMIN' AND revoked_at IS NULL)",[actor.id,actor.orgId])];
  const activePeopleSql = "SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id IN (SELECT value FROM json_each(?)) AND u.status='ACTIVE' AND m.org_id=? AND m.is_active=1";
  if ((await db.prepare(activePeopleSql).bind(JSON.stringify(people),actor.orgId).first<{n:number}>())?.n !== people.length)
    throw invalid("Choose active people from this organisation. Invite them first if needed.");
  plan.push(atomicGuard(db,`(${activePeopleSql}) = ?`,[JSON.stringify(people),actor.orgId,people.length]));
  const projectId=crypto.randomUUID(), now=Date.now();
  plan.push(db.prepare(`INSERT INTO projects(id,org_id,code,name,site_location,stage,status,manager_user_id,main_client_user_id,created_at) VALUES(?,?,?,?,?,?,'DRAFT',?,?,?)`).bind(projectId,actor.orgId,v.code,v.name,v.siteLocation,v.stage,v.managerUserId,v.mainClientUserId||null,now));
  for (const [i,stage] of PROJECT_STAGES.entries()) plan.push(db.prepare("INSERT INTO project_stages(id,project_id,stage_order,name,status,revision) VALUES(?,?,?,?,'PENDING',1)").bind(crypto.randomUUID(),projectId,i+1,stage));
  for (const id of people) {
    const role=id===v.mainClientUserId?"MAIN_CLIENT":id===v.managerUserId?"MANAGER":"TEAM_MEMBER";
    plan.push(db.prepare("INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES(?,?,?,?,?,1,?)").bind(crypto.randomUUID(),actor.orgId,projectId,id,role,now));
  }
  plan.push(db.prepare("INSERT INTO project_onboarding(project_id,org_id,request_key,request_fingerprint,reported_start_date,handover_notes,commercial_notes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(projectId,actor.orgId,v.requestKey,fingerprint,v.reportedStartDate||null,v.handoverNotes,v.commercialNotes,actor.id,now));
  plan.push(FinanceService.audit(db,actor,"PROJECT",projectId,"EXISTING_PROJECT_ONBOARDED",{code:v.code,reportedStage:v.stage,status:"DRAFT",managerUserId:v.managerUserId,mainClientUserId:v.mainClientUserId||null,teamUserIds:v.teamUserIds}));
  await FinanceService.commit(db,plan);
  return {projectId,status:"DRAFT",replayed:false};
}
