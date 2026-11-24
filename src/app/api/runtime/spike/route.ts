import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { resolveSyntheticPrincipal } from "@/server/auth/principal";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });

  // 1. D1 verification: schema creation, prepared insert, prepared select
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS _runtime_spike (id TEXT PRIMARY KEY, test_val TEXT, created_at INTEGER)"
  );
  const now = Date.now();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO _runtime_spike (id, test_val, created_at) VALUES (?, ?, ?)"
  )
    .bind("spike-test-1", "d1-verified", now)
    .run();

  const d1Row = await env.DB.prepare(
    "SELECT id, test_val, created_at FROM _runtime_spike WHERE id = ?"
  )
    .bind("spike-test-1")
    .first<{ id: string; test_val: string; created_at: number }>();

  // 2. R2 verification: put object stream/text, get object and stream text
  const r2Key = "runtime-spike/spike-test.txt";
  const content = `Merveille R2 verification ${now}`;
  await env.PROJECT_FILES.put(r2Key, content, {
    customMetadata: { testRun: String(now) },
  });

  const r2Object = await env.PROJECT_FILES.get(r2Key);
  const r2Text = r2Object ? await r2Object.text() : null;

  // 3. Synthetic principal check
  const principal = resolveSyntheticPrincipal(
    request.headers,
    request.cookies,
    env
  );

  // 4. Cookies & headers
  const incomingCookie = request.cookies.get("spike_cookie")?.value ?? null;

  const response = NextResponse.json({
    status: "verified",
    environment: env.APP_ENV,
    runtime: "workerd",
    d1: {
      success: !!d1Row && d1Row.test_val === "d1-verified",
      record: d1Row,
    },
    r2: {
      success: r2Text === content,
      key: r2Key,
      contentLength: r2Object?.size,
    },
    syntheticPrincipal: principal,
    incomingCookie,
  });

  // Set response headers and cookie to test bidirectional HTTP semantics
  response.headers.set("X-Merveille-Runtime", "workerd-verified");
  response.cookies.set("spike_cookie", "cookie-session-active", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const body = await request.json().catch(() => ({}));

  // Server mutation check
  const id = `mutation-${Date.now()}`;
  await env.DB.prepare(
    "INSERT INTO _runtime_spike (id, test_val, created_at) VALUES (?, ?, ?)"
  )
    .bind(id, JSON.stringify(body), Date.now())
    .run();

  return NextResponse.json(
    {
      mutation: "success",
      id,
      received: body,
    },
    { status: 201 }
  );
}
