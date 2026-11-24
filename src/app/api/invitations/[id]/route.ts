import { publicError, errorStatus } from "@/server/http/errors";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { manageInvitation } from "@/server/domain/identity/service";
import { reconcileAccessAdmission } from "@/server/auth/admission";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(request, env);
  if (!principal)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await request.json()) as any;
    const result = await manageInvitation(principal, id, body.action, env.DB);
    const admission = await reconcileAccessAdmission(env, principal.orgId);
    return Response.json({ ...result, admissionStatus: admission.status });
  } catch (err: any) {
    return Response.json(
      {
        error: err.code
          ? publicError(err)
          : "The invitation could not be changed.",
      },
      { status: errorStatus(err) },
    );
  }
}
