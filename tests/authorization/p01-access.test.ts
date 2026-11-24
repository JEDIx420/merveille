import {describe,it,expect,beforeEach,vi,afterEach} from 'vitest';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {setupMigratedTestDb} from '../test-db';
import {validateAccessJwt} from '@/server/auth/jwt';
import {getSessionPrincipal,loadPrincipalById,assertSameOrigin} from '@/server/auth/session';
import {inviteUser,acceptInvitation,manageInvitation,disableUser,updateGrants,digestToken} from '@/server/domain/identity/service';
import {canPublishProjectUpdates,canViewFinancials,canViewPayrollAndProfit,canViewIndividualPerformance,canAcceptContractualDecisions} from '@/server/auth/policy';
import {hasCapability,UserPrincipal} from '@/server/auth/principal';
const issuer='https://merveille-tests.cloudflareaccess.com';
const admin:UserPrincipal={id:'usr_admin_001',email:'admin@example.test',name:'Admin',role:'ADMIN',roles:['ADMIN'],orgId:'org_merveille_main',projectMemberships:[],authenticatedAt:Date.now()};
const identity=(email:string,sub='subject')=>({email,sub,iss:issuer,aud:['aud'],iat:Math.floor(Date.now()/1000),nbf:0,exp:Math.floor(Date.now()/1000)+3600,type:'app'});
const raw=(url:string)=>url.split('#token=')[1];
describe('Real identities and independent capabilities',()=>{
 let db:D1Database;let env:CloudflareEnv;
 beforeEach(async()=>{db=await setupMigratedTestDb();env={DB:db,PROJECT_FILES:{} as any,APP_ENV:'local',APP_ORIGIN:'http://localhost:8787',ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:'aud',BUSINESS_TIMEZONE:'Asia/Kolkata',WHATSAPP_MODE:'fake'};await db.exec("INSERT INTO projects(id,org_id,code,name,created_at) VALUES('p1','org_merveille_main','P1','Fictional house',1),('p2','org_merveille_main','P2','Fictional office',1)");});
 afterEach(()=>vi.unstubAllGlobals());
 it('AC-008 verifies rotating JWKS signatures, issuer/audience/expiry and human identity',async()=>{
  const keys=await generateKeyPair('RS256');const jwk=await exportJWK(keys.publicKey);jwk.kid='rotation-1';
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({keys:[jwk]})));
  const sign=(claims:any)=>new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'rotation-1'}).sign(keys.privateKey);
  const good=await sign(identity('person@example.test'));expect((await validateAccessJwt(good,env)).valid).toBe(true);
  const parts=good.split('.');parts[1]=Buffer.from(JSON.stringify(identity('forged@example.test'))).toString('base64url');expect((await validateAccessJwt(parts.join('.'),env)).valid).toBe(false);
  for(const patch of [{aud:['wrong']},{iss:'https://evil.example'},{exp:1},{email:''},{type:'service'},{sub:''}])expect((await validateAccessJwt(await sign({...identity('p@example.test'),...patch}),env)).valid).toBe(false);
 });
 it('deployed synthetic headers and cookies never authenticate, even with legacy flag',async()=>{
  const result=await getSessionPrincipal(new Request('http://localhost:8787/api/session',{headers:{'x-merveille-synthetic-principal':'admin',cookie:'merveille_synthetic_principal=admin'}}),{...env,ALLOW_SYNTHETIC_AUTH:'true'} as any);expect(result.principal).toBeNull();
 });
 it('AC-001 matching Google identity consumes a digest-only invitation once; wrong account fails',async()=>{
  const inv=await inviteUser(admin,{email:' invited@example.test ',displayName:'Invited',projects:[{projectId:'p1',roles:['MAIN_CLIENT'],contractualAuthority:true}]},db);
  const token=raw(inv.invitationUrl);const stored=await db.prepare('SELECT token FROM invitations WHERE id=?').bind(inv.invitationId).first<any>();expect(stored.token).toBe(await digestToken(token));expect(stored.token).not.toBe(token);
  await expect(acceptInvitation(token,identity('wrong@example.test'),db)).rejects.toThrow(/Google account/);
  await expect(acceptInvitation(token,identity('invited@example.test'),db)).rejects.toThrow(/awaiting access setup/);
  await manageInvitation(admin,inv.invitationId,'READY',db);const user=await acceptInvitation(token,identity('invited@example.test'),db);
  const p=(await loadPrincipalById(user.userId,db)).principal!;expect(canAcceptContractualDecisions(p,'p1')).toBe(true);expect(canAcceptContractualDecisions(p,'p2')).toBe(false);
  await expect(acceptInvitation(token,identity('invited@example.test'),db)).rejects.toThrow(/already used/);
 });
 it('AC-002/003 scopes manager and representative grants per project; ADMIN and OWNER remain independent',()=>{
  const p={...admin,roles:['ADMIN','OWNER'] as any,projectMemberships:[{projectId:'p1',roles:['MANAGER'] as any},{projectId:'p2',roles:['CLIENT_REP'] as any}]};
  expect(canPublishProjectUpdates(p,'p1')).toBe(true);expect(canPublishProjectUpdates(p,'p2')).toBe(false);expect(canPublishProjectUpdates(admin,'p1')).toBe(false);
  expect(canViewPayrollAndProfit(admin)).toBe(true);expect(canViewIndividualPerformance(admin)).toBe(false);expect(canViewIndividualPerformance(p)).toBe(true);
  const rep={...p,roles:[],role:'CLIENT_REP' as const};expect(canViewFinancials(rep,'p2','CLIENT_COMMERCIAL')).toBe(false);expect(hasCapability(rep,'TEAM_MEMBER','p2')).toBe(false);
 });
 it('AC-006 current membership, status and identity binding are mandatory; missing roles do not become staff',async()=>{
  await db.exec("INSERT INTO users(id,email,display_name,status,created_at) VALUES('u','u@example.test','U','ACTIVE',1)");expect((await loadPrincipalById('u',db)).principal).toBeNull();
  await db.exec("INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES('m','org_merveille_main','u',1,1)");const p=(await loadPrincipalById('u',db)).principal!;expect(p.roles).toEqual([]);expect(hasCapability(p,'TEAM_MEMBER','p1')).toBe(false);
  await db.exec("UPDATE organization_memberships SET is_active=0 WHERE user_id='u'");expect((await loadPrincipalById('u',db)).principal).toBeNull();
 });
 it('last-admin protection is evaluated inside the atomic mutation',async()=>{
  await expect(disableUser(admin,admin.id,'test',db)).rejects.toThrow();expect((await loadPrincipalById(admin.id,db)).principal).not.toBeNull();
  await expect(updateGrants(admin,admin.id,{roles:[],projects:[],reason:'test'},db)).rejects.toThrow();expect((await loadPrincipalById(admin.id,db)).principal?.roles).toContain('ADMIN');
 });
 it('bootstrap accepts one exact authenticated identity and cannot be prepared twice',async()=>{
  const token='a'.repeat(64),hash=await digestToken(token),now=Date.now();await db.prepare("INSERT INTO bootstrap_setup(id,email,token_digest,invitation_id,operator_id,expires_at,admission_status,created_at) VALUES(1,?,?,?,?,?,'READY',?)").bind('jay@example.test',hash,'boot-inv','operator',now+3600000,now).run();
  const outcomes=await Promise.allSettled([acceptInvitation(token,identity('jay@example.test','jay'),db),acceptInvitation(token,identity('jay@example.test','jay'),db)]);expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const state=await db.prepare('SELECT consumed_at FROM bootstrap_state').first<any>();expect(state.consumed_at).toBeTruthy();const roles=await db.prepare("SELECT role FROM role_assignments WHERE user_id IN(SELECT id FROM users WHERE email='jay@example.test')").all();expect(roles.results.map((r:any)=>r.role)).toEqual(['ADMIN']);
 });
 it('rejects cross-origin mutations and validates canonical host',()=>{expect(()=>assertSameOrigin(new Request('http://localhost:8787/api/people',{method:'POST',headers:{origin:'https://evil.example'}}),env)).toThrow();expect(()=>assertSameOrigin(new Request('http://localhost:8787/api/people',{method:'POST',headers:{origin:env.APP_ORIGIN}}),env)).not.toThrow();});
 it('contractual authority can be preserved and deliberately removed without changing prior decisions',async()=>{
  const inv=await inviteUser(admin,{email:'authority@example.test',displayName:'Authority',projects:[{projectId:'p1',roles:['MAIN_CLIENT'],contractualAuthority:true}]},db);await manageInvitation(admin,inv.invitationId,'READY',db);const accepted=await acceptInvitation(raw(inv.invitationUrl),identity('authority@example.test'),db);
  await updateGrants(admin,accepted.userId,{roles:[],projects:[{projectId:'p1',roles:['MAIN_CLIENT'],contractualAuthority:true}],reason:'Preserve explicit authority'},db);
  expect(canAcceptContractualDecisions((await loadPrincipalById(accepted.userId,db)).principal,'p1')).toBe(true);
  await updateGrants(admin,accepted.userId,{roles:[],projects:[{projectId:'p1',roles:['CLIENT_REP']}],reason:'Remove contractual authority'},db);
  expect(canAcceptContractualDecisions((await loadPrincipalById(accepted.userId,db)).principal,'p1')).toBe(false);
  expect((await db.prepare("SELECT main_client_user_id FROM projects WHERE id='p1'").first<any>()).main_client_user_id).toBeNull();
 });

});
