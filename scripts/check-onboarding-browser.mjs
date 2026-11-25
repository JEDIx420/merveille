/** Fictional browser-only fixtures. Does not authenticate or write to a real environment. */
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://127.0.0.1:8809';
const out='docs/evidence/remediation/onboarding';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];const actions=[];
const principal={id:'admin',email:'admin@example.invalid',name:'Fictional administrator',orgId:'org_review',role:'ADMIN',roles:['ADMIN'],projectMemberships:[]};
const people=[{id:'admin',name:'Fictional administrator',email:'admin@example.invalid',status:'ACTIVE',roles:['ADMIN'],projects:[]},{id:'employee',name:'Fictional employee',email:'employee@example.invalid',status:'ACTIVE',roles:[],projects:[]},{id:'client',name:'Fictional client',email:'client@example.invalid',status:'ACTIVE',roles:[],projects:[]}];
const project={id:'existing_review',code:'MD-EX-TEST',name:'Fictional ongoing house',status:'DRAFT',stage:'Site Execution & Supervision',site_location:'Fictional site',created_at:1};
try{
for(const width of [1440,1024,390]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let reject=false;
 await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;let data={ok:true};
 if(req.method()==='POST'){const payload=req.postDataJSON();actions.push({path,payload});if(reject){reject=false;return route.fulfill({status:422,json:{error:'Choose an active project manager.'}});} data=path==='/api/people'?{ok:true,invitationUrl:'/invite/accept#token=fictional',admissionStatus:'READY'}:{ok:true,projectId:project.id,status:'DRAFT'};}
 else if(path==='/api/session')data={principal,status:'AUTHENTICATED'};
 else if(path==='/api/people')data={ok:true,people,projects:[project],invitations:[]};
 else if(path==='/api/projects')data={projects:[project]};
 else if(path===`/api/projects/${project.id}`)data={project,stages:[],members:[],events:[],onboarding:{reported_start_date:'2025-01-02',handover_notes:'Structure completed; consultant approval evidence to review.',commercial_notes:'Original agreement and advance receipts to reconcile.'}};
 return route.fulfill({json:data});});
 await page.goto(base+'/people');await page.getByRole('button',{name:'Add employee',exact:true}).click();
 await page.getByLabel('Full name',{exact:true}).fill('Fictional new employee');await page.getByLabel('Exact email address',{exact:true}).fill('newemployee@example.invalid');
 await page.getByLabel('Default role for newly selected projects',{exact:true}).selectOption('TEAM_MEMBER');
 await page.getByLabel(project.name,{exact:true}).check();
 if(!await page.getByLabel('Team member',{exact:true}).isChecked())throw Error('Employee project role not applied');
 if(await page.getByLabel('Administrator — people, receipts, payroll and profit',{exact:true}).isChecked())throw Error('Employee silently elevated');
 await page.getByLabel('Prepare quotations and invoices',{exact:true}).check();
 await page.screenshot({path:`${out}/employee-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Create employee invitation',exact:true}).click();await page.getByRole('heading',{name:'Invitation created',exact:true}).waitFor();
 const invitation=actions.filter(a=>a.path==='/api/people').at(-1);if(invitation.payload.roles.length||invitation.payload.projects[0].roles[0]!=='TEAM_MEMBER'||!invitation.payload.projects[0].financeAuthor||invitation.payload.projects[0].invoiceIssue)throw Error('Employee permissions submitted incorrectly');
 await page.goto(base+'/projects');await page.getByRole('link',{name:'Add project',exact:true}).click();await page.getByRole('heading',{name:'Existing project',exact:true}).waitFor();
 await page.getByRole('button',{name:'Onboard existing project',exact:true}).click();
 await page.getByLabel('Project name',{exact:true}).fill(project.name);await page.getByLabel('Project code',{exact:true}).fill(project.code);await page.getByLabel('Site location',{exact:true}).fill(project.site_location);await page.getByLabel('Current stage',{exact:true}).selectOption(project.stage);await page.getByLabel('Project manager',{exact:true}).selectOption('admin');await page.getByLabel('Main client and contractual contact',{exact:true}).selectOption('client');await page.getByLabel('Fictional employee',{exact:true}).check();await page.getByLabel('Work completed and handover notes',{exact:true}).fill('Structure complete; records to reconcile.');await page.getByLabel('Quotation, payments and outstanding balances',{exact:true}).fill('Original commercial records to reconcile.');
 reject=true;await page.getByRole('button',{name:'Create project and continue setup',exact:true}).click();await page.getByText('Choose an active project manager.',{exact:true}).waitFor();if(await page.getByLabel('Project name',{exact:true}).inputValue()!==project.name)throw Error('Error discarded input');
 await page.screenshot({path:`${out}/existing-project-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Create project and continue setup',exact:true}).click();await page.getByRole('heading',{name:'Original handover record',exact:true}).waitFor();await page.getByText('Setup pending',{exact:true}).waitFor();
 const requests=actions.filter(a=>a.path==='/api/projects').slice(-2);if(requests[0].payload.requestKey!==requests[1].payload.requestKey)throw Error('Retry lost idempotency key');
 if((await page.getByRole('link',{name:'Reconcile the quotation, advance and outstanding records',exact:true}).getAttribute('href'))!==`/projects/${project.id}/finance`)throw Error('Broken finance setup link');
 await page.screenshot({path:`${out}/checklist-${width}.png`,fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Onboarding horizontal overflow');if(errors.length)throw Error(errors.join(';'));
 results.push({width,employeeScopedPermissions:true,existingProjectCreation:true,preservedErrorInput:true,retryKeyPreserved:true,setupChecklist:true,noOverflow:true,noJavaScriptErrors:true});await page.close();
}
 fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify({environment:base,scope:'Fictional intercepted API fixtures; server boundaries tested separately',results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
