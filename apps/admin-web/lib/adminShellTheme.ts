/**
 * Maps branch branding hex colors to shadcn-style HSL tokens (space-separated, no `hsl()`)
 * used by Tailwind as `hsl(var(--primary))`, etc.
 */

const ADMIN_SHELL_VAR_KEYS = [
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--ring',
] as const;

export type AdminShellVarKey = (typeof ADMIN_SHELL_VAR_KEYS)[number];

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace(/^#/, '').trim();
  if (h.length === 3 && /^[0-9a-fA-F]{3}$/.test(h)) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6 && /^[0-9a-fA-F]{6}$/.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Tailwind / shadcn format: `H S% L%` */
export function hexToHslSpace(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hRound = Math.round(h * 10) / 10;
  const sRound = Math.round(s * 10) / 10;
  const lRound = Math.round(l * 10) / 10;
  return `${hRound} ${sRound}% ${lRound}%`;
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function parseHslSpace(space: string): { h: number; s: number; l: number } {
  const parts = space.trim().split(/\s+/);
  const h = Number(parts[0] ?? 0);
  const s = Number(String(parts[1] ?? '0').replace('%', ''));
  const l = Number(String(parts[2] ?? '0').replace('%', ''));
  return { h, s, l };
}

function hslSpace(h: number, s: number, l: number): string {
  return `${Math.round(h * 10) / 10} ${Math.round(s * 10) / 10}% ${Math.round(l * 10) / 10}%`;
}

/**
 * Branch primary/secondary hex → CSS variables for the admin shell.
 * Returns null if primary is missing/invalid (caller should fall back to default / clear).
 */
export function branchHexToShellCssVars(
  primaryHex: string | null | undefined,
  secondaryHex: string | null | undefined,
): Record<AdminShellVarKey, string> | null {
  const primary = (primaryHex ?? '').trim();
  const secondary = (secondaryHex ?? '').trim();
  const primarySpace = hexToHslSpace(primary);
  if (!primarySpace) return null;

  const secondarySpace = hexToHslSpace(secondary) ?? '214 72% 96%';
  const { h: sh, s: ss, l: sl } = parseHslSpace(secondarySpace);

  const lumP = relativeLuminance(primary.startsWith('#') ? primary : `#${primary}`);
  const primaryFg = lumP > 0.55 ? '222 47% 11%' : '0 0% 100%';

  const lumS = secondary ? relativeLuminance(secondary.startsWith('#') ? secondary : `#${secondary}`) : 0.95;
  const secondaryFg = lumS > 0.65 ? '222 47% 11.2%' : '210 40% 98%';

  const mutedL = Math.min(sl + 3, 97.5);
  const muted = hslSpace(sh, Math.max(ss * 0.65, 8), mutedL);
  const mutedFg = `${Math.round(sh * 0.15 + 215 * 0.85)} 16% 46.9%`;

  const accentL = Math.min(sl + 1.5, 98);
  const accent = hslSpace(sh, Math.min(ss * 0.85, 40), accentL);
  const accentFg = secondaryFg;

  return {
    '--primary': primarySpace,
    '--primary-foreground': primaryFg,
    '--secondary': secondarySpace,
    '--secondary-foreground': secondaryFg,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': accent,
    '--accent-foreground': accentFg,
    '--ring': primarySpace,
  };
}

export function clearAdminShellThemeVars(root: HTMLElement) {
  for (const key of ADMIN_SHELL_VAR_KEYS) {
    root.style.removeProperty(key);
  }
}

export function applyAdminShellThemeVars(root: HTMLElement, vars: Record<AdminShellVarKey, string>) {
  for (const key of ADMIN_SHELL_VAR_KEYS) {
    const v = vars[key];
    if (v) root.style.setProperty(key, v);
  }
}
