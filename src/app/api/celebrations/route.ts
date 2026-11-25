import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSessionPrincipal } from '@/server/auth/session';
import { listCelebrations } from '@/server/experience/service';
export async function GET(request: NextRequest) { const { env } = await getCloudflareContext({ async: true }); const { principal: p } = await getSessionPrincipal(request, env); if (!p)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); return NextResponse.json({ events: await listCelebrations(env.DB, p, request.nextUrl.searchParams.get('projectId') || undefined) }); }
