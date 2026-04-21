/**
 * Maps branch portal primary/secondary (hex) to shadcn-style HSL CSS variables on :root.
 * Tailwind uses `hsl(var(--primary))` etc. in tailwind.config.ts.
 */

const DEFAULT_PRIMARY = '#C2185B';
const DEFAULT_SECONDARY = '#f4f4f5';

const RESET_VARS: Record<string, string> = {
  '--background': '0 0% 100%',
  '--foreground': '222.2 84% 4.9%',
  '--card': '0 0% 100%',
  '--card-foreground': '222.2 84% 4.9%',
  '--primary': '222.2 47.4% 11.2%',
  '--primary-foreground': '210 40% 98%',
  '--secondary': '210 40% 96.1%',
  '--secondary-foreground': '222.2 47.4% 11.2%',
  '--muted': '210 40% 96.1%',
  '--muted-foreground': '215.4 16.3% 46.9%',
  '--border': '214.3 31.8% 91.4%',
  '--input': '214.3 31.8% 91.4%',
  '--ring': '222.2 84% 4.9%',
};

function normalizeHex(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let h = String(raw).trim();
  if (!h) return null;
  if (!h.startsWith('#')) h = `#${h}`;
  h = h.replace('#', '');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  return h.length === 6 ? `#${h}` : null;
}

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const h = n.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
}

function mixHex(a: string, b: string, t: number): string {
  const A = parseRgb(a);
  const B = parseRgb(b);
  if (!A || !B) return a;
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${[clamp(A.r + (B.r - A.r) * t), clamp(A.g + (B.g - A.g) * t), clamp(A.b + (B.b - A.b) * t)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHslSpace(r: number, g: number, b: number): string {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hexToHslSpace(hex: string): string | null {
  const rgb = parseRgb(hex);
  if (!rgb) return null;
  return rgbToHslSpace(rgb.r, rgb.g, rgb.b);
}

function relativeLuminance(hex: string): number {
  const rgb = parseRgb(hex);
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

/** Apply branch colors after portal public payload is loaded. */
export function applyBranchThemeToDocument(primary: string | null | undefined, secondary: string | null | undefined) {
  if (typeof document === 'undefined') return;
  const pRaw = primary?.trim();
  const sRaw = secondary?.trim();
  if (!pRaw && !sRaw) {
    resetBranchThemeInDocument();
    return;
  }
  const root = document.documentElement;
  const p = normalizeHex(pRaw) ?? DEFAULT_PRIMARY;
  const s = normalizeHex(sRaw) ?? DEFAULT_SECONDARY;
  const primaryHsl = hexToHslSpace(p);
  const onPrimary = relativeLuminance(p) > 0.55 ? '222.2 47.4% 11.2%' : '0 0% 100%';
  if (!primaryHsl) return;
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--primary-foreground', onPrimary);
  const secondaryHsl = hexToHslSpace(mixHex(s, '#ffffff', 0.38));
  const mutedHsl = hexToHslSpace(mixHex(s, '#ffffff', 0.55));
  const cardHsl = hexToHslSpace(mixHex(s, '#ffffff', 0.72));
  if (secondaryHsl) root.style.setProperty('--secondary', secondaryHsl);
  root.style.setProperty('--secondary-foreground', '222.2 47.4% 11.2%');
  if (mutedHsl) root.style.setProperty('--muted', mutedHsl);
  if (cardHsl) root.style.setProperty('--card', cardHsl);
  root.style.setProperty('--ring', primaryHsl);
  root.style.setProperty('--background', '0 0% 100%');
  root.style.setProperty('--foreground', '222.2 84% 4.9%');
  root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
  const borderHsl = hexToHslSpace(mixHex(p, '#ffffff', 0.82));
  if (borderHsl) {
    root.style.setProperty('--border', borderHsl);
    root.style.setProperty('--input', borderHsl);
  }
}

export function resetBranchThemeInDocument() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(RESET_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
}
