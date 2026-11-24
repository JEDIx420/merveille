import { afterEach, expect, it, vi } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { reconcileAccessAdmission } from "@/server/auth/admission";
afterEach(() => vi.unstubAllGlobals());
it("serializes policy writes and never marks an in-flight new invitation ready", async () => {
  const DB = await setupMigratedTestDb();
  const org = "org_merveille_main";
  async function invite(id: string) {
    await DB.prepare("INSERT INTO invitations(id,org_id,email,display_name,intended_role,token,status,expires_at,created_by,created_at,admission_status) VALUES(?,?,?,?,'EXPLICIT',?,'PENDING',?,'usr_admin_001',?,'PENDING_SETUP')")
      .bind(id,org,`${id}@example.invalid`,id,id,Date.now()+600000,Date.now()).run();
  }
  await invite("first");
  await DB.prepare("INSERT INTO access_admission_jobs(id,org_id,email,desired_state,created_at) VALUES('revoke',?,'removed@example.invalid','REVOKE',?)").bind(org,Date.now()).run();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const requests: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (options.method !== "PUT") return Response.json({success:true,result:{id:"policy",app_count:1,decision:"allow",mfa_config:{mfa_disabled:false},require:[{auth_method:{auth_method:"mfa"}}],exclude:[{ip:{ip:"192.0.2.0/24"}}]}});
    requests.push(JSON.parse(options.body)); entered(); await wait;
    return Response.json({success:true});
  }));
  const env = {DB,ACCESS_ACCOUNT_ID:"test",ACCESS_APP_ID:"app",ACCESS_POLICY_ID:"policy",ACCESS_API_TOKEN:"fixture",ACCESS_IDP_ID:"11111111-1111-1111-1111-111111111111"};
  const first = reconcileAccessAdmission(env,org);
  await started;
  await invite("second");
  expect((await reconcileAccessAdmission(env,org)).status).toBe("RETRY");
  release();
  expect((await first).status).toBe("READY");
  expect(requests).toHaveLength(1);
  expect(requests[0].include).toEqual([{email:{email:"first@example.invalid"}}]);
  expect(requests[0].mfa_config).toEqual({mfa_disabled:false});
  expect(requests[0].require).toContainEqual({auth_method:{auth_method:"mfa"}});
  expect(requests[0].exclude).toEqual([{ip:{ip:"192.0.2.0/24"}}]);
  expect((await DB.prepare("SELECT status FROM access_admission_jobs WHERE id='revoke'").first<any>())?.status).toBe("COMPLETE");
  expect((await DB.prepare("SELECT admission_status FROM invitations WHERE id='second'").first<any>())?.admission_status).toBe("PENDING_SETUP");
  expect((await reconcileAccessAdmission(env,org)).status).toBe("READY");
  expect((await DB.prepare("SELECT admission_status FROM invitations WHERE id='second'").first<any>())?.admission_status).toBe("READY");
  const sharedPolicy = vi.fn(async (_url, options) => {
    expect(options.method).not.toBe("PUT");
    return Response.json({success:true,result:{id:"policy",app_count:2,decision:"allow"}});
  });
  vi.stubGlobal("fetch", sharedPolicy);
  expect((await reconcileAccessAdmission(env,org)).status).toBe("RETRY");
  expect(sharedPolicy).toHaveBeenCalledTimes(1);
});
