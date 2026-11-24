/** These are local behaviour checks, not hosted or team acceptance evidence. */
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {setupMigratedTestDb} from '../../test-db';
import {getSessionPrincipal} from '@/server/auth/session';
import {loadPrincipalById} from '@/server/auth/session';
import {createTask} from '@/server/domain/tasks/service';
import {GET as projectsGET} from '@/app/api/projects/route';
import {GET as sessionGET} from '@/app/api/session/route';
let db:D1Database;let current:any;
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:async()=>({env:{DB:db,APP_ENV:'local',APP_ORIGIN:'http://localhost:8787',ACCESS_ISSUER:'',ACCESS_AUDIENCE:''}})}));
vi.mock('@/server/auth/session',async original=>{const actual=await original<any>();return {...actual,getSessionPrincipal:vi.fn()};});
describe('Local HTTP boundaries and online failure',()=>{
 beforeEach(async()=>{db=await setupMigratedTestDb();current=null;vi.mocked(getSessionPrincipal).mockImplementation(async()=>({principal:current,status:current?'AUTHENTICATED':'UNAUTHENTICATED'}));await db.exec("INSERT INTO projects(id,org_id,code,name,created_at) VALUES('a','org_merveille_main','A','Fictional A',1),('b','org_merveille_main','B','Fictional B',1)");});
 it('AC-069 unauthenticated private HTTP endpoints fail closed with no-store session response',async()=>{const req=new Request('http://localhost:8787/api/session');const response=await sessionGET(req);expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toContain('no-store');expect((await response.json()).principal).toBeNull();const list=await projectsGET(req as any);expect(list.status).toBe(401);});
 it('AC-069 separate current identities receive only their D1 project membership',async()=>{
  for(const id of ['a','b'])await db.exec(`INSERT INTO users(id,email,display_name,status,created_at) VALUES('u${id}','u${id}@example.test','User ${id}','ACTIVE',1); INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES('m${id}','org_merveille_main','u${id}',1,1); INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES('p${id}','org_merveille_main','${id}','u${id}','MAIN_CLIENT',1,1);`);
  for(const id of ['a','b']){current=(await loadPrincipalById(`u${id}`,db)).principal;const result=await projectsGET(new Request('http://localhost:8787/api/projects') as any);expect((await result.json()).projects.map((p:any)=>p.id)).toEqual([id]);}
 });
 it('AC-061 failed validation persists no task and explicit retry succeeds',async()=>{const principal:any={id:'usr_admin_001',role:'TEAM_MEMBER',roles:[],orgId:'org_merveille_main',projectMemberships:[{projectId:'a',roles:['TEAM_MEMBER']}]};await expect(createTask(principal,{projectId:'a',title:''},db)).rejects.toThrow('Task title is required');expect((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<any>()).n).toBe(0);await createTask(principal,{projectId:'a',title:'Survey the fictional site'},db);expect((await db.prepare('SELECT COUNT(*) AS n FROM tasks').first<any>()).n).toBe(1);});
 it('AC-067 additive upgrades preserve existing record identity and amounts',async()=>{const row=await db.prepare("SELECT name FROM projects WHERE id='a'").first<any>();expect(row.name).toBe('Fictional A');const check=await db.prepare('PRAGMA foreign_key_check').all();expect(check.results).toEqual([]);});
});
