import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSessionPrincipal } from '@/server/auth/session';
import { getAppearance, setAppearance } from '@/server/experience/service';
import { publicError, errorStatus } from '@/server/http/errors';
export async function GET(request: NextRequest) { const { env } = await getCloudflareContext({ async: true }); const { principal: p } = await getSessionPrincipal(request, env); if (!p)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); return NextResponse.json(await getAppearance(env.DB, p)); }
export async function PUT(request: NextRequest) { const { env } = await getCloudflareContext({ async: true }); const { principal: p } = await getSessionPrincipal(request, env); if (!p)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); try {
    return NextResponse.json(await setAppearance(env.DB, p, await request.json()));
}
catch (e) {
    return NextResponse.json({ error: publicError(e) }, { status: errorStatus(e) });
} }
