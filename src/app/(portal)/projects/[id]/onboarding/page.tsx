"use client";
import {use,useEffect,useState} from "react";
import Link from "next/link";
import {PageHeader,LoadingState,ErrorState,Badge,readResponse,ui} from "@/components/ui";
export default function Onboarding({params}:{params:Promise<{id:string}>}) {
 const {id}=use(params);const [data,setData]=useState<any>(null),[error,setError]=useState("");
 async function load(){setError("");try{setData(await readResponse(await fetch(`/api/projects/${id}`)));}catch(e:any){setError(e.message);}}
 useEffect(()=>{load();},[id]);
 if(error)return <ErrorState message={error} retry={load}/>;
 if(!data)return <LoadingState label="Loading project setup…"/>;
 if(!data.onboarding)return <ErrorState message="No existing-project onboarding record is available to this account."/>;
 const p=data.project,o=data.onboarding;
 return <div className={ui.page}><PageHeader title={`${p.name} · project setup`} description="Bring the existing records together, reconcile them and complete the normal commercial approvals."/>
 <section className={ui.panel}><Badge>{p.status==="DRAFT"?"Setup pending":p.status}</Badge><h2>Original handover record</h2><p>Reported stage: <strong>{p.stage}</strong>{o.reported_start_date?` · Started ${o.reported_start_date}`:""}</p><h3>Work completed and next steps</h3><p style={{whiteSpace:"pre-wrap"}}>{o.handover_notes}</p><h3>Commercial history to reconcile</h3><p style={{whiteSpace:"pre-wrap"}}>{o.commercial_notes}</p><p className={ui.meta}>These notes preserve the onboarding account. They do not certify earlier approvals, verify payments or change ledger balances.</p></section>
 <section className={ui.panel}><h2>Complete setup</h2><ol>
 <li><Link href="/people">Assign employees, consultants and the main client</Link>. Keep project roles, financial access and contractual authority explicit. {p.main_client_user_id?"A contractual client contact is assigned.":"A contractual client contact is still required."}</li>
 <li><Link href={`/projects/${id}/documents`}>Attach the original agreement and supporting documents</Link>. Keep internal and client-visible records separate.</li>
 <li><Link href={`/projects/${id}/finance`}>Reconcile the quotation, advance and outstanding records</Link>. Staff prepares, manager approves, and the contractual client accepts the exact quotation. An administrator confirms actual receipts. Supporting evidence alone does not satisfy these checks.</li>
 <li><Link href={`/projects/${id}/overview`}>Have the assigned manager review and activate</Link>. Activation remains blocked until the accepted quotation and required confirmed advance are present.</li>
 </ol><p className={ui.meta}>Existing drawings still need consultant approval of the exact revision and manager release before clients can see them. Additional work follows its own accepted estimate, payment and manager authorisation.</p></section>
 <Link href={`/projects/${id}/overview`}>Open project overview</Link></div>;
}
