const DEFAULT_CUSTOMER_APP_URL = 'https://customerbubbler.krackbot.com/';

function withTrailingSlash(url: string): string {
  const t = url.trim();
  if (!t) return DEFAULT_CUSTOMER_APP_URL;
  return t.endsWith('/') ? t : `${t}/`;
}

/** Shown in WhatsApp captions as “Open our app: …”. Set `NEXT_PUBLIC_CUSTOMER_APP_URL` to override per environment. */
export const CUSTOMER_APP_URL = withTrailingSlash(
  process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.trim() || DEFAULT_CUSTOMER_APP_URL,
);

/**
 * Base URL for the standalone customer web app / PWA (Expo export from `customer-pwa`).
 * When unset, falls back to {@link CUSTOMER_APP_URL}. Set `NEXT_PUBLIC_CUSTOMER_PWA_URL` if the PWA is hosted separately.
 */
export const CUSTOMER_PWA_APP_URL = process.env.NEXT_PUBLIC_CUSTOMER_PWA_URL?.trim()
  ? withTrailingSlash(process.env.NEXT_PUBLIC_CUSTOMER_PWA_URL.trim())
  : CUSTOMER_APP_URL;
