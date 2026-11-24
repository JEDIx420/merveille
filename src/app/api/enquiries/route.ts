import { publicError, errorStatus } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  listEnquiries,
  createEnquiry,
} from "@/server/domain/enquiries/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const enquiries = await listEnquiries(auth.principal, env.DB);
    return NextResponse.json({ ok: true, enquiries });
  } catch (err: any) {
    return NextResponse.json(
      { error: publicError(err), code: err.code || "FORBIDDEN" },
      { status: errorStatus(err) },
    );
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const result = await createEnquiry(
      auth.principal,
      {
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        siteLocation: body.siteLocation,
        requirementsText: body.requirementsText,
        leadManagerId: body.leadManagerId,
      },
      env.DB,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: publicError(err), code: err.code || "OPERATION_FAILED" },
      { status: errorStatus(err) },
    );
  }
}
