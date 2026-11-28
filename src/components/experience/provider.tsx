'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from '@/components/session';
import { Appearance, DEFAULT_APPEARANCE, CELEBRATIONS, Celebration, Effect } from '@/shared/experience';
import styles from './experience.module.css';
const CACHE = 'merveille-appearance';
function valid(v: any): v is Appearance { return !!v && ['dark', 'light', 'system'].includes(v.theme) && ['full', 'reduced', 'off'].includes(v.celebrations); }
function apply(v: Appearance) {
    const theme = v.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : v.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.motion = v.celebrations;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101216' : '#f6f7f9');
    try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch { }
}
type ContextValue = {
    appearance: Appearance;
    save: (v: Appearance) => Promise<void>;
    notice: string;
    preview: (effect: Effect) => void;
};
const Context = createContext<ContextValue>({ appearance: DEFAULT_APPEARANCE, save: async () => { }, notice: '', preview: () => { } });
export const useAppearance = () => useContext(Context);
export function ExperienceProvider({ children }: {
    children: React.ReactNode;
}) {
    const { principal } = useSession(), path = usePathname();
    const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE), [notice, setNotice] = useState('');
    const [effect, setEffect] = useState<{
        kind: Effect;
        label: string;
        project?: string;
        staticOnly: boolean;
        key: number;
    } | null>(null);
    const prefs = useRef(appearance), busy = useRef(false), served = useRef(0), lastParticle = useRef(0), saveVersion = useRef(0), prefsReady = useRef(false), saveQueue = useRef<Promise<void>>(Promise.resolve()), activeUntil = useRef(0);
    function update(v: Appearance) { prefs.current = v; setAppearance(v); apply(v); }
    useEffect(() => {
        try {
            const v = JSON.parse(localStorage.getItem(CACHE) || 'null');
            if (valid(v))
                update(v);
        }
        catch { }
        const media = matchMedia('(prefers-color-scheme: dark)');
        const change = () => apply(prefs.current);
        media.addEventListener('change', change);
        const reduce = () => { if (matchMedia('(prefers-reduced-motion: reduce)').matches)
            setEffect(null); };
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        motion.addEventListener('change', reduce);
        const storage = (e: StorageEvent) => { if (e.key === CACHE && e.newValue) {
            try {
                const v = JSON.parse(e.newValue);
                if (valid(v)) {
                    prefs.current = v;
                    setAppearance(v);
                    document.documentElement.dataset.motion = v.celebrations;
                    document.documentElement.dataset.theme = v.theme === 'system' ? (media.matches ? 'dark' : 'light') : v.theme;
                }
            }
            catch { }
        } };
        window.addEventListener('storage', storage);
        return () => { media.removeEventListener('change', change); motion.removeEventListener('change', reduce); window.removeEventListener('storage', storage); };
    }, []);
    useEffect(() => { prefsReady.current = false; if (!principal)
        return; const c = new AbortController(), version = saveVersion.current; fetch('/api/preferences/appearance', { cache: 'no-store', signal: c.signal }).then(r => r.ok ? r.json() : null).then(v => { if (valid(v) && version === saveVersion.current)
        update(v); prefsReady.current = true; window.dispatchEvent(new Event('merveille:refresh-celebrations')); }).catch(() => { }); return () => c.abort(); }, [principal?.id]);
    async function save(v: Appearance) {
        const version = ++saveVersion.current;
        update(v);
        setNotice('');
        setEffect(null);
        if (!principal) {
            setNotice('Saved on this browser.');
            return;
        }
        saveQueue.current = saveQueue.current.then(async () => {
            try {
                const r = await fetch('/api/preferences/appearance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
                if (!r.ok)
                    throw Error();
                if (version === saveVersion.current)
                    setNotice('Appearance saved.');
            }
            catch {
                if (version === saveVersion.current)
                    setNotice('Applied on this browser. Could not sync to your account; try again.');
            }
        });
        await saveQueue.current;
    }
    function show(kind: Effect, label: string, quiet = false, project?: string, preview = false) {
        if (!preview && prefs.current.celebrations === 'off')
            return;
        const staticOnly = matchMedia('(prefers-reduced-motion: reduce)').matches || prefs.current.celebrations === 'reduced';
        const particle = ['confetti', 'fireworks', 'sparkles', 'trail'].includes(kind);
        if (quiet)
            kind = 'check';
        if (particle && !quiet && !staticOnly) {
            if (!preview && Date.now() - lastParticle.current < 30000)
                kind = 'check';
            else
                lastParticle.current = Date.now();
        }
        activeUntil.current = Date.now() + 2300;
        setEffect({ kind, label, project, staticOnly, key: Date.now() });
    }
    useEffect(() => {
        if (!effect) return;
        let timer: ReturnType<typeof setTimeout>;
        const expire = () => {
            // Do not remove a dismissal control while someone is using its keyboard focus.
            if (document.querySelector('[data-celebration]')?.contains(document.activeElement)) {
                timer = setTimeout(expire, 1000);
                return;
            }
            setEffect(null);
        };
        timer = setTimeout(expire, effect.staticOnly ? 2200 : effect.kind === 'fireworks' ? 2200 : effect.kind === 'confetti' ? 1800 : 1200);
        return () => clearTimeout(timer);
    }, [effect]);
    useEffect(() => {
        if (!principal)
            return;
        let disposed = false, timer: ReturnType<typeof setTimeout>;
        async function refresh() {
            if (disposed || busy.current || !prefsReady.current || prefs.current.celebrations === 'off' || document.hidden || document.querySelector('dialog[open]') || document.activeElement?.matches('input,textarea,select'))
                return;
            if (Date.now() < activeUntil.current) {
                timer = setTimeout(refresh, activeUntil.current - Date.now() + 100);
                return;
            }
            busy.current = true;
            try {
                const match = path.match(/^\/projects\/([^/]+)/);
                const context = match ? '?projectId=' + encodeURIComponent(match[1]) : '';
                if (!match && !['/overview', '/waiting', '/finance', '/projects'].includes(path))
                    return;
                const r = await fetch('/api/celebrations' + context, { cache: 'no-store' });
                if (!r.ok)
                    return;
                const { events } = await r.json() as {
                    events: Celebration[];
                };
                if (!Array.isArray(events))
                    return;
                for (const e of events as Celebration[]) {
                    if (disposed || document.hidden || document.querySelector('dialog[open]') || document.activeElement?.matches('input,textarea,select'))
                        break;
                    if (!CELEBRATIONS[e.kind] || (e.actorId !== principal!.id && served.current >= 3))
                        continue;
                    const claim = await fetch('/api/celebrations/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) });
                    if (!claim.ok || !((await claim.json()) as {
                        claimed: boolean;
                    }).claimed)
                        continue;
                    if (disposed || document.hidden)
                        break;
                    const definition = CELEBRATIONS[e.kind];
                    let kind: Effect = definition.effect;
                    if (e.kind === 'task_completed')
                        kind = (['check', 'trail', 'confetti'] as Effect[])[parseInt(e.id.slice(-2), 16) % 3];
                    show(kind, definition.label, e.quiet, e.projectName);
                    if (e.actorId !== principal!.id)
                        served.current++;
                    // One at a time. Remaining events are offered on a later relevant visit.
                    break;
                }
            }
            catch { /* Optional effects never change the business result. */ }
            finally {
                busy.current = false;
            }
        }
        const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 700); };
        const visibility = () => { if (document.hidden)
            setEffect(null);
        else
            schedule(); };
        schedule();
        window.addEventListener('merveille:refresh-celebrations', schedule);
        window.addEventListener('focus', schedule);
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('close', schedule, true);
        document.addEventListener('focusout', schedule);
        return () => { disposed = true; clearTimeout(timer); window.removeEventListener('merveille:refresh-celebrations', schedule); window.removeEventListener('focus', schedule); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('close', schedule, true); document.removeEventListener('focusout', schedule); };
    }, [path, principal?.id]);
    useEffect(() => {
        if (!effect || effect.staticOnly || !['confetti', 'fireworks', 'sparkles', 'trail'].includes(effect.kind))
            return;
        let stop: (() => void) | undefined, cancelled = false;
        import('./particles').then(m => { if (!cancelled)
            stop = m.playParticles(effect.kind as Effect); });
        return () => { cancelled = true; stop?.(); };
    }, [effect]);
    return <Context.Provider value={{ appearance, save, notice, preview: kind => show(kind, 'Celebration preview', false, undefined, true) }}>{children}{effect && <div data-celebration="true" key={effect.key} className={`${styles.celebration} ${effect.staticOnly ? '' : styles[effect.kind]}`} role="status" aria-live="polite"><span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false">{effect.kind === 'blueprint' ? <path d="M7 7h26v26H7z M7 19h12v14 M19 7v12h14 M25 19v14"/> : effect.kind === 'sheet' ? <><path d="M11 5h14l6 6v24H11z M25 5v7h6 M16 18h10 M16 24h10 M16 29h6"/></> : effect.kind === 'seal' ? <><circle cx="20" cy="20" r="14"/><path d="m12 20 5 5 11-12"/></> : <path d="m10 20 7 7 14-15"/>}</svg></span><div><strong>{effect.label}</strong>{effect.project && <span>{effect.project}</span>}</div><button type="button" aria-label="Dismiss celebration" onClick={() => setEffect(null)}>×</button></div>}</Context.Provider>;
}
