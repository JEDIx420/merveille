import { publicError, errorStatus } from "@/server/http/errors";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifiedIdentity } from "@/server/auth/session";
import { acceptInvitation } from "@/server/domain/identity/service";
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const identity = await verifiedIdentity(request, env);
  if (!identity)
    return Response.json(
      { error: "Sign in with your invited email account." },
      { status: 401 },
    );
  try {
    const body = (await request.json()) as { token: string };
    if (typeof body.token !== "string" || body.token.length > 256)
      throw new Error("Invalid invitation.");
    return Response.json({
      ok: true,
      ...(await acceptInvitation(body.token, identity, env.DB)),
    });
  } catch (err: any) {
    return Response.json(
      {
        error: err.code
          ? publicError(err)
          : "Invitation acceptance failed. Contact your administrator.",
        code: err.code ?? "INVALID_INPUT",
      },
      { status: errorStatus(err) },
    );
  }
}
