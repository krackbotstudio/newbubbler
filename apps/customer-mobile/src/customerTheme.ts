export type CustomerThemeColors = {
  /** Branch / brand primary (buttons, key accents). */
  primary: string;
  /** Tinted primary for chips and soft highlights. */
  primaryLight: string;
  /** Darker primary for labels and emphasis on light surfaces. */
  primaryDark: string;
  /** Text and icons on solid `primary` (auto light/dark for contrast). */
  onPrimary: string;
  /** Branch secondary base (page wash); also drives elevation ramp. */
  secondary: string;
  /** Bottom nav pill background — kept dark enough for white nav labels. */
  navBarDark: string;
  navBarIcon: string;
  /** Login / OTP card surface (tied to secondary + primary hint). */
  authCardSurface: string;
  elevation0: string;
  elevation1: string;
  elevation2: string;
  elevation3: string;
  elevation4: string;
  elevation5: string;
  white: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  error: string;
  success: string;
  successBg: string;
  successBorder: string;
};

const DEFAULT_PRIMARY = '#1e40af';
const DEFAULT_SECONDARY = '#dbeafe';

function normalizeHexInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let h = String(raw).trim();
  if (!h) return null;
  if (!h.startsWith('#')) h = `#${h}`;
  h = h.replace('#', '');
  if (h.length === 8) h = h.slice(0, 6);
  return `#${h}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
  }
  return null;
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  if (!A || !B) return a;
  return toHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function darken(hex: string, factor: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb.r * (1 - factor), rgb.g * (1 - factor), rgb.b * (1 - factor));
}

/** WCAG-related relative luminance (sRGB), 0–1. */
function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text/icon color on top of solid `primary`. */
function onPrimaryFor(primary: string): string {
  const L = relativeLuminance(primary);
  return L > 0.55 ? '#1a1a2e' : '#ffffff';
}

/** Darken until bar reads clearly with white icons (rough WCAG heuristic). */
function navBarBackground(primary: string): string {
  let candidate = darken(primary, 0.38);
  for (let i = 0; i < 6; i++) {
    if (relativeLuminance(candidate) < 0.22) return candidate;
    candidate = darken(candidate, 0.1);
  }
  return candidate;
}

export const DEFAULT_CUSTOMER_THEME: CustomerThemeColors = {
  primary: DEFAULT_PRIMARY,
  primaryLight: '#93c5fd',
  primaryDark: '#1e3a8a',
  onPrimary: '#ffffff',
  secondary: DEFAULT_SECONDARY,
  navBarDark: '#0f172a',
  navBarIcon: 'rgba(255,255,255,0.75)',
  authCardSurface: '#eff6ff',
  elevation0: '#f8fafc',
  elevation1: '#f1f5f9',
  elevation2: '#e2e8f0',
  elevation3: '#dbeafe',
  elevation4: '#bfdbfe',
  elevation5: '#93c5fd',
  white: '#FFFFFF',
  text: '#0f172a',
  textSecondary: '#475569',
  border: '#93c5fd',
  borderLight: '#e0f2fe',
  error: '#b91c1c',
  success: '#166534',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
};

export function buildCustomerThemeFromBranch(branch: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
} | null): CustomerThemeColors {
  const base = DEFAULT_CUSTOMER_THEME;
  if (!branch) return base;

  const primaryNorm = normalizeHexInput(branch.primaryColor);
  const primary = primaryNorm && parseHex(primaryNorm) ? primaryNorm : DEFAULT_PRIMARY;

  const secondaryNorm = normalizeHexInput(branch.secondaryColor);
  const secondary = secondaryNorm && parseHex(secondaryNorm) ? secondaryNorm : DEFAULT_SECONDARY;

  const onPrimary = onPrimaryFor(primary);
  const primaryDark = darken(primary, 0.22);
  const navBarDark = navBarBackground(primary);
  const primaryLight = mixHex(primary, '#ffffff', 0.72);

  const elevation0 = mixHex(secondary, '#ffffff', 0.52);
  const elevation1 = mixHex(secondary, '#ffffff', 0.38);
  const elevation2 = mixHex(secondary, '#ffffff', 0.28);
  const elevation3 = mixHex(secondary, '#ffffff', 0.18);
  const elevation4 = mixHex(secondary, '#ffffff', 0.12);
  const elevation5 = mixHex(secondary, '#ffffff', 0.06);

  const border = mixHex(primary, secondary, 0.35);
  const borderLight = mixHex(mixHex(primary, '#ffffff', 0.9), secondary, 0.12);

  const authCardSurface = mixHex(mixHex(secondary, '#ffffff', 0.25), primary, 0.08);

  return {
    ...base,
    primary,
    primaryLight,
    primaryDark,
    onPrimary,
    secondary,
    navBarDark,
    authCardSurface,
    elevation0,
    elevation1,
    elevation2,
    elevation3,
    elevation4,
    elevation5,
    border,
    borderLight,
  };
}
