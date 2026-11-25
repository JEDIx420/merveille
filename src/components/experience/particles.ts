import type { Effect } from '@/shared/experience';
/** Ephemeral local canvas; no network, business state, audio or interaction capture. */
export function playParticles(kind: Effect) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '90' });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.remove();
        return () => { };
    }
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#93c5fd', '#a78bfa', '#6ee7b7', '#f5d88e', '#f0abfc'];
    const count = Math.round((w < 600 ? 42 : 78) * (kind === 'sparkles' ? .55 : 1));
    const particles = Array.from({ length: count }, (_, i) => { const angle = Math.PI * 2 * i / count, speed = kind === 'fireworks' ? 35 + Math.random() * 75 : 40 + Math.random() * 120; return { x: kind === 'fireworks' ? (i % 2 ? w * .32 : w * .68) : w * .7, y: kind === 'fireworks' ? h * .32 : h * .75, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (kind === 'confetti' ? 120 : 0), size: 2 + Math.random() * 4, color: colors[i % colors.length], angle: Math.random() * 6 }; });
    const start = performance.now(), duration = kind === 'fireworks' ? 2100 : kind === 'confetti' ? 1700 : 950;
    let frame = 0, stopped = false;
    function stop() { if (stopped)
        return; stopped = true; cancelAnimationFrame(frame); canvas.remove(); document.removeEventListener('visibilitychange', visibility); }
    const visibility = () => { if (document.hidden)
        stop(); };
    document.addEventListener('visibilitychange', visibility);
    function draw(now: number) {
        if (stopped)
            return;
        const age = now - start, t = age / 1000;
        if (age > duration) {
            stop();
            return;
        }
        ctx!.clearRect(0, 0, w, h);
        ctx!.globalAlpha = Math.max(0, 1 - age / duration);
        for (const p of particles) {
            ctx!.save();
            ctx!.translate(p.x + p.vx * t, p.y + p.vy * t + (kind === 'confetti' ? 95 * t * t : 20 * t * t));
            ctx!.rotate(p.angle + t * 2);
            ctx!.fillStyle = p.color;
            if (kind === 'confetti')
                ctx!.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
            else {
                ctx!.beginPath();
                ctx!.arc(0, 0, p.size * (kind === 'trail' ? .5 : 1), 0, Math.PI * 2);
                ctx!.fill();
            }
            ctx!.restore();
        }
        frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return stop;
}
