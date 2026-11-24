import { publicError, errorStatus } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { AccountingService } from "@/server/domain/accounting/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const currency = searchParams.get("currency") || "INR";
  const startDate =
    searchParams.get("startDate") || `${new Date().getFullYear()}-01-01`;
  const endDate =
    searchParams.get("endDate") || `${new Date().getFullYear()}-12-31`;

  try {
    const report = await AccountingService.getFinancialReport(
      env.DB,
      auth.principal,
      {
        projectId,
        currency,
        periodStartDate: startDate,
        periodEndDate: endDate,
      },
    );
    return NextResponse.json({ ok: true, report });
  } catch (err: any) {
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status: errorStatus(err) },
    );
  }
}
