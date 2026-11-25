'use client';
import { useRef, useId, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { useAppearance } from './provider';
import { Theme, CelebrationLevel, EFFECTS } from '@/shared/experience';
import styles from './experience.module.css';
export function AppearanceControl() {
    const group = useId();
    const { appearance, save, notice, preview } = useAppearance(), ref = useRef<HTMLDetailsElement>(null);
    const path = usePathname();
    useEffect(() => { ref.current?.removeAttribute('open'); }, [path]);
    useEffect(() => { const dismiss = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node))
        ref.current.removeAttribute('open'); }; document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss); }, []);
    return <details ref={ref} className={styles.menu} onKeyDown={e => { if (e.key === 'Escape') {
        e.preventDefault();
        ref.current?.removeAttribute('open');
        ref.current?.querySelector('summary')?.focus();
    } }}><summary aria-label="Appearance"><Palette size={18} aria-hidden="true"/><span>Appearance</span></summary><div className={styles.popover}>
 <h2>Make it yours</h2><p>Choose your workspace appearance.</p>
 <fieldset><legend>Theme</legend><div className={styles.themes}>{([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'System', Monitor]] as const).map(([value, label, Icon]) => <label key={value} className={styles.themeOption}><input type="radio" name={group} value={value} checked={appearance.theme === value} onChange={() => save({ ...appearance, theme: value as Theme })}/><span className={styles.swatch} data-preview={value}><i /><i /></span><span><Icon size={14} aria-hidden="true"/>{label}</span></label>)}</div></fieldset>
 <label className={styles.level}>Celebrations<select aria-label="Celebration level" value={appearance.celebrations} onChange={e => save({ ...appearance, celebrations: e.target.value as CelebrationLevel })}><option value="full">Full · lively and varied</option><option value="reduced">Reduced · quiet confirmations</option><option value="off">Off</option></select></label>
 <p>Motion follows your device’s reduced-motion setting. No sound.</p>
 <details className={styles.previews}><summary>Preview celebrations</summary><div>{EFFECTS.map(effect => <button type="button" key={effect} onClick={() => preview(effect)}>{effect}</button>)}</div></details>
 {notice && <p role="status">{notice}</p>}
 </div></details>;
}
