export type Theme = 'dark' | 'light' | 'system';
export type CelebrationLevel = 'full' | 'reduced' | 'off';
export interface Appearance {
    theme: Theme;
    celebrations: CelebrationLevel;
}
export const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', celebrations: 'full' };
export const CELEBRATIONS = {
    project_created: { label: 'A new project begins', effect: 'blueprint' },
    project_activated: { label: 'Project ready to begin', effect: 'fireworks' },
    task_completed: { label: 'Task completed', effect: 'check' },
    receipt_confirmed: { label: 'Payment confirmed', effect: 'sparkles' },
    invoice_settled: { label: 'Invoice fully paid', effect: 'confetti' },
    drawing_released: { label: 'New drawing released', effect: 'sheet' },
    quote_accepted: { label: 'Quotation accepted', effect: 'seal' },
    estimate_accepted: { label: 'Additional estimate accepted', effect: 'seal' },
} as const;
export type CelebrationKind = keyof typeof CELEBRATIONS;
export interface Celebration {
    id: string;
    kind: CelebrationKind;
    projectId: string;
    projectName: string;
    quiet: boolean;
    actorId?: string | null;
}
export const EFFECTS = ['blueprint', 'fireworks', 'check', 'sparkles', 'confetti', 'sheet', 'seal', 'trail'] as const;
export type Effect = typeof EFFECTS[number];
