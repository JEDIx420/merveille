import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  getEnquiry,
  recordFeasibilityStudy,
  closeEnquiry,
  convertEnquiryToProject,
} from "@/server/domain/enquiries/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getEnquiry(auth.principal, id, env.DB);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const action = body.action;

    switch (action) {
      case "RECORD_FEASIBILITY": {
        const result = await recordFeasibilityStudy(
          auth.principal,
          id,
          {
            observations: body.observations,
            siteConstraints: body.siteConstraints,
            recommendations: body.recommendations,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }
      case "CLOSE": {
        const result = await closeEnquiry(
          auth.principal,
          id,
          {
            status: body.status, // "LOST" | "DECLINED"
            reason: body.reason,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }
      case "CONVERT": {
        const result = await convertEnquiryToProject(
          auth.principal,
          id,
          {
            projectCode: body.projectCode,
            projectName: body.projectName,
            mainClientUserId: body.mainClientUserId,
            managerUserId: body.managerUserId,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json(
          { error: `Unknown enquiry action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
