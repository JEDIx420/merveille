import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSessionPrincipal } from '@/server/auth/session';
import { claimCelebration } from '@/server/experience/service';
import { publicError, errorStatus } from '@/server/http/errors';
export async function POST(request: NextRequest) { const { env } = await getCloudflareContext({ async: true }); const { principal: p } = await getSessionPrincipal(request, env); if (!p)
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }); try {
    return NextResponse.json({ claimed: await claimCelebration(env.DB, p, ((await request.json()) as {
            id: string;
        }).id) });
}
catch (e) {
    return NextResponse.json({ error: publicError(e) }, { status: errorStatus(e) });
} }
