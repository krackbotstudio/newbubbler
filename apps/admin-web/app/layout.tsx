import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003/api';
const API_ORIGIN = API_BASE.startsWith('http') ? API_BASE.replace(/\/api\/?$/, '') : null;

const FAVICON_FETCH_TIMEOUT_MS = 5000;

export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = {
    title: 'Bubbler Admin',
    description: 'Bubbler — laundry platform admin',
  };
  if (!API_ORIGIN) return base;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/branding/public`, {
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = (await res.json()) as { logoUrl?: string | null; appIconUrl?: string | null };
    const rawIcon = data?.appIconUrl ?? data?.logoUrl;
    if (rawIcon && typeof rawIcon === 'string') {
      const iconUrl = rawIcon.startsWith('http') ? rawIcon : `${API_ORIGIN}${rawIcon}`;
      return { ...base, icons: { icon: iconUrl } };
    }
  } catch {
    // ignore (e.g. API unreachable at build time, timeout, or no logo)
  }
  return base;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
