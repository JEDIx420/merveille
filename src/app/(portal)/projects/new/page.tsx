"use client";
import Link from "next/link";
import styles from "./page.module.css";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {useSession} from "@/components/session";
import {hasCapability} from "@/server/auth/principal";
import {PageHeader,Field,Button,ErrorState,LoadingState,readResponse,ui} from "@/components/ui";
import {PROJECT_STAGES} from "@/shared/project-onboarding";
export default function AddProject() {
  const {principal,loading}=useSession(), router=useRouter();
  const [existing,setExisting]=useState(false),[people,setPeople]=useState<any[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const requestKey=useRef("");
  const admin=hasCapability(principal,"ADMIN");
  useEffect(()=>{if(admin) fetch("/api/people").then(readResponse).then(d=>{setPeople(d.people.filter((p:any)=>p.status==="ACTIVE"));setReady(true);}).catch(e=>setError(e.message));},[admin]);
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=new FormData(e.currentTarget);setBusy(true);setError("");
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    try {
      const result=await readResponse(await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestKey:requestKey.current,code:form.get("code"),name:form.get("name"),siteLocation:form.get("siteLocation"),stage:form.get("stage"),managerUserId:form.get("manager"),mainClientUserId:form.get("client"),teamUserIds:form.getAll("team"),reportedStartDate:form.get("startDate"),handoverNotes:form.get("handover"),commercialNotes:form.get("commercial")})}));
      router.push(`/projects/${result.projectId}/onboarding`);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  if(loading)return <LoadingState label="Loading project setup…"/>;
  if(!principal)return <ErrorState message="Sign in to add a project."/>;
  const canIntake=admin||principal.intakeAccess||hasCapability(principal,"OWNER");
  return <div className={ui.page}>
    <PageHeader title={existing?"Onboard an existing project":"Add project"} description={existing?"Bring ongoing work into your workspace, with its current stage and a traceable handover.":"Start a new enquiry or bring an ongoing commission onto the platform."}/>
    {error&&<ErrorState message={error}/>}
    {!existing?<div className={styles.choices}>
      {canIntake&&<section className={ui.panel}><h2>New enquiry</h2><p>A potential commission, starting with requirements, feasibility and a quotation.</p><Link className={ui.button} href="/enquiries/new">Create enquiry</Link></section>}
      {admin?<section className={ui.panel}><h2>Existing project</h2><p>Work already underway. Record the current stage, assign the team and reconcile its commercial records without creating a lead.</p><Button onClick={()=>setExisting(true)}>Onboard existing project</Button></section>:<p>An administrator can onboard existing projects and assign their team.</p>}
    </div>:<>
      <p className={ui.meta}>This creates a project in <strong>Setup pending</strong>. It does not approve drawings, confirm payments or activate work.</p>
      {!ready?<LoadingState label="Loading available people…"/>:<form onSubmit={submit} className={ui.form}>
        <section className={`${ui.panel} ${styles.section}`}><h2>Project details</h2>
          <Field label="Project name"><input name="name" required maxLength={160}/></Field>
          <Field label="Project code" help="Use your existing reference, for example MD-2026-014."><input name="code" required maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9._/\u002d]*"/></Field>
          <Field label="Site location"><input name="siteLocation" required maxLength={250}/></Field>
          <Field label="Current stage"><select name="stage">{PROJECT_STAGES.map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Original start date (optional)"><input type="date" name="startDate" max={new Date().toISOString().slice(0,10)}/></Field>
          <Field label="Work completed and handover notes" help="Record what has happened so far and what remains. Earlier stages will not be marked approved or completed automatically."><textarea name="handover" required maxLength={5000} rows={4}/></Field>
        </section>
        <section className={`${ui.panel} ${styles.section}`}><h2>People and project access</h2>
          <p>Only active accounts appear here. <Link href="/people" target="_blank" rel="noreferrer">Add an employee or invite a client</Link> first, then reopen this page after they accept.</p>
          <Field label="Project manager" help="This explicitly grants manager authority on this project only."><select name="manager" required defaultValue=""><option value="" disabled>Choose a manager</option>{people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Main client and contractual contact" help="Optional during setup. The chosen account receives client access and contractual decision authority for this project."><select name="client" defaultValue=""><option value="">Assign later</option>{people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>
          <fieldset><legend>Employees on this project</legend><p className={ui.meta}>Selected employees receive Team member access on this project. Finance preparation and issuing are separate grants, available in People & access.</p>{people.map(p=><label className={ui.checkbox} key={p.id}><input type="checkbox" name="team" value={p.id}/>{p.name}</label>)}</fieldset>
        </section>
        <section className={`${ui.panel} ${styles.section}`}><h2>Commercial handover</h2><Field label="Quotation, payments and outstanding balances" help="Describe existing references, amounts and any gaps or disputed balances. These are handover notes, not posted financial entries."><textarea name="commercial" required maxLength={5000} rows={4}/></Field><p className={ui.meta}>Next, attach the original records, prepare and obtain acceptance of the quotation, and have an administrator confirm qualifying receipts. The assigned manager activates the project only after the existing checks pass. Never invent an invoice or receipt to match a balance.</p></section>
        <div className={ui.actions}><Button type="submit" disabled={busy}>{busy?"Creating project…":"Create project and continue setup"}</Button><Button secondary type="button" onClick={()=>setExisting(false)} disabled={busy}>Back</Button></div>
      </form>}
    </>}
  </div>;
}
