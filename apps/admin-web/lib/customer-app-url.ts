const DEFAULT_CUSTOMER_APP_URL = 'https://bubbler-customer.vercel.app/';

function withTrailingSlash(url: string): string {
  const t = url.trim();
  if (!t) return DEFAULT_CUSTOMER_APP_URL;
  return t.endsWith('/') ? t : `${t}/`;
}

/** Shown in WhatsApp captions as “Open our app: …”. Set `NEXT_PUBLIC_CUSTOMER_APP_URL` to override per environment. */
export const CUSTOMER_APP_URL = withTrailingSlash(
  process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.trim() || DEFAULT_CUSTOMER_APP_URL,
);
