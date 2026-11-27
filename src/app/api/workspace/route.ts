import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  preferences,
  savePreferences,
  personalDetail,
} from "@/server/workspace/service";
import { publicError, errorStatus } from "@/server/http/errors";
import { getPersonalTask } from "@/server/domain/tasks/personal-service";
export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(req, env);
  if (!principal)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("personalTaskId");
    return NextResponse.json(
      id
        ? await personalDetail(env.DB, principal, id)
        : await preferences(env.DB, principal),
    );
  } catch (e) {
    return NextResponse.json(
      { error: publicError(e) },
      { status: errorStatus(e) },
    );
  }
}
export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(req, env);
  if (!principal)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b: any = await req.json();
    if (!b.personalTaskId)
      return NextResponse.json(await savePreferences(env.DB, principal, b));
    await getPersonalTask(principal, b.personalTaskId, env.DB);
    if (
      b.action === "comment" &&
      typeof b.text === "string" &&
      b.text.trim() &&
      b.text.length <= 5000
    ) {
      await env.DB.prepare("INSERT INTO personal_task_comments VALUES(?,?,?,?)")
        .bind(crypto.randomUUID(), b.personalTaskId, b.text.trim(), Date.now())
        .run();
    } else if (
      b.action === "checklist" &&
      typeof b.text === "string" &&
      b.text.trim() &&
      b.text.length <= 300
    ) {
      await env.DB.prepare(
        "INSERT INTO personal_task_checklist_items VALUES(?,?,?,0,0,?)",
      )
        .bind(crypto.randomUUID(), b.personalTaskId, b.text.trim(), Date.now())
        .run();
    } else if (
      b.action === "toggle" &&
      typeof b.itemId === "string" &&
      typeof b.completed === "boolean"
    ) {
      await env.DB.prepare(
        "UPDATE personal_task_checklist_items SET is_completed=? WHERE id=? AND personal_task_id=?",
      )
        .bind(b.completed ? 1 : 0, b.itemId, b.personalTaskId)
        .run();
    } else
      return NextResponse.json(
        { error: "Choose a valid task action." },
        { status: 400 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: publicError(e) },
      { status: errorStatus(e) },
    );
  }
}
